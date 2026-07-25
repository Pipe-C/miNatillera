package com.minatillera.domain.exception;

public class InvalidInviteCodeException extends DomainException {

    public InvalidInviteCodeException() {
        super("UNAUTHORIZED", "Acceso no autorizado.");
    }
}
