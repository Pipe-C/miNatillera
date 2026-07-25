package com.minatillera.domain.model;

import java.time.Instant;
import java.time.LocalDate;

public class LoanRepayment {

    private final String repaymentId;
    private final String loanId;
    private final String groupId;
    private final Money amount;
    private final LocalDate date;
    private final Instant createdAt;

    public LoanRepayment(String repaymentId, String loanId, String groupId,
                         Money amount, LocalDate date, Instant createdAt) {
        this.repaymentId = repaymentId;
        this.loanId = loanId;
        this.groupId = groupId;
        this.amount = amount;
        this.date = date;
        this.createdAt = createdAt;
    }

    public String getRepaymentId() { return repaymentId; }
    public String getLoanId() { return loanId; }
    public String getGroupId() { return groupId; }
    public Money getAmount() { return amount; }
    public LocalDate getDate() { return date; }
    public Instant getCreatedAt() { return createdAt; }
}
