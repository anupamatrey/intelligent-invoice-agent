package com.anupam.ruleengine.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class ValidationRequest {
    private String vendorCode;
    private String serviceName;
    private BigDecimal serviceAmount;
}