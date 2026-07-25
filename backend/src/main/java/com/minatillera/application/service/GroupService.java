package com.minatillera.application.service;

import com.minatillera.domain.exception.GroupNotFoundException;
import com.minatillera.domain.exception.InvalidInviteCodeException;
import com.minatillera.domain.model.Group;
import com.minatillera.domain.model.GroupStatus;
import com.minatillera.domain.model.Manager;
import com.minatillera.domain.model.Member;
import com.minatillera.domain.model.Money;
import com.minatillera.domain.port.in.CreateGroupUseCase;
import com.minatillera.domain.port.in.GetProgressUseCase;
import com.minatillera.domain.port.in.ResolveInviteCodeUseCase;
import com.minatillera.domain.port.out.ContributionRepository;
import com.minatillera.domain.port.out.ContributionRepository.ContributionPage;
import com.minatillera.domain.port.out.GroupRepository;
import com.minatillera.domain.port.out.ManagerRepository;
import com.minatillera.domain.port.out.MemberRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class GroupService implements CreateGroupUseCase, GetProgressUseCase, ResolveInviteCodeUseCase {

    private static final String INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GroupRepository groupRepository;
    private final ContributionRepository contributionRepository;
    private final MemberRepository memberRepository;
    private final ManagerRepository managerRepository;

    public GroupService(GroupRepository groupRepository, ContributionRepository contributionRepository,
                        MemberRepository memberRepository, ManagerRepository managerRepository) {
        this.groupRepository = groupRepository;
        this.contributionRepository = contributionRepository;
        this.memberRepository = memberRepository;
        this.managerRepository = managerRepository;
    }

    @Override
    public CreateResult create(String name, BigDecimal goalAmount, LocalDate targetDate, String creatorName) {
        String groupId = UUID.randomUUID().toString();
        String inviteCode = generateUniqueInviteCode();
        Instant now = Instant.now();

        Money goal = goalAmount != null ? Money.of(goalAmount) : null;

        Group group = new Group(
                groupId,
                name,
                goal,
                Money.zero(),
                targetDate,
                GroupStatus.ACTIVO,
                inviteCode,
                0,
                now,
                now
        );

        groupRepository.save(group);

        // Auto-register creator as first member with isOwner=true
        String memberId = UUID.randomUUID().toString();
        Member ownerMember = new Member(memberId, groupId, creatorName, true, true, now);
        memberRepository.save(ownerMember);
        groupRepository.incrementMemberCount(groupId);

        // Generate creator token and store as Manager
        String creatorToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(creatorToken);
        String managerId = UUID.randomUUID().toString();
        Manager ownerManager = new Manager(managerId, groupId, creatorName, tokenHash, true, now);
        managerRepository.saveManager(ownerManager);

        return new CreateResult(group, creatorToken);
    }

    @Override
    public ProgressResult getProgress(String groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        // Get last contribution date
        ContributionPage page = contributionRepository.findByGroupId(groupId, 1, null);
        String lastContributionDate = page.items().isEmpty()
                ? null
                : page.items().getFirst().getDate().toString();

        Money remaining = group.remainingAmount();

        return new ProgressResult(
                group.getGroupId(),
                group.getName(),
                group.getGoalAmount() != null ? group.getGoalAmount().toString() : null,
                group.getAccumulatedAmount().toString(),
                remaining != null ? remaining.toString() : null,
                group.progressPercent(),
                group.getTargetDate().toString(),
                group.getStatus().name(),
                group.getMemberCount(),
                lastContributionDate
        );
    }

    @Override
    public String resolve(String inviteCode) {
        if (inviteCode == null || inviteCode.isBlank()) {
            throw new InvalidInviteCodeException();
        }
        return groupRepository.findGroupIdByInviteCode(inviteCode)
                .orElseThrow(InvalidInviteCodeException::new);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String generateUniqueInviteCode() {
        // Try up to 5 times to generate a unique code
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = generateRandomCode();
            if (groupRepository.findGroupIdByInviteCode(code).isEmpty()) {
                return code;
            }
        }
        // Extremely unlikely to reach here with 8-char alphanumeric codes
        throw new IllegalStateException("Unable to generate unique invite code after 5 attempts");
    }

    private String generateRandomCode() {
        StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            sb.append(INVITE_CODE_CHARS.charAt(RANDOM.nextInt(INVITE_CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
