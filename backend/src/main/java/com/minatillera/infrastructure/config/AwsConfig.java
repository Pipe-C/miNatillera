package com.minatillera.infrastructure.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterResponse;
import software.amazon.awssdk.services.ssm.model.ParameterNotFoundException;

import jakarta.annotation.PostConstruct;
import java.net.URI;

@Configuration
public class AwsConfig {

    private static final Logger log = LoggerFactory.getLogger(AwsConfig.class);

    private static final String PARAM_TABLE_NAME = "/minatillera/prod/dynamodb/tableName";
    private static final String PARAM_REGION = "/minatillera/prod/aws/region";

    private String tableName;
    private String awsRegion;

    @PostConstruct
    void loadSsmParameters() {
        // Allow local dev override via environment variables
        String localTable = System.getenv("MINATILLERA_TABLE_NAME");
        String localRegion = System.getenv("MINATILLERA_REGION");
        String localEndpoint = System.getenv("DYNAMODB_ENDPOINT");

        if (localTable != null && localRegion != null) {
            this.tableName = localTable;
            this.awsRegion = localRegion;
            log.info("Using local config: table={}, region={}", tableName, awsRegion);
            return;
        }

        log.info("Loading configuration from SSM Parameter Store...");
        try (SsmClient ssm = SsmClient.create()) {
            this.awsRegion = getRequiredParameter(ssm, PARAM_REGION);
            this.tableName = getRequiredParameter(ssm, PARAM_TABLE_NAME);
        }
        log.info("SSM config loaded: table={}, region={}", tableName, awsRegion);
    }

    private String getRequiredParameter(SsmClient ssm, String parameterName) {
        try {
            GetParameterResponse response = ssm.getParameter(
                    GetParameterRequest.builder()
                            .name(parameterName)
                            .build()
            );
            return response.parameter().value();
        } catch (ParameterNotFoundException e) {
            log.error("Required SSM parameter not found: {}", parameterName);
            throw new IllegalStateException(
                    "Missing required SSM parameter: " + parameterName +
                    ". Aborting startup — cannot run with undefined configuration.", e);
        } catch (Exception e) {
            log.error("Failed to read SSM parameter: {}", parameterName, e);
            throw new IllegalStateException(
                    "Error reading SSM parameter: " + parameterName, e);
        }
    }

    @Bean
    public DynamoDbClient dynamoDbClient() {
        var builder = DynamoDbClient.builder()
                .region(Region.of(awsRegion));

        // Support local DynamoDB endpoint for development/testing
        String localEndpoint = System.getenv("DYNAMODB_ENDPOINT");
        if (localEndpoint != null && !localEndpoint.isBlank()) {
            builder.endpointOverride(URI.create(localEndpoint));
            log.info("DynamoDB client pointing to local endpoint: {}", localEndpoint);
        }

        return builder.build();
    }

    @Bean
    public software.amazon.awssdk.services.s3.presigner.S3Presigner s3Presigner() {
        var builder = software.amazon.awssdk.services.s3.presigner.S3Presigner.builder()
                .region(Region.of(awsRegion));

        String localS3Endpoint = System.getenv("S3_ENDPOINT");
        if (localS3Endpoint != null && !localS3Endpoint.isBlank()) {
            builder.endpointOverride(URI.create(localS3Endpoint));
            log.info("S3 Presigner pointing to local endpoint: {}", localS3Endpoint);
        }

        return builder.build();
    }

    @Bean
    public String receiptsBucketName() {
        String bucket = System.getenv("RECEIPTS_BUCKET_NAME");
        return bucket != null ? bucket : "minatillera-receipts";
    }

    @Bean
    public String dynamoDbTableName() {
        return tableName;
    }
}
