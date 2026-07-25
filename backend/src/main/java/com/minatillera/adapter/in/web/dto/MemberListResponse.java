package com.minatillera.adapter.in.web.dto;

import java.util.List;

public record MemberListResponse(
        String groupId,
        List<MemberItem> members
) {
    public record MemberItem(String memberId, String name, boolean isOwner, boolean isManager, String joinedAt) {}
}
