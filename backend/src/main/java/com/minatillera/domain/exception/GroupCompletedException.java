package com.minatillera.domain.exception;

public class GroupCompletedException extends DomainException {

    public GroupCompletedException() {
        super("CONFLICT", "El grupo ya ha alcanzado su meta y no acepta nuevos aportes.");
    }
}
