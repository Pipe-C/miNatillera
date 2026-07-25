package com.minatillera.adapter.in.web;

import com.minatillera.application.service.ManagerAuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/uploads")
public class UploadController {

    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final ManagerAuthService managerAuthService;

    public UploadController(S3Presigner s3Presigner,
                            @Qualifier("receiptsBucketName") String bucketName,
                            ManagerAuthService managerAuthService) {
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.managerAuthService = managerAuthService;
    }

    @PostMapping("/presigned-url")
    public ResponseEntity<?> getPresignedUrl(
            @RequestHeader(value = "X-Manager-Token", required = false) String managerToken,
            @RequestHeader(value = "X-Group-Id", required = false) String groupId,
            @Valid @RequestBody PresignedUrlRequest request) {

        // Validate manager token
        if (groupId == null || groupId.isBlank() || !managerAuthService.isValidManagerToken(groupId, managerToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", Map.of("code", "UNAUTHORIZED", "message", "Se requiere token de gestor válido.")));
        }

        // Generate unique key
        String extension = extensionFromContentType(request.contentType());
        String key = "receipts/" + groupId + "/" + UUID.randomUUID() + extension;

        // Create presigned PUT URL (5 min expiration)
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(request.contentType())
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(5))
                .putObjectRequest(putRequest)
                .build();

        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);

        // Public URL for reading the object later
        String publicUrl = String.format("https://%s.s3.amazonaws.com/%s", bucketName, key);

        return ResponseEntity.ok(Map.of(
                "uploadUrl", presigned.url().toString(),
                "publicUrl", publicUrl,
                "key", key
        ));
    }

    private String extensionFromContentType(String contentType) {
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }

    public record PresignedUrlRequest(
            @NotBlank(message = "El tipo de contenido es obligatorio.")
            @Pattern(regexp = "image/(jpeg|png|webp)", message = "Solo se permiten imágenes JPEG, PNG o WebP.")
            String contentType
    ) {}
}
