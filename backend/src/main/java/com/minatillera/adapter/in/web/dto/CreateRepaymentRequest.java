package com.minatillera.adapter.in.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateRepaymentRequest(
        @NotNull(message = "El monto es obligatorio.")
        @DecimalMin(value = "0.01", message = "El monto debe ser mayor a cero.")
        BigDecimal amount,

        @NotNull(message = "La fecha es obligatoria.")
        LocalDate date
) {}
