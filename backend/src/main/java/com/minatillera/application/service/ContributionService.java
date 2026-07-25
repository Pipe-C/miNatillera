package com.minatillera.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.minatillera.domain.exception.GroupCompletedException;
import com.minatillera.domain.exception.GroupNotFoundException;
import com.minatillera.domain.exception.MemberNotFoundException;
import com.minatillera.domain.model.Contribution;
import com.minatillera.domain.model.Group;
import com.minatillera.domain.model.Money;
import com.minatillera.domain.port.in.ListContributionsUseCase;
import com.minatillera.domain.port.in.RegisterContributionUseCase;
import com.minatillera.domain.port.out.ContributionRepository;
import com.minatillera.domain.port.out.ContributionRepository.ContributionPage;
import com.minatillera.domain.port.out.GroupRepository;
import com.minatillera.domain.port.out.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Service
public class ContributionService implements RegisterContributionUseCase, ListContributionsUseCase {

    private static final Logger log = LoggerFactory.getLogger(ContributionService.class);

    private final ContributionRepository contributionRepository;
    private final GroupRepository groupRepository;
    private final MemberRepository memberRepository;
    private final ObjectMapper objectMapper;

    public ContributionService(ContributionRepository contributionRepository,
                               GroupRepository groupRepository,
                               MemberRepository memberRepository,
                               ObjectMapper objectMapper) {
        this.contributionRepository = contributionRepository;
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public ContributionResult register(String groupId, String memberId, BigDecimal amount,
                                       LocalDate date, String idempotencyKey, String receiptImageUrl) {
        // Check for existing idempotent result first
        Optional<String> existingResult = contributionRepository.findIdempotencyResult(groupId, idempotencyKey);
        if (existingResult.isPresent()) {
            log.debug("Returning idempotent result for key: {}", idempotencyKey);
            return deserializeResult(existingResult.get(), true);
        }

        // Validate group exists and is active
        Group group = groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        if (group.isCompleted()) {
            throw new GroupCompletedException();
        }

        // Validate member belongs to group
        memberRepository.findById(groupId, memberId)
                .orElseThrow(MemberNotFoundException::new);

        // Create the contribution
        Money contributionAmount = Money.of(amount);
        String contributionId = UUID.randomUUID().toString();
        Instant now = Instant.now();

        Contribution contribution = new Contribution(
                contributionId, groupId, memberId,
                contributionAmount, date, idempotencyKey, receiptImageUrl, now
        );

        // Build the result optimistically (we'll atomically update the accumulated)
        Money newAccumulated = groupRepository.addToAccumulatedAmount(
                groupId, contributionAmount, group.getGoalAmount());

        // Determine new status
        String newStatus;
        int progressPercent;
        if (group.getGoalAmount() != null) {
            newStatus = newAccumulated.isGreaterThanOrEqual(group.getGoalAmount())
                    ? "COMPLETADO"
                    : "ACTIVO";
            progressPercent = newAccumulated.percentOf(group.getGoalAmount());
        } else {
            newStatus = "ACTIVO";
            progressPercent = 0;
        }

        ContributionResult result = new ContributionResult(
                contributionId,
                memberId,
                contributionAmount.toString(),
                date.toString(),
                new GroupProgressSnapshot(
                        groupId,
                        newAccumulated.toString(),
                        group.getGoalAmount() != null ? group.getGoalAmount().toString() : null,
                        newStatus,
                        progressPercent
                ),
                false
        );

        // Persist the contribution with idempotency guard
        String responseJson = serializeResult(result);
        boolean saved = contributionRepository.saveWithIdempotency(contribution, responseJson);

        if (!saved) {
            // Concurrent duplicate — return the stored result
            Optional<String> storedResult = contributionRepository.findIdempotencyResult(groupId, idempotencyKey);
            return storedResult.map(s -> deserializeResult(s, true))
                    .orElse(result);
        }

        return result;
    }

    @Override
    public ContributionPage list(String groupId, int limit, String lastKey) {
        // Validate group exists
        groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        int effectiveLimit = Math.min(Math.max(limit, 1), 100);
        return contributionRepository.findByGroupId(groupId, effectiveLimit, lastKey);
    }

    @Override
    public void deleteContribution(String groupId, String contributionId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        // Find the contribution to get its amount before deleting
        ContributionPage page = contributionRepository.findByGroupId(groupId, 200, null);
        page.items().stream()
                .filter(c -> c.getContributionId().equals(contributionId))
                .findFirst()
                .ifPresent(c -> {
                    // Subtract from accumulated amount (ADD with negative value)
                    Money negativeAmount = Money.of(c.getAmount().value().negate());
                    groupRepository.addToAccumulatedAmount(groupId, negativeAmount, group.getGoalAmount());
                });

        contributionRepository.delete(groupId, contributionId);
    }

    @Override
    public void updateContribution(String groupId, String contributionId, java.math.BigDecimal newAmount, java.time.LocalDate date, String receiptImageUrl) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        // Find old amount to calculate difference
        ContributionPage page = contributionRepository.findByGroupId(groupId, 200, null);
        page.items().stream()
                .filter(c -> c.getContributionId().equals(contributionId))
                .findFirst()
                .ifPresent(c -> {
                    Money oldAmount = c.getAmount();
                    Money newMoney = Money.of(newAmount);
                    // Calculate difference (new - old) and add it (can be negative)
                    Money diff = newMoney.subtract(oldAmount);
                    if (diff.value().signum() != 0) {
                        groupRepository.addToAccumulatedAmount(groupId, diff, group.getGoalAmount());
                    }
                });

        contributionRepository.update(groupId, contributionId, newAmount.toPlainString(), date.toString(), receiptImageUrl);
    }

    private String serializeResult(ContributionResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize contribution result", e);
            throw new IllegalStateException("Serialization error", e);
        }
    }

    private ContributionResult deserializeResult(String json, boolean markIdempotent) {
        try {
            ContributionResult original = objectMapper.readValue(json, ContributionResult.class);
            if (markIdempotent) {
                return new ContributionResult(
                        original.contributionId(),
                        original.memberId(),
                        original.amount(),
                        original.date(),
                        original.group(),
                        true
                );
            }
            return original;
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize idempotency result", e);
            throw new IllegalStateException("Deserialization error", e);
        }
    }
}
