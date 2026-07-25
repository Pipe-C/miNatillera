package com.minatillera.domain.exception;

public class GroupFullException extends DomainException {

    public GroupFullException() {
        super("CONFLICT", "El grupo ya tiene el máximo de miembros permitidos.");
    }
}
