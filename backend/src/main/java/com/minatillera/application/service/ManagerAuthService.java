package com.minatillera.application.service;

import com.minatillera.domain.model.Manager;
import com.minatillera.domain.model.ManagerInvite;
import com.minatillera.domain.model.Member;
import com.minatillera.domain.port.out.GroupRepository;
import com.minatillera.domain.port.out.ManagerRepository;
import com.minatillera.domain.port.out.MemberRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Shared service for manager token validation and invite management.
 */
@Service
public class ManagerAuthService {

    private final ManagerRepository managerRepository;
    private final MemberRepository memberRepository;
    private final GroupRepository groupRepository;

    public ManagerAuthService(ManagerRepository managerRepository,
                              MemberRepository memberRepository,
                              GroupRepository groupRepository) {
        this.managerRepository = managerRepository;
        this.memberRepository = memberRepository;
        this.groupRepository = groupRepository;
    }

    /**
     * Validates a manager token against all managers of a group.
     * Returns true if the token matches any manager's hash.
     */
    public boolean isValidManagerToken(String groupId, String token) {
        if (token == null || token.isBlank()) return false;
        String hash = hashToken(token);
        List<Manager> managers = managerRepository.findManagersByGroupId(groupId);
        return managers.stream().anyMatch(m -> m.getTokenHash().equals(hash));
    }

    /**
     * Verifies token and returns the matching Manager info (read-only, no side effects).
     */
    public Optional<Manager> verifyAndGetInfo(String groupId, String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        String hash = hashToken(token);
        List<Manager> managers = managerRepository.findManagersByGroupId(groupId);
        return managers.stream().filter(m -> m.getTokenHash().equals(hash)).findFirst();
    }

    /**
     * Creates a one-time-use invite token for a new co-manager, valid for 24h.
     */
    public String createInvite(String groupId) {
        String inviteId = UUID.randomUUID().toString();
        String inviteToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(inviteToken);
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(86400); // 24h

        ManagerInvite invite = new ManagerInvite(inviteId, groupId, tokenHash, false, expiresAt, now);
        managerRepository.saveInvite(invite);

        // Return composite: inviteId + token separated by dot
        return inviteId + "." + inviteToken;
    }

    /**
     * Accepts an invite, creating a new Manager. Returns the new manager token or empty if invalid.
     */
    public Optional<String> acceptInvite(String groupId, String inviteToken, String name) {
        // Parse inviteId.token format
        int dotIdx = inviteToken.indexOf('.');
        if (dotIdx < 0) return Optional.empty();

        String inviteId = inviteToken.substring(0, dotIdx);
        String rawToken = inviteToken.substring(dotIdx + 1);

        Optional<ManagerInvite> optInvite = managerRepository.findInviteById(groupId, inviteId);
        if (optInvite.isEmpty()) return Optional.empty();

        ManagerInvite invite = optInvite.get();
        if (!invite.isValid()) return Optional.empty();

        // Validate invite token hash
        String providedHash = hashToken(rawToken);
        if (!invite.getTokenHash().equals(providedHash)) return Optional.empty();

        // Mark invite as used
        managerRepository.markInviteUsed(groupId, inviteId);

        // Create new manager
        String managerId = UUID.randomUUID().toString();
        String newManagerToken = UUID.randomUUID().toString();
        String newTokenHash = hashToken(newManagerToken);
        Manager newManager = new Manager(managerId, groupId, name, newTokenHash, false, Instant.now());
        managerRepository.saveManager(newManager);

        // Also register as a member of the group
        String memberId = UUID.randomUUID().toString();
        Member member = new Member(memberId, groupId, name, false, true, Instant.now());
        memberRepository.save(member);
        groupRepository.incrementMemberCount(groupId);

        return Optional.of(newManagerToken);
    }

    public List<Manager> getManagers(String groupId) {
        return managerRepository.findManagersByGroupId(groupId);
    }

    /**
     * Removes a manager whose associated member is being deleted.
     * Matches by name since Manager and Member share the same name.
     */
    public void removeManagerByMemberId(String groupId, String memberId) {
        // Find the member name to match against managers
        var member = memberRepository.findById(groupId, memberId);
        if (member.isEmpty()) return;

        String name = member.get().getName();
        List<Manager> managers = managerRepository.findManagersByGroupId(groupId);
        managers.stream()
                .filter(m -> m.getName().equals(name) && !m.isOwner())
                .findFirst()
                .ifPresent(m -> managerRepository.deleteManager(groupId, m.getManagerId()));
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
