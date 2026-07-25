package com.minatillera.domain.port.in;

import com.minatillera.domain.model.Loan;
import com.minatillera.domain.model.LoanRepayment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface LoanUseCase {

    Loan createLoan(String groupId, String memberId, BigDecimal amount, LocalDate dateIssued, String notes);

    LoanRepayment registerRepayment(String groupId, String loanId, BigDecimal amount, LocalDate date);

    List<LoanSummary> listLoans(String groupId);

    record LoanSummary(
            String loanId,
            String memberId,
            String memberName,
            String principalAmount,
            String totalRepaid,
            String outstandingBalance,
            String status,
            String dateIssued,
            String notes,
            List<RepaymentItem> repayments
    ) {}

    record RepaymentItem(String repaymentId, String amount, String date) {}
}
