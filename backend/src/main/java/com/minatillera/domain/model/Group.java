package com.minatillera.domain.model;

import java.time.Instant;
import java.time.LocalDate;

public class Group {

    private final String groupId;
    private final String name;
    private final Money goalAmount; // nullable — no goal defined
    private Money accumulatedAmount;
    private final LocalDate targetDate;
    private GroupStatus status;
    private final String inviteCode;
    private int memberCount;
    private final Instant createdAt;
    private Instant updatedAt;

    public Group(String groupId, String name, Money goalAmount, Money accumulatedAmount,
                 LocalDate targetDate, GroupStatus status, String inviteCode,
                 int memberCount, Instant createdAt, Instant updatedAt) {
        this.groupId = groupId;
        this.name = name;
        this.goalAmount = goalAmount;
        this.accumulatedAmount = accumulatedAmount;
        this.targetDate = targetDate;
        this.status = status;
        this.inviteCode = inviteCode;
        this.memberCount = memberCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public boolean isCompleted() {
        return status == GroupStatus.COMPLETADO;
    }

    public boolean hasReachedGoal() {
        if (goalAmount == null) return false;
        return accumulatedAmount.isGreaterThanOrEqual(goalAmount);
    }

    public boolean canAddMember() {
        return memberCount < 50;
    }

    public int progressPercent() {
        if (goalAmount == null) return 0;
        return accumulatedAmount.percentOf(goalAmount);
    }

    public Money remainingAmount() {
        if (goalAmount == null) return null;
        Money diff = goalAmount.subtract(accumulatedAmount);
        return diff.isPositive() ? diff : Money.zero();
    }

    public boolean hasGoal() {
        return goalAmount != null;
    }

    public void markCompleted() {
        this.status = GroupStatus.COMPLETADO;
        this.updatedAt = Instant.now();
    }

    public void incrementMemberCount() {
        this.memberCount++;
        this.updatedAt = Instant.now();
    }

    // Getters
    public String getGroupId() { return groupId; }
    public String getName() { return name; }
    public Money getGoalAmount() { return goalAmount; }
    public Money getAccumulatedAmount() { return accumulatedAmount; }
    public LocalDate getTargetDate() { return targetDate; }
    public GroupStatus getStatus() { return status; }
    public String getInviteCode() { return inviteCode; }
    public int getMemberCount() { return memberCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
