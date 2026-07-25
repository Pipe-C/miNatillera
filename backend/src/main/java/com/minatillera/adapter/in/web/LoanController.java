package com.minatillera.adapter.in.web;

import com.minatillera.adapter.in.web.dto.CreateLoanRequest;
import com.minatillera.adapter.in.web.dto.CreateRepaymentRequest;
import com.minatillera.application.service.LoanService;
import com.minatillera.application.service.ManagerAuthService;
import com.minatillera.domain.model.Loan;
import com.minatillera.domain.model.LoanRepayment;
import com.minatillera.domain.port.in.LoanUseCase;
import com.minatillera.domain.port.in.LoanUseCase.LoanSummary;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/v1/groups/{groupId}/loans")
public class LoanController {

    private final LoanUseCase loanUseCase;
    private final ManagerAuthService managerAuthService;

    public LoanController(LoanUseCase loanUseCase, ManagerAuthService managerAuthService) {
        this.loanUseCase = loanUseCase;
        this.managerAuthService = managerAuthService;
    }

    @PostMapping
    public ResponseEntity<?> createLoan(
            @PathVariable String groupId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @Valid @RequestBody CreateLoanRequest request) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        try {
            Loan loan = loanUseCase.createLoan(
                    groupId, request.memberId(), request.amount(), request.dateIssued(), request.notes());

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "loanId", loan.getLoanId(),
                    "groupId", loan.getGroupId(),
                    "memberId", loan.getMemberId(),
                    "principalAmount", loan.getPrincipalAmount().toString(),
                    "dateIssued", loan.getDateIssued().toString(),
                    "notes", loan.getNotes() != null ? loan.getNotes() : ""
            ));
        } catch (LoanService.InsufficientFundsException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", Map.of(
                            "code", "INSUFFICIENT_FUNDS",
                            "message", e.getMessage(),
                            "availableBalance", e.getAvailableBalance().toString()
                    )
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", Map.of("code", "INVALID_REQUEST", "message", e.getMessage())
            ));
        }
    }

    @PostMapping("/{loanId}/repayments")
    public ResponseEntity<?> registerRepayment(
            @PathVariable String groupId,
            @PathVariable String loanId,
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @Valid @RequestBody CreateRepaymentRequest request) {

        if (!managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        try {
            LoanRepayment repayment = loanUseCase.registerRepayment(groupId, loanId, request.amount(), request.date());

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "repaymentId", repayment.getRepaymentId(),
                    "loanId", repayment.getLoanId(),
                    "amount", repayment.getAmount().toString(),
                    "date", repayment.getDate().toString()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", Map.of("code", "INVALID_REQUEST", "message", e.getMessage())
            ));
        }
    }

    @GetMapping
    public ResponseEntity<List<LoanSummary>> listLoans(@PathVariable String groupId) {
        List<LoanSummary> loans = loanUseCase.listLoans(groupId);
        return ResponseEntity.ok(loans);
    }
}
