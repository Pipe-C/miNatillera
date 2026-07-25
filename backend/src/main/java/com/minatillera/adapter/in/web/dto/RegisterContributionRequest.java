package com.minatillera.adapter.in.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RegisterContributionRequest(
        @NotBlank(message = "El memberId es obligatorio.")
        String memberId,

        @NotNull(message = "El monto es obligatorio.")
        @DecimalMin(value = "0.01", message = "El monto debe ser mayor a cero.")
        BigDecimal amount,

        @NotNull(message = "La fecha es obligatoria.")
        LocalDate date,

        @NotBlank(message = "La idempotencyKey es obligatoria.")
        String idempotencyKey,

        String receiptImageUrl
) {}
