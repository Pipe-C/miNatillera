package com.minatillera.application.service;

import com.minatillera.domain.exception.GroupNotFoundException;
import com.minatillera.domain.model.*;
import com.minatillera.domain.port.in.LoanUseCase;
import com.minatillera.domain.port.out.GroupRepository;
import com.minatillera.domain.port.out.LoanRepository;
import com.minatillera.domain.port.out.MemberRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LoanService implements LoanUseCase {

    private final LoanRepository loanRepository;
    private final GroupRepository groupRepository;
    private final MemberRepository memberRepository;

    public LoanService(LoanRepository loanRepository, GroupRepository groupRepository,
                       MemberRepository memberRepository) {
        this.loanRepository = loanRepository;
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
    }

    @Override
    public Loan createLoan(String groupId, String memberId, BigDecimal amount, LocalDate dateIssued, String notes) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        Money loanAmount = Money.of(amount);
        Money accumulated = group.getAccumulatedAmount();

        // Calculate total outstanding balances of active loans
        Money totalOutstanding = calculateTotalOutstanding(groupId);
        Money available = accumulated.subtract(totalOutstanding);

        if (!available.isGreaterThanOrEqual(loanAmount) && !available.value().equals(loanAmount.value())) {
            // Loan exceeds available balance
            throw new InsufficientFundsException(available);
        }

        // Verify member exists
        memberRepository.findById(groupId, memberId)
                .orElseThrow(() -> new IllegalArgumentException("Miembro no encontrado."));

        String loanId = UUID.randomUUID().toString();
        Loan loan = new Loan(loanId, groupId, memberId, loanAmount, dateIssued, notes, Instant.now());
        loanRepository.saveLoan(loan);

        return loan;
    }

    @Override
    public LoanRepayment registerRepayment(String groupId, String loanId, BigDecimal amount, LocalDate date) {
        Loan loan = loanRepository.findLoanById(groupId, loanId)
                .orElseThrow(() -> new IllegalArgumentException("Préstamo no encontrado."));

        String repaymentId = UUID.randomUUID().toString();
        LoanRepayment repayment = new LoanRepayment(repaymentId, loanId, groupId, Money.of(amount), date, Instant.now());
        loanRepository.saveRepayment(repayment);

        return repayment;
    }

    @Override
    public List<LoanSummary> listLoans(String groupId) {
        groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        List<Loan> loans = loanRepository.findLoansByGroupId(groupId);
        List<LoanRepayment> allRepayments = loanRepository.findAllRepaymentsByGroupId(groupId);

        // Group repayments by loanId
        Map<String, List<LoanRepayment>> repaymentsByLoan = allRepayments.stream()
                .collect(Collectors.groupingBy(LoanRepayment::getLoanId));

        // Member name lookup
        Map<String, String> memberNames = memberRepository.findAllByGroupId(groupId).stream()
                .collect(Collectors.toMap(Member::getMemberId, Member::getName));

        return loans.stream().map(loan -> {
            List<LoanRepayment> loanRepayments = repaymentsByLoan.getOrDefault(loan.getLoanId(), List.of());
            Money totalRepaid = loanRepayments.stream()
                    .map(LoanRepayment::getAmount)
                    .reduce(Money.zero(), Money::add);
            Money outstanding = loan.getPrincipalAmount().subtract(totalRepaid);
            if (!outstanding.isPositive()) outstanding = Money.zero();

            String status = outstanding.value().compareTo(BigDecimal.ZERO) <= 0 ? "Pagado" : "Pendiente";

            List<RepaymentItem> repaymentItems = loanRepayments.stream()
                    .map(r -> new RepaymentItem(r.getRepaymentId(), r.getAmount().toString(), r.getDate().toString()))
                    .toList();

            return new LoanSummary(
                    loan.getLoanId(),
                    loan.getMemberId(),
                    memberNames.getOrDefault(loan.getMemberId(), "Desconocido"),
                    loan.getPrincipalAmount().toString(),
                    totalRepaid.toString(),
                    outstanding.toString(),
                    status,
                    loan.getDateIssued().toString(),
                    loan.getNotes(),
                    repaymentItems
            );
        }).toList();
    }

    private Money calculateTotalOutstanding(String groupId) {
        List<Loan> loans = loanRepository.findLoansByGroupId(groupId);
        List<LoanRepayment> allRepayments = loanRepository.findAllRepaymentsByGroupId(groupId);

        Map<String, Money> repaidByLoan = allRepayments.stream()
                .collect(Collectors.groupingBy(
                        LoanRepayment::getLoanId,
                        Collectors.reducing(Money.zero(), LoanRepayment::getAmount, Money::add)
                ));

        Money total = Money.zero();
        for (Loan loan : loans) {
            Money repaid = repaidByLoan.getOrDefault(loan.getLoanId(), Money.zero());
            Money outstanding = loan.getPrincipalAmount().subtract(repaid);
            if (outstanding.isPositive()) {
                total = total.add(outstanding);
            }
        }
        return total;
    }

    public static class InsufficientFundsException extends RuntimeException {
        private final Money availableBalance;

        public InsufficientFundsException(Money availableBalance) {
            super("El monto del préstamo supera el saldo disponible.");
            this.availableBalance = availableBalance;
        }

        public Money getAvailableBalance() { return availableBalance; }
    }
}
