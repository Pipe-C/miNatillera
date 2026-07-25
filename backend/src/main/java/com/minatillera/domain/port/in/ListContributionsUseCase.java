package com.minatillera.domain.port.in;

import com.minatillera.domain.model.Contribution;
import com.minatillera.domain.port.out.ContributionRepository.ContributionPage;

public interface ListContributionsUseCase {

    ContributionPage list(String groupId, int limit, String lastKey);

    void deleteContribution(String groupId, String contributionId);

    void updateContribution(String groupId, String contributionId, java.math.BigDecimal amount, java.time.LocalDate date, String receiptImageUrl);
}
