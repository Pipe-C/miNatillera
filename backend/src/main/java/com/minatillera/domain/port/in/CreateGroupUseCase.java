package com.minatillera.domain.port.in;

import com.minatillera.domain.model.Group;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface CreateGroupUseCase {

    CreateResult create(String name, BigDecimal goalAmount, LocalDate targetDate, String creatorName);

    record CreateResult(Group group, String creatorToken) {}
}
