package com.minatillera.adapter.in.web;

import com.minatillera.adapter.in.web.dto.ContributionListResponse;
import com.minatillera.adapter.in.web.dto.ContributionListResponse.ContributionItem;
import com.minatillera.adapter.in.web.dto.RegisterContributionRequest;
import com.minatillera.application.service.ManagerAuthService;
import com.minatillera.domain.model.Member;
import com.minatillera.domain.port.in.ListContributionsUseCase;
import com.minatillera.domain.port.in.ListMembersUseCase;
import com.minatillera.domain.port.in.RegisterContributionUseCase;
import com.minatillera.domain.port.in.RegisterContributionUseCase.ContributionResult;
import com.minatillera.domain.port.out.ContributionRepository.ContributionPage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/v1/groups/{groupId}/contributions")
public class ContributionController {

    private final RegisterContributionUseCase registerContributionUseCase;
    private final ListContributionsUseCase listContributionsUseCase;
    private final ListMembersUseCase listMembersUseCase;
    private final ManagerAuthService managerAuthService;

    public ContributionController(RegisterContributionUseCase registerContributionUseCase,
                                  ListContributionsUseCase listContributionsUseCase,
                                  ListMembersUseCase listMembersUseCase,
                                  ManagerAuthService managerAuthService) {
        this.registerContributionUseCase = registerContributionUseCase;
        this.listContributionsUseCase = listContributionsUseCase;
        this.listMembersUseCase = listMembersUseCase;
        this.managerAuthService = managerAuthService;
    }

    @PostMapping
    public ResponseEntity<?> register(
            @PathVariable String groupId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @Valid @RequestBody RegisterContributionRequest request) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        // Validate date is not more than 24h in the future
        LocalDate maxDate = LocalDateTime.now(ZoneOffset.UTC).plusHours(24).toLocalDate();
        if (request.date().isAfter(maxDate)) {
            return ResponseEntity.badRequest().build();
        }

        ContributionResult result = registerContributionUseCase.register(
                groupId,
                request.memberId(),
                request.amount(),
                request.date(),
                request.idempotencyKey(),
                request.receiptImageUrl()
        );

        HttpStatus status = result.idempotent() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(result);
    }

    @GetMapping
    public ResponseEntity<ContributionListResponse> list(
            @PathVariable String groupId,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int limit,
            @RequestParam(required = false) String lastKey) {

        ContributionPage page = listContributionsUseCase.list(groupId, limit, lastKey);

        // Enrich with member names
        Map<String, String> memberNames = listMembersUseCase.listMembers(groupId).stream()
                .collect(Collectors.toMap(Member::getMemberId, Member::getName));

        List<ContributionItem> items = page.items().stream()
                .map(c -> new ContributionItem(
                        c.getContributionId(),
                        c.getMemberId(),
                        memberNames.getOrDefault(c.getMemberId(), "Desconocido"),
                        c.getAmount().toString(),
                        c.getDate().toString(),
                        c.getCreatedAt().toString(),
                        c.getReceiptImageUrl()
                ))
                .toList();

        return ResponseEntity.ok(new ContributionListResponse(groupId, items, page.nextKey()));
    }

    @DeleteMapping("/{contributionId}")
    public ResponseEntity<?> deleteContribution(
            @PathVariable String groupId,
            @PathVariable String contributionId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        listContributionsUseCase.deleteContribution(groupId, contributionId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{contributionId}")
    public ResponseEntity<?> updateContribution(
            @PathVariable String groupId,
            @PathVariable String contributionId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @Valid @RequestBody UpdateContributionRequest request) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        listContributionsUseCase.updateContribution(groupId, contributionId, request.amount(), request.date(), request.receiptImageUrl());
        return ResponseEntity.ok(Map.of("contributionId", contributionId, "updated", true));
    }

    public record UpdateContributionRequest(
            @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("0.01") java.math.BigDecimal amount,
            @jakarta.validation.constraints.NotNull LocalDate date,
            String receiptImageUrl
    ) {}
}
