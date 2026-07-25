package com.minatillera.domain.exception;

public class GroupNotFoundException extends DomainException {

    public GroupNotFoundException() {
        super("NOT_FOUND", "Recurso no encontrado.");
    }
}
