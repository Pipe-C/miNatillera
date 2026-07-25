package com.minatillera.domain.port.out;

import com.minatillera.domain.model.Contribution;

import java.util.List;
import java.util.Optional;

public interface ContributionRepository {

    /**
     * Saves a contribution with idempotency check using DynamoDB ConditionExpression.
     * If the idempotencyKey already exists, returns false and leaves the data unchanged.
     *
     * @param contribution the contribution to persist
     * @param responseJson serialized response to cache for idempotent replay
     * @return true if the contribution was saved (new), false if it was a duplicate
     */
    boolean saveWithIdempotency(Contribution contribution, String responseJson);

    /**
     * Returns the cached response for an existing idempotency key.
     */
    Optional<String> findIdempotencyResult(String groupId, String idempotencyKey);

    /**
     * Query contributions for a group, ordered from most recent to oldest.
     *
     * @param groupId the group
     * @param limit max items to return
     * @param lastKey pagination token (null for first page)
     * @return page of contributions
     */
    ContributionPage findByGroupId(String groupId, int limit, String lastKey);

    record ContributionPage(List<Contribution> items, String nextKey) {}

    void delete(String groupId, String contributionId);

    void deleteAllByMemberId(String groupId, String memberId);

    void update(String groupId, String contributionId, String amount, String date, String receiptImageUrl);
}
