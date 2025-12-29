package com.anupam.ruleengine.controller;

import com.anupam.ruleengine.dto.ValidationRequest;
import com.anupam.ruleengine.dto.ValidationResponse;
import com.anupam.ruleengine.entity.VendorServiceRule;
import com.anupam.ruleengine.exception.VendorRuleNotFoundException;
import com.anupam.ruleengine.service.VendorServiceRuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/vendor-rules")
@RequiredArgsConstructor
@Slf4j
public class VendorServiceRuleController {
    
    private final VendorServiceRuleService vendorServiceRuleService;
    
    @GetMapping("/{vendorCode}/{serviceName}")
    public ResponseEntity<VendorServiceRule> getVendorRule(@PathVariable String vendorCode, @PathVariable String serviceName) {
        try {
            VendorServiceRule rule = vendorServiceRuleService.getVendorRule(vendorCode, serviceName);
            return ResponseEntity.ok(rule);
        } catch (VendorRuleNotFoundException e) {
            log.warn("Vendor rule not found: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error fetching vendor rule for code: {} and service: {}", vendorCode, serviceName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @GetMapping("/{vendorCode}")
    public ResponseEntity<List<VendorServiceRule>> getVendorRules(@PathVariable String vendorCode) {
        try {
            List<VendorServiceRule> rules = vendorServiceRuleService.getVendorRules(vendorCode);
            return ResponseEntity.ok(rules);
        } catch (Exception e) {
            log.error("Error fetching vendor rules for code: {}", vendorCode, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping
    public ResponseEntity<VendorServiceRule> createVendorRule(@RequestBody VendorServiceRule rule) {
        try {
            VendorServiceRule savedRule = vendorServiceRuleService.saveVendorRule(rule);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedRule);
        } catch (Exception e) {
            log.error("Error creating vendor rule", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @DeleteMapping("/{vendorCode}/{serviceName}")
    public ResponseEntity<Void> deleteVendorRule(@PathVariable String vendorCode, @PathVariable String serviceName) {
        try {
            vendorServiceRuleService.deleteVendorRule(vendorCode, serviceName);
            return ResponseEntity.noContent().build();
        } catch (VendorRuleNotFoundException e) {
            log.warn("Vendor rule not found for deletion: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error deleting vendor rule for code: {} and service: {}", vendorCode, serviceName, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping("/validate")
    public ResponseEntity<ValidationResponse> validateServiceAmount(@RequestBody ValidationRequest request) {
        try {
            VendorServiceRule rule = vendorServiceRuleService.getVendorRule(request.getVendorCode(), request.getServiceName());
            boolean isValid = vendorServiceRuleService.validateServiceAmount(rule, request.getServiceAmount());
            
            String message = isValid ? "Amount is valid" : "Amount validation failed";
            ValidationResponse response = new ValidationResponse(
                isValid,
                message,
                rule.getFixedAmount() != null ? rule.getFixedAmount() : rule.getMinAmount(),
                request.getServiceAmount(),
                rule.getPricingType()
            );
            
            return ResponseEntity.ok(response);
        } catch (VendorRuleNotFoundException e) {
            log.warn("Vendor rule not found for validation: {}", e.getMessage());
            ValidationResponse response = new ValidationResponse(
                false,
                "Vendor rule not found for " + request.getVendorCode() + " and " + request.getServiceName(),
                null,
                request.getServiceAmount(),
                null
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error validating service amount", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}