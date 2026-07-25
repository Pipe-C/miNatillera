package com.minatillera.domain.model;

import java.time.Instant;

public class ManagerInvite {

    private final String inviteId;
    private final String groupId;
    private final String tokenHash;
    private final boolean used;
    private final Instant expiresAt;
    private final Instant createdAt;

    public ManagerInvite(String inviteId, String groupId, String tokenHash,
                         boolean used, Instant expiresAt, Instant createdAt) {
        this.inviteId = inviteId;
        this.groupId = groupId;
        this.tokenHash = tokenHash;
        this.used = used;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public String getInviteId() { return inviteId; }
    public String getGroupId() { return groupId; }
    public String getTokenHash() { return tokenHash; }
    public boolean isUsed() { return used; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getCreatedAt() { return createdAt; }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isValid() {
        return !used && !isExpired();
    }
}
