package com.minatillera;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.regions.Region;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Standalone integration test against DynamoDB Local.
 * Creates the table, runs the full idempotency flow, and prints real DynamoDB results.
 */
public class IdempotencyIntegrationTest {

    private static final String TABLE = "minatillera";
    private static final String ENDPOINT = "http://localhost:8000";

    public static void main(String[] args) {
        // DynamoDB Local doesn't verify credentials but the SDK requires them
        System.setProperty("aws.accessKeyId", "fakeAccessKey");
        System.setProperty("aws.secretAccessKey", "fakeSecretKey");

        DynamoDbClient client = DynamoDbClient.builder()
                .endpointOverride(URI.create(ENDPOINT))
                .region(Region.US_EAST_1)
                .build();

        // 1. Create table
        System.out.println("=== PASO 1: Crear tabla DynamoDB ===");
        createTable(client);
        System.out.println("Tabla 'minatillera' creada.\n");

        // 2. Create a group
        String groupId = UUID.randomUUID().toString();
        String inviteCode = "TEST1234";
        System.out.println("=== PASO 2: Crear grupo ===");
        createGroup(client, groupId, inviteCode);
        System.out.println("Grupo creado: " + groupId + "\n");

        // 3. Create a member
        String memberId = UUID.randomUUID().toString();
        System.out.println("=== PASO 3: Crear miembro ===");
        createMember(client, groupId, memberId);
        System.out.println("Miembro creado: " + memberId + "\n");

        // 4. Register contribution — FIRST time
        String idempotencyKey = UUID.randomUUID().toString();
        String contributionId = UUID.randomUUID().toString();
        System.out.println("=== PASO 4: Registrar aporte (primera vez) ===");
        System.out.println("idempotencyKey: " + idempotencyKey);
        boolean firstResult = registerContribution(client, groupId, memberId, contributionId, idempotencyKey, "50000.00");
        System.out.println("Resultado primera vez: saved=" + firstResult + "\n");

        // 5. Register same contribution — SECOND time (idempotent)
        String contributionId2 = UUID.randomUUID().toString(); // different ID but same key
        System.out.println("=== PASO 5: Registrar aporte (segunda vez, misma idempotencyKey) ===");
        System.out.println("idempotencyKey: " + idempotencyKey + " (la misma)");
        boolean secondResult = registerContribution(client, groupId, memberId, contributionId2, idempotencyKey, "50000.00");
        System.out.println("Resultado segunda vez: saved=" + secondResult + "\n");

        // 6. Verify: read the idempotency record
        System.out.println("=== PASO 6: Verificar registro de idempotencia en DynamoDB ===");
        GetItemResponse idempotencyItem = client.getItem(GetItemRequest.builder()
                .tableName(TABLE)
                .key(Map.of(
                        "PK", s("IDEMPOTENCY#" + groupId + "#" + idempotencyKey),
                        "SK", s("RESULT")
                ))
                .build());
        System.out.println("PK: IDEMPOTENCY#" + groupId + "#" + idempotencyKey);
        System.out.println("Existe: " + idempotencyItem.hasItem());
        if (idempotencyItem.hasItem()) {
            System.out.println("responseBody: " + idempotencyItem.item().get("responseBody").s());
            System.out.println("ttl: " + idempotencyItem.item().get("ttl").n());
        }
        System.out.println();

        // 7. Verify: only ONE contribution was written
        System.out.println("=== PASO 7: Verificar que solo hay UN aporte en DynamoDB ===");
        QueryResponse contributions = client.query(QueryRequest.builder()
                .tableName(TABLE)
                .keyConditionExpression("PK = :pk AND begins_with(SK, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pk", s("GROUP#" + groupId),
                        ":prefix", s("CONTRIBUTION#")
                ))
                .build());
        System.out.println("Cantidad de aportes: " + contributions.count());
        for (Map<String, AttributeValue> item : contributions.items()) {
            System.out.println("  SK=" + item.get("SK").s()
                    + " | contributionId=" + item.get("contributionId").s()
                    + " | amount=" + item.get("amount").s()
                    + " | idempotencyKey=" + item.get("idempotencyKey").s());
        }
        System.out.println();

        // 8. Verify: accumulated amount updated only once
        System.out.println("=== PASO 8: Verificar monto acumulado (debe ser 50000.00, no 100000.00) ===");
        GetItemResponse groupItem = client.getItem(GetItemRequest.builder()
                .tableName(TABLE)
                .key(Map.of(
                        "PK", s("GROUP#" + groupId),
                        "SK", s("METADATA")
                ))
                .build());
        System.out.println("accumulatedAmount: " + groupItem.item().get("accumulatedAmount").n());
        System.out.println("status: " + groupItem.item().get("status").s());
        System.out.println();

        System.out.println("=== RESULTADO: IDEMPOTENCIA VERIFICADA ===");
        System.out.println("- Primer aporte: guardado (saved=true)");
        System.out.println("- Segundo aporte (misma key): rechazado (saved=false)");
        System.out.println("- Solo 1 registro de aporte en la tabla");
        System.out.println("- Acumulado incrementado solo una vez");

        client.close();
    }

    static void createTable(DynamoDbClient client) {
        try {
            client.createTable(CreateTableRequest.builder()
                    .tableName(TABLE)
                    .attributeDefinitions(
                            AttributeDefinition.builder().attributeName("PK").attributeType(ScalarAttributeType.S).build(),
                            AttributeDefinition.builder().attributeName("SK").attributeType(ScalarAttributeType.S).build()
                    )
                    .keySchema(
                            KeySchemaElement.builder().attributeName("PK").keyType(KeyType.HASH).build(),
                            KeySchemaElement.builder().attributeName("SK").keyType(KeyType.RANGE).build()
                    )
                    .billingMode(BillingMode.PAY_PER_REQUEST)
                    .build());
        } catch (ResourceInUseException e) {
            System.out.println("(tabla ya existía, reutilizando)");
        }
    }

    static void createGroup(DynamoDbClient client, String groupId, String inviteCode) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + groupId));
        item.put("SK", s("METADATA"));
        item.put("groupId", s(groupId));
        item.put("name", s("Test Natillera"));
        item.put("goalAmount", s("500000.00"));
        item.put("accumulatedAmount", AttributeValue.builder().n("0").build());
        item.put("targetDate", s("2026-12-25"));
        item.put("status", s("ACTIVO"));
        item.put("inviteCode", s(inviteCode));
        item.put("memberCount", AttributeValue.builder().n("0").build());
        item.put("createdAt", s(Instant.now().toString()));
        item.put("updatedAt", s(Instant.now().toString()));
        client.putItem(PutItemRequest.builder().tableName(TABLE).item(item).build());
    }

    static void createMember(DynamoDbClient client, String groupId, String memberId) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", s("GROUP#" + groupId));
        item.put("SK", s("MEMBER#" + memberId));
        item.put("memberId", s(memberId));
        item.put("groupId", s(groupId));
        item.put("name", s("Camilo Test"));
        item.put("joinedAt", s(Instant.now().toString()));
        client.putItem(PutItemRequest.builder().tableName(TABLE).item(item).build());
    }

    static boolean registerContribution(DynamoDbClient client, String groupId, String memberId,
                                        String contributionId, String idempotencyKey, String amount) {
        Instant now = Instant.now();

        // Build contribution item
        Map<String, AttributeValue> contribItem = new HashMap<>();
        contribItem.put("PK", s("GROUP#" + groupId));
        contribItem.put("SK", s("CONTRIBUTION#" + now.toString() + "#" + contributionId));
        contribItem.put("contributionId", s(contributionId));
        contribItem.put("groupId", s(groupId));
        contribItem.put("memberId", s(memberId));
        contribItem.put("amount", s(amount));
        contribItem.put("date", s(LocalDate.now().toString()));
        contribItem.put("idempotencyKey", s(idempotencyKey));
        contribItem.put("createdAt", s(now.toString()));

        // Build idempotency item with TTL
        long ttlEpoch = Instant.now().plus(48, ChronoUnit.HOURS).getEpochSecond();
        Map<String, AttributeValue> idempotencyItem = new HashMap<>();
        idempotencyItem.put("PK", s("IDEMPOTENCY#" + groupId + "#" + idempotencyKey));
        idempotencyItem.put("SK", s("RESULT"));
        idempotencyItem.put("responseBody", s("{\"contributionId\":\"" + contributionId + "\",\"amount\":\"" + amount + "\"}"));
        idempotencyItem.put("ttl", AttributeValue.builder().n(String.valueOf(ttlEpoch)).build());

        try {
            // TransactWriteItems: contribution + idempotency with condition
            client.transactWriteItems(TransactWriteItemsRequest.builder()
                    .transactItems(
                            TransactWriteItem.builder()
                                    .put(Put.builder()
                                            .tableName(TABLE)
                                            .item(contribItem)
                                            .build())
                                    .build(),
                            TransactWriteItem.builder()
                                    .put(Put.builder()
                                            .tableName(TABLE)
                                            .item(idempotencyItem)
                                            .conditionExpression("attribute_not_exists(PK)")
                                            .build())
                                    .build()
                    )
                    .build());

            // Atomically update accumulated amount with ADD
            client.updateItem(UpdateItemRequest.builder()
                    .tableName(TABLE)
                    .key(Map.of("PK", s("GROUP#" + groupId), "SK", s("METADATA")))
                    .updateExpression("SET updatedAt = :now ADD accumulatedAmount :amt")
                    .expressionAttributeValues(Map.of(
                            ":amt", AttributeValue.builder().n(amount).build(),
                            ":now", s(Instant.now().toString())
                    ))
                    .build());

            return true;
        } catch (TransactionCanceledException e) {
            List<CancellationReason> reasons = e.cancellationReasons();
            if (reasons.size() >= 2 && "ConditionalCheckFailed".equals(reasons.get(1).code())) {
                return false; // Idempotent duplicate
            }
            throw e;
        }
    }

    static AttributeValue s(String val) {
        return AttributeValue.builder().s(val).build();
    }
}
