package com.minatillera.domain.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface RegisterContributionUseCase {

    ContributionResult register(String groupId, String memberId, BigDecimal amount,
                                LocalDate date, String idempotencyKey, String receiptImageUrl);

    record ContributionResult(
            String contributionId,
            String memberId,
            String amount,
            String date,
            GroupProgressSnapshot group,
            boolean idempotent
    ) {}

    record GroupProgressSnapshot(
            String groupId,
            String accumulatedAmount,
            String goalAmount,
            String status,
            int progressPercent
    ) {}
}
