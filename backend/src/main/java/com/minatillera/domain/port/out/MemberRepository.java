package com.minatillera.domain.port.out;

import com.minatillera.domain.model.Member;

import java.util.List;
import java.util.Optional;

public interface MemberRepository {

    void save(Member member);

    Optional<Member> findById(String groupId, String memberId);

    List<Member> findAllByGroupId(String groupId);

    void delete(String groupId, String memberId);

    void updateName(String groupId, String memberId, String newName);
}
