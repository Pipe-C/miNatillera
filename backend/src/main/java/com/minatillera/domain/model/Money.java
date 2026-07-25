package com.minatillera.domain.model;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Value object for monetary amounts. Single point of scale/rounding definition.
 * All money in the system flows through this class.
 */
public record Money(BigDecimal value) {

    public static final int SCALE = 2;
    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    public Money {
        if (value == null) {
            throw new IllegalArgumentException("Money value cannot be null");
        }
        value = value.setScale(SCALE, ROUNDING);
    }

    public static Money of(String raw) {
        return new Money(new BigDecimal(raw));
    }

    public static Money of(BigDecimal raw) {
        return new Money(raw);
    }

    public static Money zero() {
        return new Money(BigDecimal.ZERO);
    }

    public Money add(Money other) {
        return new Money(this.value.add(other.value));
    }

    public Money subtract(Money other) {
        return new Money(this.value.subtract(other.value));
    }

    public boolean isPositive() {
        return value.compareTo(BigDecimal.ZERO) > 0;
    }

    public boolean isGreaterThanOrEqual(Money other) {
        return value.compareTo(other.value) >= 0;
    }

    public int percentOf(Money total) {
        if (total.value.compareTo(BigDecimal.ZERO) == 0) {
            return 0;
        }
        BigDecimal percent = this.value
                .multiply(BigDecimal.valueOf(100))
                .divide(total.value, 0, ROUNDING);
        int result = percent.intValue();
        return Math.min(result, 100);
    }

    @Override
    public String toString() {
        return value.toPlainString();
    }
}
