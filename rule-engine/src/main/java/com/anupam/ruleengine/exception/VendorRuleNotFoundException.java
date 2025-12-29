package com.anupam.ruleengine.exception;

public class VendorRuleNotFoundException extends RuntimeException {
    
    public VendorRuleNotFoundException(String message) {
        super(message);
    }
    
    public VendorRuleNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}