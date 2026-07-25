package com.minatillera.application.service;

import com.minatillera.domain.exception.GroupFullException;
import com.minatillera.domain.exception.GroupNotFoundException;
import com.minatillera.domain.model.Group;
import com.minatillera.domain.model.Member;
import com.minatillera.domain.port.in.AddMemberUseCase;
import com.minatillera.domain.port.in.ListMembersUseCase;
import com.minatillera.domain.port.out.GroupRepository;
import com.minatillera.domain.port.out.MemberRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class MemberService implements AddMemberUseCase, ListMembersUseCase {

    private final MemberRepository memberRepository;
    private final GroupRepository groupRepository;

    public MemberService(MemberRepository memberRepository, GroupRepository groupRepository) {
        this.memberRepository = memberRepository;
        this.groupRepository = groupRepository;
    }

    @Override
    public Member addMember(String groupId, String name) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        if (!group.canAddMember()) {
            throw new GroupFullException();
        }

        String memberId = UUID.randomUUID().toString();
        Member member = new Member(memberId, groupId, name, false, false, Instant.now());

        memberRepository.save(member);
        groupRepository.incrementMemberCount(groupId);

        return member;
    }

    @Override
    public List<Member> listMembers(String groupId) {
        // Verify group exists
        groupRepository.findById(groupId)
                .orElseThrow(GroupNotFoundException::new);

        return memberRepository.findAllByGroupId(groupId);
    }
}
