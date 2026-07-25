package com.minatillera.domain.port.in;

/**
 * Resolves an invite code to a groupId.
 * Used by the web layer interceptor for authentication.
 */
public interface ResolveInviteCodeUseCase {

    /**
     * @param inviteCode the 8-char alphanumeric code
     * @return the groupId associated with the code
     * @throws com.minatillera.domain.exception.InvalidInviteCodeException if code is invalid
     */
    String resolve(String inviteCode);
}
