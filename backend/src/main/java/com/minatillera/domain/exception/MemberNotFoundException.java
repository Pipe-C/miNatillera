package com.minatillera.domain.exception;

public class MemberNotFoundException extends DomainException {

    public MemberNotFoundException() {
        super("NOT_FOUND", "Miembro no encontrado.");
    }
}
