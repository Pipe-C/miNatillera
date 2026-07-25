package com.minatillera.adapter.out.dynamodb;

import com.minatillera.domain.model.Member;
import com.minatillera.domain.port.out.MemberRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class DynamoDbMemberRepository implements MemberRepository {

    private final DynamoDbClient dynamo;
    private final String tableName;

    public DynamoDbMemberRepository(DynamoDbClient dynamo,
                                    @Qualifier("dynamoDbTableName") String tableName) {
        this.dynamo = dynamo;
        this.tableName = tableName;
    }

    @Override
    public void save(Member member) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + member.getGroupId()));
        item.put("SK", s("MEMBER#" + member.getMemberId()));
        item.put("memberId", s(member.getMemberId()));
        item.put("groupId", s(member.getGroupId()));
        item.put("name", s(member.getName()));
        item.put("isOwner", AttributeValue.builder().bool(member.isOwner()).build());
        item.put("isManager", AttributeValue.builder().bool(member.isManager()).build());
        item.put("joinedAt", s(member.getJoinedAt().toString()));

        dynamo.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .conditionExpression("attribute_not_exists(PK)")
                .build());
    }

    @Override
    public Optional<Member> findById(String groupId, String memberId) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("MEMBER#" + memberId)
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(mapToMember(response.item()));
    }

    @Override
    public List<Member> findAllByGroupId(String groupId) {
        QueryResponse response = dynamo.query(QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("MEMBER#")
                ))
                .build());

        return response.items().stream()
                .map(this::mapToMember)
                .toList();
    }

    @Override
    public void delete(String groupId, String memberId) {
        dynamo.deleteItem(DeleteItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("MEMBER#" + memberId)
                ))
                .build());
    }

    @Override
    public void updateName(String groupId, String memberId, String newName) {
        dynamo.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("MEMBER#" + memberId)
                ))
                .updateExpression("SET #n = :name")
                .expressionAttributeNames(Map.of("#n", "name"))
                .expressionAttributeValues(Map.of(":name", s(newName)))
                .build());
    }

    private Member mapToMember(Map<String, AttributeValue> item) {
        boolean isOwner = item.containsKey("isOwner") && item.get("isOwner").bool() != null && item.get("isOwner").bool();
        boolean isManager = item.containsKey("isManager") && item.get("isManager").bool() != null && item.get("isManager").bool();
        return new Member(
                item.get("memberId").s(),
                item.get("groupId").s(),
                item.get("name").s(),
                isOwner,
                isManager,
                Instant.parse(item.get("joinedAt").s())
        );
    }

    private static AttributeValue s(String val) {
        return AttributeValue.builder().s(val).build();
    }
}
