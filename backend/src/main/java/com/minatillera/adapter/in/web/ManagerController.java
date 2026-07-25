package com.minatillera.adapter.in.web;

import com.minatillera.application.service.ManagerAuthService;
import com.minatillera.domain.model.Group;
import com.minatillera.domain.port.out.GroupRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/v1/groups/{groupId}/managers")
public class ManagerController {

    private final ManagerAuthService managerAuthService;
    private final GroupRepository groupRepository;

    public ManagerController(ManagerAuthService managerAuthService, GroupRepository groupRepository) {
        this.managerAuthService = managerAuthService;
        this.groupRepository = groupRepository;
    }

    @PostMapping("/invite")
    public ResponseEntity<?> createInvite(
            @PathVariable String groupId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        String inviteToken = managerAuthService.createInvite(groupId);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "inviteToken", inviteToken
        ));
    }

    @PostMapping("/accept")
    public ResponseEntity<?> acceptInvite(
            @PathVariable String groupId,
            @Valid @RequestBody AcceptInviteRequest request) {

        Optional<String> managerToken = managerAuthService.acceptInvite(groupId, request.inviteToken(), request.name());

        if (managerToken.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", Map.of("code", "INVALID_INVITE", "message", "Invitación inválida, expirada o ya usada.")
            ));
        }

        // Return the group's invite code so the co-manager can access data
        String inviteCode = groupRepository.findById(groupId)
                .map(Group::getInviteCode)
                .orElse("");

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "managerToken", managerToken.get(),
                "inviteCode", inviteCode,
                "message", "Co-gestor registrado exitosamente."
        ));
    }

    @GetMapping("/verify")
    public ResponseEntity<?> verifyManager(
            @PathVariable String groupId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken) {

        var managerInfo = managerAuthService.verifyAndGetInfo(groupId, managerToken);
        if (managerInfo.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Token inválido.")));
        }

        var info = managerInfo.get();
        String groupName = groupRepository.findById(groupId)
                .map(Group::getName).orElse("");
        String inviteCode = groupRepository.findById(groupId)
                .map(Group::getInviteCode).orElse("");

        return ResponseEntity.ok(Map.of(
                "name", info.getName(),
                "isOwner", info.isOwner(),
                "groupId", groupId,
                "groupName", groupName,
                "inviteCode", inviteCode
        ));
    }

    public record AcceptInviteRequest(
            @NotBlank String inviteToken,
            @NotBlank String name
    ) {}
}
