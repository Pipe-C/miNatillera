package com.minatillera.domain.port.in;

import com.minatillera.domain.model.Member;

public interface AddMemberUseCase {

    Member addMember(String groupId, String name);
}
