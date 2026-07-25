package com.minatillera.adapter.in.web.dto;

import java.util.List;

public record ContributionListResponse(
        String groupId,
        List<ContributionItem> contributions,
        String nextKey
) {
    public record ContributionItem(
            String contributionId,
            String memberId,
            String memberName,
            String amount,
            String date,
            String createdAt,
            String receiptImageUrl
    ) {}
}
