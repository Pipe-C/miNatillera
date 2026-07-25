package com.minatillera.adapter.in.web.dto;

public record AddMemberResponse(
        String memberId,
        String name,
        String groupId,
        String joinedAt
) {}
