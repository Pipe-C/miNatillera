package com.minatillera.adapter.in.web.dto;

public record CreateGroupResponse(
        String groupId,
        String inviteCode,
        String creatorToken,
        String name,
        String goalAmount,
        String targetDate,
        String status,
        String createdAt
) {}
