package com.anupam.ruleengine.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class ValidationResponse {
    private boolean isValid;
    private String message;
    private BigDecimal expectedAmount;
    private BigDecimal actualAmount;
    private String pricingType;
}