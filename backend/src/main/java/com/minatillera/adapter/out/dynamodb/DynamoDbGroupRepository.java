package com.minatillera.adapter.out.dynamodb;

import com.minatillera.domain.model.Group;
import com.minatillera.domain.model.GroupStatus;
import com.minatillera.domain.model.Money;
import com.minatillera.domain.port.out.GroupRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Repository
public class DynamoDbGroupRepository implements GroupRepository {

    private static final Logger log = LoggerFactory.getLogger(DynamoDbGroupRepository.class);

    private final DynamoDbClient dynamo;
    private final String tableName;

    public DynamoDbGroupRepository(DynamoDbClient dynamo,
                                   @Qualifier("dynamoDbTableName") String tableName) {
        this.dynamo = dynamo;
        this.tableName = tableName;
    }

    @Override
    public void save(Group group) {
        Map<String, AttributeValue> groupItem = new HashMap<>();
        groupItem.put("PK", s("GROUP#" + group.getGroupId()));
        groupItem.put("SK", s("METADATA"));
        groupItem.put("groupId", s(group.getGroupId()));
        groupItem.put("name", s(group.getName()));
        if (group.getGoalAmount() != null) {
            groupItem.put("goalAmount", s(group.getGoalAmount().toString()));
        }
        groupItem.put("accumulatedAmount", n(group.getAccumulatedAmount().toString()));
        groupItem.put("targetDate", s(group.getTargetDate().toString()));
        groupItem.put("status", s(group.getStatus().name()));
        groupItem.put("inviteCode", s(group.getInviteCode()));
        groupItem.put("memberCount", n(group.getMemberCount()));
        groupItem.put("createdAt", s(group.getCreatedAt().toString()));
        groupItem.put("updatedAt", s(group.getUpdatedAt().toString()));

        Map<String, AttributeValue> inviteItem = new HashMap<>();
        inviteItem.put("PK", s("INVITE#" + group.getInviteCode()));
        inviteItem.put("SK", s("LOOKUP"));
        inviteItem.put("groupId", s(group.getGroupId()));

        TransactWriteItemsRequest tx = TransactWriteItemsRequest.builder()
                .transactItems(
                        TransactWriteItem.builder()
                                .put(Put.builder()
                                        .tableName(tableName)
                                        .item(groupItem)
                                        .conditionExpression("attribute_not_exists(PK)")
                                        .build())
                                .build(),
                        TransactWriteItem.builder()
                                .put(Put.builder()
                                        .tableName(tableName)
                                        .item(inviteItem)
                                        .conditionExpression("attribute_not_exists(PK)")
                                        .build())
                                .build()
                )
                .build();

        dynamo.transactWriteItems(tx);
        log.debug("Group saved: {}", group.getGroupId());
    }

    @Override
    public Optional<Group> findById(String groupId) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("METADATA")
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapToGroup(response.item()));
    }

    @Override
    public Optional<String> findGroupIdByInviteCode(String inviteCode) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("INVITE#" + inviteCode),
                        "SK", s("LOOKUP")
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(response.item().get("groupId").s());
    }

    @Override
    public Money addToAccumulatedAmount(String groupId, Money amountToAdd, Money goalAmount) {
        // Atomic ADD — never read-modify-write
        Map<String, AttributeValue> key = Map.of(
                "PK", s("GROUP#" + groupId),
                "SK", s("METADATA")
        );

        // Step 1: Atomically add the amount
        UpdateItemResponse updateResponse = dynamo.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(key)
                .updateExpression("SET updatedAt = :now ADD accumulatedAmount :amt")
                .expressionAttributeValues(Map.of(
                        ":amt", n(amountToAdd.toString()),
                        ":now", s(Instant.now().toString())
                ))
                .returnValues(ReturnValue.UPDATED_NEW)
                .build());

        String newAccStr = updateResponse.attributes().get("accumulatedAmount").n();
        Money newAccumulated = Money.of(newAccStr);

        // Step 2: If goal exists and reached, update status atomically with condition
        if (goalAmount != null && newAccumulated.isGreaterThanOrEqual(goalAmount)) {
            try {
                dynamo.updateItem(UpdateItemRequest.builder()
                        .tableName(tableName)
                        .key(key)
                        .updateExpression("SET #st = :completed, updatedAt = :now")
                        .conditionExpression("#st = :activo")
                        .expressionAttributeNames(Map.of("#st", "status"))
                        .expressionAttributeValues(Map.of(
                                ":completed", s(GroupStatus.COMPLETADO.name()),
                                ":activo", s(GroupStatus.ACTIVO.name()),
                                ":now", s(Instant.now().toString())
                        ))
                        .build());
                log.info("Group {} marked as COMPLETADO", groupId);
            } catch (ConditionalCheckFailedException e) {
                // Already completed by another concurrent request — safe to ignore
                log.debug("Group {} was already COMPLETADO", groupId);
            }
        }

        return newAccumulated;
    }

    @Override
    public void incrementMemberCount(String groupId) {
        dynamo.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("METADATA")
                ))
                .updateExpression("SET updatedAt = :now ADD memberCount :one")
                .expressionAttributeValues(Map.of(
                        ":one", n("1"),
                        ":now", s(Instant.now().toString())
                ))
                .build());
    }

    @Override
    public void setCreatorTokenHash(String groupId, String tokenHash) {
        dynamo.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("METADATA")
                ))
                .updateExpression("SET creatorTokenHash = :hash")
                .expressionAttributeValues(Map.of(":hash", s(tokenHash)))
                .build());
    }

    @Override
    public String getCreatorTokenHash(String groupId) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("METADATA")
                ))
                .projectionExpression("creatorTokenHash")
                .build());
        if (!response.hasItem() || !response.item().containsKey("creatorTokenHash")) return null;
        return response.item().get("creatorTokenHash").s();
    }

    private Group mapToGroup(Map<String, AttributeValue> item) {
        Money goalAmount = item.containsKey("goalAmount") ? Money.of(item.get("goalAmount").s()) : null;
        return new Group(
                item.get("groupId").s(),
                item.get("name").s(),
                goalAmount,
                Money.of(item.get("accumulatedAmount").n()),
                LocalDate.parse(item.get("targetDate").s()),
                GroupStatus.valueOf(item.get("status").s()),
                item.get("inviteCode").s(),
                Integer.parseInt(item.get("memberCount").n()),
                Instant.parse(item.get("createdAt").s()),
                Instant.parse(item.get("updatedAt").s())
        );
    }

    private static AttributeValue s(String val) {
        return AttributeValue.builder().s(val).build();
    }

    private static AttributeValue n(String val) {
        return AttributeValue.builder().n(val).build();
    }

    private static AttributeValue n(int val) {
        return AttributeValue.builder().n(String.valueOf(val)).build();
    }
}
