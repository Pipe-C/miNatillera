package com.minatillera.domain.port.out;

import com.minatillera.domain.model.Manager;
import com.minatillera.domain.model.ManagerInvite;

import java.util.List;
import java.util.Optional;

public interface ManagerRepository {

    void saveManager(Manager manager);

    List<Manager> findManagersByGroupId(String groupId);

    // Manager invites
    void saveInvite(ManagerInvite invite);

    Optional<ManagerInvite> findInviteById(String groupId, String inviteId);

    void markInviteUsed(String groupId, String inviteId);

    void deleteManager(String groupId, String managerId);
}
