package com.minatillera.domain.port.out;

import com.minatillera.domain.model.Loan;
import com.minatillera.domain.model.LoanRepayment;

import java.util.List;
import java.util.Optional;

public interface LoanRepository {

    void saveLoan(Loan loan);

    Optional<Loan> findLoanById(String groupId, String loanId);

    List<Loan> findLoansByGroupId(String groupId);

    void saveRepayment(LoanRepayment repayment);

    List<LoanRepayment> findRepaymentsByLoanId(String groupId, String loanId);

    List<LoanRepayment> findAllRepaymentsByGroupId(String groupId);
}
