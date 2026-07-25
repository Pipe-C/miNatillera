package com.minatillera.adapter.out.dynamodb;

import com.minatillera.domain.model.Manager;
import com.minatillera.domain.model.ManagerInvite;
import com.minatillera.domain.port.out.ManagerRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.util.*;

@Repository
public class DynamoDbManagerRepository implements ManagerRepository {

    private final DynamoDbClient dynamo;
    private final String tableName;

    public DynamoDbManagerRepository(DynamoDbClient dynamo,
                                     @Qualifier("dynamoDbTableName") String tableName) {
        this.dynamo = dynamo;
        this.tableName = tableName;
    }

    @Override
    public void saveManager(Manager manager) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + manager.getGroupId()));
        item.put("SK", s("MANAGER#" + manager.getManagerId()));
        item.put("managerId", s(manager.getManagerId()));
        item.put("groupId", s(manager.getGroupId()));
        item.put("name", s(manager.getName()));
        item.put("tokenHash", s(manager.getTokenHash()));
        item.put("isOwner", AttributeValue.builder().bool(manager.isOwner()).build());
        item.put("addedAt", s(manager.getAddedAt().toString()));

        dynamo.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build());
    }

    @Override
    public List<Manager> findManagersByGroupId(String groupId) {
        QueryResponse response = dynamo.query(QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("MANAGER#")
                ))
                .build());

        return response.items().stream()
                .map(this::mapToManager)
                .toList();
    }

    @Override
    public void saveInvite(ManagerInvite invite) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + invite.getGroupId()));
        item.put("SK", s("MGRINVITE#" + invite.getInviteId()));
        item.put("inviteId", s(invite.getInviteId()));
        item.put("groupId", s(invite.getGroupId()));
        item.put("tokenHash", s(invite.getTokenHash()));
        item.put("used", AttributeValue.builder().bool(invite.isUsed()).build());
        item.put("expiresAt", s(invite.getExpiresAt().toString()));
        item.put("createdAt", s(invite.getCreatedAt().toString()));

        dynamo.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build());
    }

    @Override
    public Optional<ManagerInvite> findInviteById(String groupId, String inviteId) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("MGRINVITE#" + inviteId)
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(mapToInvite(response.item()));
    }

    @Override
    public void markInviteUsed(String groupId, String inviteId) {
        dynamo.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("MGRINVITE#" + inviteId)
                ))
                .updateExpression("SET #u = :true")
                .expressionAttributeNames(Map.of("#u", "used"))
                .expressionAttributeValues(Map.of(":true", AttributeValue.builder().bool(true).build()))
                .build());
    }

    @Override
    public void deleteManager(String groupId, String managerId) {
        dynamo.deleteItem(DeleteItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("MANAGER#" + managerId)
                ))
                .build());
    }

    private Manager mapToManager(Map<String, AttributeValue> item) {
        boolean isOwner = item.containsKey("isOwner") && Boolean.TRUE.equals(item.get("isOwner").bool());
        return new Manager(
                item.get("managerId").s(),
                item.get("groupId").s(),
                item.get("name").s(),
                item.get("tokenHash").s(),
                isOwner,
                Instant.parse(item.get("addedAt").s())
        );
    }

    private ManagerInvite mapToInvite(Map<String, AttributeValue> item) {
        return new ManagerInvite(
                item.get("inviteId").s(),
                item.get("groupId").s(),
                item.get("tokenHash").s(),
                Boolean.TRUE.equals(item.get("used").bool()),
                Instant.parse(item.get("expiresAt").s()),
                Instant.parse(item.get("createdAt").s())
        );
    }

    private static AttributeValue s(String val) {
        return AttributeValue.builder().s(val).build();
    }
}
