package com.minatillera.domain.port.in;

import java.time.LocalDate;

public interface GetProgressUseCase {

    ProgressResult getProgress(String groupId);

    record ProgressResult(
            String groupId,
            String name,
            String goalAmount,
            String accumulatedAmount,
            String remainingAmount,
            int progressPercent,
            String targetDate,
            String status,
            int memberCount,
            String lastContributionDate
    ) {}
}
