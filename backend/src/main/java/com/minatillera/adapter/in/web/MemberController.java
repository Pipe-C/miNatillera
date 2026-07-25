package com.minatillera.adapter.in.web;

import com.minatillera.adapter.in.web.dto.AddMemberRequest;
import com.minatillera.adapter.in.web.dto.AddMemberResponse;
import com.minatillera.adapter.in.web.dto.MemberListResponse;
import com.minatillera.adapter.in.web.dto.MemberListResponse.MemberItem;
import com.minatillera.application.service.ManagerAuthService;
import com.minatillera.domain.model.Member;
import com.minatillera.domain.port.in.AddMemberUseCase;
import com.minatillera.domain.port.in.ListContributionsUseCase;
import com.minatillera.domain.port.in.ListMembersUseCase;
import com.minatillera.domain.port.out.ContributionRepository;
import com.minatillera.domain.port.out.MemberRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1/groups/{groupId}/members")
public class MemberController {

    private final AddMemberUseCase addMemberUseCase;
    private final ListMembersUseCase listMembersUseCase;
    private final ManagerAuthService managerAuthService;
    private final MemberRepository memberRepository;
    private final ContributionRepository contributionRepository;

    public MemberController(AddMemberUseCase addMemberUseCase,
                            ListMembersUseCase listMembersUseCase,
                            ManagerAuthService managerAuthService,
                            MemberRepository memberRepository,
                            ContributionRepository contributionRepository) {
        this.addMemberUseCase = addMemberUseCase;
        this.listMembersUseCase = listMembersUseCase;
        this.managerAuthService = managerAuthService;
        this.memberRepository = memberRepository;
        this.contributionRepository = contributionRepository;
    }

    @PostMapping
    public ResponseEntity<?> addMember(
            @PathVariable String groupId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @Valid @RequestBody AddMemberRequest request) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        Member member = addMemberUseCase.addMember(groupId, request.name());

        AddMemberResponse response = new AddMemberResponse(
                member.getMemberId(),
                member.getName(),
                member.getGroupId(),
                member.getJoinedAt().toString()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<MemberListResponse> listMembers(@PathVariable String groupId) {
        List<Member> members = listMembersUseCase.listMembers(groupId);

        List<MemberItem> items = members.stream()
                .map(m -> new MemberItem(m.getMemberId(), m.getName(), m.isOwner(), m.isManager(), m.getJoinedAt().toString()))
                .toList();

        return ResponseEntity.ok(new MemberListResponse(groupId, items));
    }

    @PutMapping("/{memberId}")
    public ResponseEntity<?> updateMember(
            @PathVariable String groupId,
            @PathVariable String memberId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @Valid @RequestBody UpdateMemberRequest request) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        memberRepository.updateName(groupId, memberId, request.name());
        return ResponseEntity.ok(Map.of("memberId", memberId, "name", request.name()));
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<?> removeMember(
            @PathVariable String groupId,
            @PathVariable String memberId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @RequestParam(defaultValue = "false") boolean deleteContributions) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        // Optionally delete all contributions by this member
        if (deleteContributions) {
            contributionRepository.deleteAllByMemberId(groupId, memberId);
        }

        // Remove Manager record (revokes co-gestor access)
        managerAuthService.removeManagerByMemberId(groupId, memberId);
        memberRepository.delete(groupId, memberId);
        return ResponseEntity.noContent().build();
    }

    public record UpdateMemberRequest(@NotBlank String name) {}
}
