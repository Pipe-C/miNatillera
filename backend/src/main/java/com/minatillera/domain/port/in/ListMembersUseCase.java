package com.minatillera.domain.port.in;

import com.minatillera.domain.model.Member;

import java.util.List;

public interface ListMembersUseCase {

    List<Member> listMembers(String groupId);
}
