package com.minatillera.adapter.in.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateGroupRequest(
        @NotBlank(message = "El nombre del grupo es obligatorio.")
        @Size(max = 100, message = "El nombre no debe superar 100 caracteres.")
        String name,

        @DecimalMin(value = "0.01", message = "El monto meta debe ser mayor a cero.")
        BigDecimal goalAmount,

        @NotNull(message = "La fecha objetivo es obligatoria.")
        @Future(message = "La fecha objetivo debe ser futura.")
        LocalDate targetDate,

        @NotBlank(message = "El nombre del gestor es obligatorio.")
        @Size(max = 60, message = "El nombre no debe superar 60 caracteres.")
        String creatorName
) {}
