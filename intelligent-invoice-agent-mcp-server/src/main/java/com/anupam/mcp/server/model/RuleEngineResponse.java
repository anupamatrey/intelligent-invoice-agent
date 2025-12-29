package com.anupam.mcp.server.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response from Rule Engine API validation.
 * 
 * @author Anupam Sharma
 * @since 2.0
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class RuleEngineResponse {
    
    @JsonProperty("valid")
    private boolean valid;
    
    @JsonProperty("message")
    @com.fasterxml.jackson.annotation.JsonAlias({"reason", "message"})
    private String reason;
    
    @JsonProperty("expectedAmount")
    private BigDecimal expectedAmount;
    
    @JsonProperty("actualAmount")
    private BigDecimal actualAmount;
    
    @JsonProperty("pricingType")
    @com.fasterxml.jackson.annotation.JsonAlias({"pricingType", "pricing_type"})
    private String pricingType;
    
    public RuleEngineResponse() {}
    
    public RuleEngineResponse(boolean valid, String reason) {
        this.valid = valid;
        this.reason = reason;
    }
    
    // Getters and Setters
    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }
    
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    
    public BigDecimal getExpectedAmount() { return expectedAmount; }
    public void setExpectedAmount(BigDecimal expectedAmount) { this.expectedAmount = expectedAmount; }
    
    public BigDecimal getActualAmount() { return actualAmount; }
    public void setActualAmount(BigDecimal actualAmount) { this.actualAmount = actualAmount; }
    
    public String getPricingType() { return pricingType; }
    public void setPricingType(String pricingType) { this.pricingType = pricingType; }
}
