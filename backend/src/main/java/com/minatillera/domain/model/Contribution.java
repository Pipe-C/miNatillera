package com.minatillera.domain.model;

import java.time.Instant;
import java.time.LocalDate;

public class Contribution {

    private final String contributionId;
    private final String groupId;
    private final String memberId;
    private final Money amount;
    private final LocalDate date;
    private final String idempotencyKey;
    private final String receiptImageUrl;
    private final Instant createdAt;

    public Contribution(String contributionId, String groupId, String memberId,
                        Money amount, LocalDate date, String idempotencyKey,
                        String receiptImageUrl, Instant createdAt) {
        this.contributionId = contributionId;
        this.groupId = groupId;
        this.memberId = memberId;
        this.amount = amount;
        this.date = date;
        this.idempotencyKey = idempotencyKey;
        this.receiptImageUrl = receiptImageUrl;
        this.createdAt = createdAt;
    }

    public String getContributionId() { return contributionId; }
    public String getGroupId() { return groupId; }
    public String getMemberId() { return memberId; }
    public Money getAmount() { return amount; }
    public LocalDate getDate() { return date; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getReceiptImageUrl() { return receiptImageUrl; }
    public Instant getCreatedAt() { return createdAt; }
}
