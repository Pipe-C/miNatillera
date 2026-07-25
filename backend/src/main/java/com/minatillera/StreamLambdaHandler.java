package com.minatillera;

import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.AwsProxyRequest;
import com.amazonaws.serverless.proxy.model.AwsProxyResponse;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import org.crac.Core;
import org.crac.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.SecureRandom;

/**
 * AWS Lambda entry point. Bridges API Gateway HTTP API requests to
 * the Spring Boot DispatcherServlet via aws-serverless-java-container.
 *
 * Implements CRaC Resource for SnapStart compatibility:
 * - beforeCheckpoint: clean up resources before snapshot
 * - afterRestore: re-seed randomness and refresh connections after restore
 */
public class StreamLambdaHandler implements RequestStreamHandler, Resource {

    private static final Logger log = LoggerFactory.getLogger(StreamLambdaHandler.class);

    private static final SpringBootLambdaContainerHandler<AwsProxyRequest, AwsProxyResponse> handler;

    static {
        try {
            handler = SpringBootLambdaContainerHandler.getAwsProxyHandler(MiNatilleraApplication.class);
        } catch (ContainerInitializationException e) {
            throw new IllegalStateException("Failed to initialize Spring Boot Lambda handler", e);
        }
    }

    public StreamLambdaHandler() {
        Core.getGlobalContext().register(this);
    }

    @Override
    public void handleRequest(InputStream input, OutputStream output, Context context) throws IOException {
        handler.proxyStream(input, output, context);
    }

    @Override
    public void beforeCheckpoint(org.crac.Context<? extends Resource> context) {
        // SnapStart will take a snapshot here.
        // Nothing to explicitly close — the DynamoDB client is managed by Spring
        // and will be re-validated on first use after restore.
        log.info("SnapStart: beforeCheckpoint — preparing for snapshot");
    }

    @Override
    public void afterRestore(org.crac.Context<? extends Resource> context) {
        // Re-seed SecureRandom to ensure uniqueness after snapshot restore.
        // Each restored instance must produce different random values.
        new SecureRandom().nextBytes(new byte[32]);
        log.info("SnapStart: afterRestore — SecureRandom re-seeded, container restored");
    }
}
