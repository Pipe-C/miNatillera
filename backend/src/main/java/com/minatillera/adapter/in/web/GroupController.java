package com.minatillera.adapter.in.web;

import com.minatillera.adapter.in.web.dto.CreateGroupRequest;
import com.minatillera.adapter.in.web.dto.CreateGroupResponse;
import com.minatillera.domain.model.Group;
import com.minatillera.domain.port.in.CreateGroupUseCase;
import com.minatillera.domain.port.in.CreateGroupUseCase.CreateResult;
import com.minatillera.domain.port.in.GetProgressUseCase;
import com.minatillera.domain.port.in.GetProgressUseCase.ProgressResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/groups")
public class GroupController {

    private final CreateGroupUseCase createGroupUseCase;
    private final GetProgressUseCase getProgressUseCase;

    public GroupController(CreateGroupUseCase createGroupUseCase,
                           GetProgressUseCase getProgressUseCase) {
        this.createGroupUseCase = createGroupUseCase;
        this.getProgressUseCase = getProgressUseCase;
    }

    @PostMapping
    public ResponseEntity<CreateGroupResponse> createGroup(@Valid @RequestBody CreateGroupRequest request) {
        CreateResult result = createGroupUseCase.create(
                request.name(),
                request.goalAmount(),
                request.targetDate(),
                request.creatorName()
        );

        Group group = result.group();
        CreateGroupResponse response = new CreateGroupResponse(
                group.getGroupId(),
                group.getInviteCode(),
                result.creatorToken(),
                group.getName(),
                group.getGoalAmount() != null ? group.getGoalAmount().toString() : null,
                group.getTargetDate().toString(),
                group.getStatus().name(),
                group.getCreatedAt().toString()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{groupId}/progress")
    public ResponseEntity<ProgressResult> getProgress(@PathVariable String groupId) {
        ProgressResult result = getProgressUseCase.getProgress(groupId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/lookup")
    public ResponseEntity<Map<String, String>> lookupByInviteCode(HttpServletRequest request) {
        // The InviteCodeInterceptor already resolved the code and stored the groupId
        String groupId = (String) request.getAttribute("resolvedGroupId");
        if (groupId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid invite code"));
        }
        return ResponseEntity.ok(Map.of("groupId", groupId));
    }
}
