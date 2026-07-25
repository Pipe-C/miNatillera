package com.minatillera.adapter.in.web;

import com.minatillera.domain.exception.InvalidInviteCodeException;
import com.minatillera.domain.port.in.ResolveInviteCodeUseCase;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Intercepts requests that require invite code authentication.
 * Resolves the code to a groupId and stores it as a request attribute.
 */
@Component
public class InviteCodeInterceptor implements HandlerInterceptor {

    public static final String HEADER_NAME = "X-Invite-Code";
    public static final String ATTR_GROUP_ID = "resolvedGroupId";

    private final ResolveInviteCodeUseCase resolveInviteCodeUseCase;

    public InviteCodeInterceptor(ResolveInviteCodeUseCase resolveInviteCodeUseCase) {
        this.resolveInviteCodeUseCase = resolveInviteCodeUseCase;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // Allow CORS preflight requests to pass without authentication
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String inviteCode = request.getHeader(HEADER_NAME);

        if (inviteCode == null || inviteCode.isBlank()) {
            throw new InvalidInviteCodeException();
        }

        String groupId = resolveInviteCodeUseCase.resolve(inviteCode);
        request.setAttribute(ATTR_GROUP_ID, groupId);
        return true;
    }
}
