package com.minatillera.adapter.out.dynamodb;

import com.minatillera.domain.model.Contribution;
import com.minatillera.domain.model.Money;
import com.minatillera.domain.port.out.ContributionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Repository
public class DynamoDbContributionRepository implements ContributionRepository {

    private static final Logger log = LoggerFactory.getLogger(DynamoDbContributionRepository.class);
    private static final long IDEMPOTENCY_TTL_HOURS = 48;

    private final DynamoDbClient dynamo;
    private final String tableName;

    public DynamoDbContributionRepository(DynamoDbClient dynamo,
                                          @Qualifier("dynamoDbTableName") String tableName) {
        this.dynamo = dynamo;
        this.tableName = tableName;
    }

    @Override
    public boolean saveWithIdempotency(Contribution contribution, String responseJson) {
        // Build contribution item
        Map<String, AttributeValue> contribItem = new HashMap<>();
        contribItem.put("PK", s("GROUP#" + contribution.getGroupId()));
        contribItem.put("SK", s("CONTRIBUTION#" + contribution.getCreatedAt().toString() + "#" + contribution.getContributionId()));
        contribItem.put("contributionId", s(contribution.getContributionId()));
        contribItem.put("groupId", s(contribution.getGroupId()));
        contribItem.put("memberId", s(contribution.getMemberId()));
        contribItem.put("amount", s(contribution.getAmount().toString()));
        contribItem.put("date", s(contribution.getDate().toString()));
        contribItem.put("idempotencyKey", s(contribution.getIdempotencyKey()));
        contribItem.put("createdAt", s(contribution.getCreatedAt().toString()));
        if (contribution.getReceiptImageUrl() != null && !contribution.getReceiptImageUrl().isBlank()) {
            contribItem.put("receiptImageUrl", s(contribution.getReceiptImageUrl()));
        }

        // Build idempotency item with TTL
        long ttlEpoch = Instant.now().plus(IDEMPOTENCY_TTL_HOURS, ChronoUnit.HOURS).getEpochSecond();
        Map<String, AttributeValue> idempotencyItem = new HashMap<>();
        idempotencyItem.put("PK", s("IDEMPOTENCY#" + contribution.getGroupId() + "#" + contribution.getIdempotencyKey()));
        idempotencyItem.put("SK", s("RESULT"));
        idempotencyItem.put("responseBody", s(responseJson));
        idempotencyItem.put("ttl", n(String.valueOf(ttlEpoch)));

        try {
            // Use TransactWriteItems: contribution + idempotency record
            // The idempotency item uses attribute_not_exists as the duplicate guard
            dynamo.transactWriteItems(TransactWriteItemsRequest.builder()
                    .transactItems(
                            TransactWriteItem.builder()
                                    .put(Put.builder()
                                            .tableName(tableName)
                                            .item(contribItem)
                                            .build())
                                    .build(),
                            TransactWriteItem.builder()
                                    .put(Put.builder()
                                            .tableName(tableName)
                                            .item(idempotencyItem)
                                            .conditionExpression("attribute_not_exists(PK)")
                                            .build())
                                    .build()
                    )
                    .build());

            log.debug("Contribution saved: {}", contribution.getContributionId());
            return true;

        } catch (TransactionCanceledException e) {
            // Check if the idempotency condition failed (second item)
            List<CancellationReason> reasons = e.cancellationReasons();
            if (reasons.size() >= 2 && "ConditionalCheckFailed".equals(reasons.get(1).code())) {
                log.debug("Idempotent duplicate detected for key: {}", contribution.getIdempotencyKey());
                return false;
            }
            throw e;
        }
    }

    @Override
    public Optional<String> findIdempotencyResult(String groupId, String idempotencyKey) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("IDEMPOTENCY#" + groupId + "#" + idempotencyKey),
                        "SK", s("RESULT")
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(response.item().get("responseBody").s());
    }

    @Override
    public ContributionPage findByGroupId(String groupId, int limit, String lastKey) {
        QueryRequest.Builder queryBuilder = QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("CONTRIBUTION#")
                ))
                .scanIndexForward(false) // Most recent first
                .limit(limit);

        if (lastKey != null && !lastKey.isBlank()) {
            queryBuilder.exclusiveStartKey(deserializeLastKey(lastKey, groupId));
        }

        QueryResponse response = dynamo.query(queryBuilder.build());

        List<Contribution> contributions = response.items().stream()
                .map(this::mapToContribution)
                .toList();

        String nextKey = null;
        if (response.hasLastEvaluatedKey() && !response.lastEvaluatedKey().isEmpty()) {
            nextKey = serializeLastKey(response.lastEvaluatedKey());
        }

        return new ContributionPage(contributions, nextKey);
    }

    private Contribution mapToContribution(Map<String, AttributeValue> item) {
        String receiptUrl = item.containsKey("receiptImageUrl") ? item.get("receiptImageUrl").s() : null;
        return new Contribution(
                item.get("contributionId").s(),
                item.get("groupId").s(),
                item.get("memberId").s(),
                Money.of(item.get("amount").s()),
                LocalDate.parse(item.get("date").s()),
                item.get("idempotencyKey").s(),
                receiptUrl,
                Instant.parse(item.get("createdAt").s())
        );
    }

    /**
     * Serializes DynamoDB LastEvaluatedKey to an opaque pagination token.
     * Uses the SK value which is unique and sufficient to resume.
     */
    private String serializeLastKey(Map<String, AttributeValue> lastEvaluatedKey) {
        return Base64.getEncoder().encodeToString(
                lastEvaluatedKey.get("SK").s().getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
    }

    private Map<String, AttributeValue> deserializeLastKey(String token, String groupId) {
        String sk = new String(
                Base64.getDecoder().decode(token),
                java.nio.charset.StandardCharsets.UTF_8
        );
        return Map.of(
                "PK", s("GROUP#" + groupId),
                "SK", s(sk)
        );
    }

    private static AttributeValue s(String val) {
        return AttributeValue.builder().s(val).build();
    }

    private static AttributeValue n(String val) {
        return AttributeValue.builder().n(val).build();
    }

    @Override
    public void delete(String groupId, String contributionId) {
        ContributionPage page = findByGroupId(groupId, 100, null);
        page.items().stream()
                .filter(c -> c.getContributionId().equals(contributionId))
                .findFirst()
                .ifPresent(c -> {
                    String sk = "CONTRIBUTION#" + c.getCreatedAt().toString() + "#" + c.getContributionId();
                    dynamo.deleteItem(DeleteItemRequest.builder()
                            .tableName(tableName)
                            .key(Map.of("PK", s("GROUP#" + groupId), "SK", s(sk)))
                            .build());
                });
    }

    @Override
    public void deleteAllByMemberId(String groupId, String memberId) {
        ContributionPage page = findByGroupId(groupId, 200, null);
        page.items().stream()
                .filter(c -> c.getMemberId().equals(memberId))
                .forEach(c -> {
                    String sk = "CONTRIBUTION#" + c.getCreatedAt().toString() + "#" + c.getContributionId();
                    dynamo.deleteItem(DeleteItemRequest.builder()
                            .tableName(tableName)
                            .key(Map.of("PK", s("GROUP#" + groupId), "SK", s(sk)))
                            .build());
                });
    }

    @Override
    public void update(String groupId, String contributionId, String amount, String date, String receiptImageUrl) {
        ContributionPage page = findByGroupId(groupId, 200, null);
        page.items().stream()
                .filter(c -> c.getContributionId().equals(contributionId))
                .findFirst()
                .ifPresent(c -> {
                    String sk = "CONTRIBUTION#" + c.getCreatedAt().toString() + "#" + c.getContributionId();
                    var updateBuilder = UpdateItemRequest.builder()
                            .tableName(tableName)
                            .key(Map.of("PK", s("GROUP#" + groupId), "SK", s(sk)))
                            .updateExpression("SET amount = :amt, #d = :dt" + (receiptImageUrl != null ? ", receiptImageUrl = :url" : ""))
                            .expressionAttributeNames(Map.of("#d", "date"));
                    var values = new HashMap<String, AttributeValue>();
                    values.put(":amt", s(amount));
                    values.put(":dt", s(date));
                    if (receiptImageUrl != null) values.put(":url", s(receiptImageUrl));
                    updateBuilder.expressionAttributeValues(values);
                    dynamo.updateItem(updateBuilder.build());
                });
    }
}
