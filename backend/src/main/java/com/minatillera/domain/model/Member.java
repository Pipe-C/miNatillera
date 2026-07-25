package com.minatillera.domain.model;

import java.time.Instant;

public class Member {

    private final String memberId;
    private final String groupId;
    private final String name;
    private final boolean isOwner;
    private final boolean isManager;
    private final Instant joinedAt;

    public Member(String memberId, String groupId, String name, boolean isOwner, boolean isManager, Instant joinedAt) {
        this.memberId = memberId;
        this.groupId = groupId;
        this.name = name;
        this.isOwner = isOwner;
        this.isManager = isManager;
        this.joinedAt = joinedAt;
    }

    public String getMemberId() { return memberId; }
    public String getGroupId() { return groupId; }
    public String getName() { return name; }
    public boolean isOwner() { return isOwner; }
    public boolean isManager() { return isManager; }
    public Instant getJoinedAt() { return joinedAt; }
}
