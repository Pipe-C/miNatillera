package com.minatillera.domain.model;

import java.time.Instant;

public class Manager {

    private final String managerId;
    private final String groupId;
    private final String name;
    private final String tokenHash;
    private final boolean isOwner;
    private final Instant addedAt;

    public Manager(String managerId, String groupId, String name, String tokenHash,
                   boolean isOwner, Instant addedAt) {
        this.managerId = managerId;
        this.groupId = groupId;
        this.name = name;
        this.tokenHash = tokenHash;
        this.isOwner = isOwner;
        this.addedAt = addedAt;
    }

    public String getManagerId() { return managerId; }
    public String getGroupId() { return groupId; }
    public String getName() { return name; }
    public String getTokenHash() { return tokenHash; }
    public boolean isOwner() { return isOwner; }
    public Instant getAddedAt() { return addedAt; }
}
