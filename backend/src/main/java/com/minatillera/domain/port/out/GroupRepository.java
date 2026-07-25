package com.minatillera.domain.port.out;

import com.minatillera.domain.model.Group;
import com.minatillera.domain.model.Money;
import com.minatillera.domain.model.GroupStatus;

import java.util.Optional;

public interface GroupRepository {

    void save(Group group);

    Optional<Group> findById(String groupId);

    Optional<String> findGroupIdByInviteCode(String inviteCode);

    /**
     * Atomically increments the accumulated amount and conditionally updates the status.
     * Uses DynamoDB ADD expression — never read-modify-write.
     *
     * @param groupId the group to update
     * @param amountToAdd the contribution amount to add
     * @param goalAmount the goal to compare against for completion
     * @return the new accumulated amount after update
     */
    Money addToAccumulatedAmount(String groupId, Money amountToAdd, Money goalAmount);

    void incrementMemberCount(String groupId);

    void setCreatorTokenHash(String groupId, String tokenHash);

    String getCreatorTokenHash(String groupId);
}
