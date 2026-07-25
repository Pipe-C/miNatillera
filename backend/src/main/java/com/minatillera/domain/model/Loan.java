package com.minatillera.domain.model;

import java.time.Instant;
import java.time.LocalDate;

public class Loan {

    private final String loanId;
    private final String groupId;
    private final String memberId;
    private final Money principalAmount;
    private final LocalDate dateIssued;
    private final String notes;
    private final Instant createdAt;

    public Loan(String loanId, String groupId, String memberId, Money principalAmount,
                LocalDate dateIssued, String notes, Instant createdAt) {
        this.loanId = loanId;
        this.groupId = groupId;
        this.memberId = memberId;
        this.principalAmount = principalAmount;
        this.dateIssued = dateIssued;
        this.notes = notes;
        this.createdAt = createdAt;
    }

    public String getLoanId() { return loanId; }
    public String getGroupId() { return groupId; }
    public String getMemberId() { return memberId; }
    public Money getPrincipalAmount() { return principalAmount; }
    public LocalDate getDateIssued() { return dateIssued; }
    public String getNotes() { return notes; }
    public Instant getCreatedAt() { return createdAt; }
}
