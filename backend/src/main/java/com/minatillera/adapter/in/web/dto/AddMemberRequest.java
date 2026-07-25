package com.minatillera.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddMemberRequest(
        @NotBlank(message = "El nombre del miembro es obligatorio.")
        @Size(max = 60, message = "El nombre no debe superar 60 caracteres.")
        String name
) {}
