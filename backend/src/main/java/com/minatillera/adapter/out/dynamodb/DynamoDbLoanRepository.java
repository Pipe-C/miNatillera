package com.minatillera.adapter.out.dynamodb;

import com.minatillera.domain.model.Loan;
import com.minatillera.domain.model.LoanRepayment;
import com.minatillera.domain.model.Money;
import com.minatillera.domain.port.out.LoanRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Repository
public class DynamoDbLoanRepository implements LoanRepository {

    private final DynamoDbClient dynamo;
    private final String tableName;

    public DynamoDbLoanRepository(DynamoDbClient dynamo,
                                  @Qualifier("dynamoDbTableName") String tableName) {
        this.dynamo = dynamo;
        this.tableName = tableName;
    }

    @Override
    public void saveLoan(Loan loan) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + loan.getGroupId()));
        item.put("SK", s("LOAN#" + loan.getLoanId()));
        item.put("loanId", s(loan.getLoanId()));
        item.put("groupId", s(loan.getGroupId()));
        item.put("memberId", s(loan.getMemberId()));
        item.put("principalAmount", n(loan.getPrincipalAmount().toString()));
        item.put("dateIssued", s(loan.getDateIssued().toString()));
        if (loan.getNotes() != null && !loan.getNotes().isBlank()) {
            item.put("notes", s(loan.getNotes()));
        }
        item.put("createdAt", s(loan.getCreatedAt().toString()));

        dynamo.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build());
    }

    @Override
    public Optional<Loan> findLoanById(String groupId, String loanId) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("LOAN#" + loanId)
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(mapToLoan(response.item()));
    }

    @Override
    public List<Loan> findLoansByGroupId(String groupId) {
        QueryResponse response = dynamo.query(QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("LOAN#")
                ))
                .build());

        return response.items().stream()
                .map(this::mapToLoan)
                .toList();
    }

    @Override
    public void saveRepayment(LoanRepayment repayment) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + repayment.getGroupId()));
        item.put("SK", s("REPAY#" + repayment.getLoanId() + "#" + repayment.getRepaymentId()));
        item.put("repaymentId", s(repayment.getRepaymentId()));
        item.put("loanId", s(repayment.getLoanId()));
        item.put("groupId", s(repayment.getGroupId()));
        item.put("amount", n(repayment.getAmount().toString()));
        item.put("date", s(repayment.getDate().toString()));
        item.put("createdAt", s(repayment.getCreatedAt().toString()));

        dynamo.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build());
    }

    @Override
    public List<LoanRepayment> findRepaymentsByLoanId(String groupId, String loanId) {
        QueryResponse response = dynamo.query(QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("REPAY#" + loanId + "#")
                ))
                .build());

        return response.items().stream()
                .map(this::mapToRepayment)
                .toList();
    }

    @Override
    public List<LoanRepayment> findAllRepaymentsByGroupId(String groupId) {
        QueryResponse response = dynamo.query(QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("REPAY#")
                ))
                .build());

        return response.items().stream()
                .map(this::mapToRepayment)
                .toList();
    }

    private Loan mapToLoan(Map<String, AttributeValue> item) {
        return new Loan(
                item.get("loanId").s(),
                item.get("groupId").s(),
                item.get("memberId").s(),
                Money.of(item.get("principalAmount").n()),
                LocalDate.parse(item.get("dateIssued").s()),
                item.containsKey("notes") ? item.get("notes").s() : null,
                Instant.parse(item.get("createdAt").s())
        );
    }

    private LoanRepayment mapToRepayment(Map<String, AttributeValue> item) {
        return new LoanRepayment(
                item.get("repaymentId").s(),
                item.get("loanId").s(),
                item.get("groupId").s(),
                Money.of(item.get("amount").n()),
                LocalDate.parse(item.get("date").s()),
                Instant.parse(item.get("createdAt").s())
        );
    }

    private static AttributeValue s(String val) {
        return AttributeValue.builder().s(val).build();
    }

    private static AttributeValue n(String val) {
        return AttributeValue.builder().n(val).build();
    }
}
