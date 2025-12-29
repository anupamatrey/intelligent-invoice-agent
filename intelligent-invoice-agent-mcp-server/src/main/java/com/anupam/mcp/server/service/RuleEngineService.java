package com.anupam.mcp.server.service;

import com.anupam.mcp.server.model.RuleEngineResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Service for validating invoices against business rules.
 * Calls external Rule Engine API to check vendor pricing limits.
 * 
 * @author Anupam Sharma
 * @since 2.0
 */
@Service
public class RuleEngineService {
    private static final Logger LOG = LoggerFactory.getLogger(RuleEngineService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    
    @Value("${rule.engine.api.url:http://localhost:8082/api/vendor-rules}")
    private String ruleEngineApiUrl;
    
    @Value("${rule.engine.enabled:true}")
    private boolean ruleEngineEnabled;
    
    /**
     * Validates invoice with amount check.
     * Calls POST /api/vendor-rules/validate
     * 
     * @param vendorCode vendor identifier
     * @param service service type
     * @param amount invoice amount
     * @return validation response
     */
    @Retry(name = "ruleEngine", fallbackMethod = "validateInvoiceFallback")
    @CircuitBreaker(name = "ruleEngine", fallbackMethod = "validateInvoiceFallback")
    public RuleEngineResponse validateInvoice(String vendorCode, String service, BigDecimal amount) {
        if (!ruleEngineEnabled) {
            LOG.info("🔓 Rule engine disabled - auto-approving invoice");
            return new RuleEngineResponse(true, "Rule engine disabled");
        }
        
        try {
            LOG.info("🔍 Validating invoice: vendorCode={}, service={}, amount={}", 
                     vendorCode, service, amount);
            
            String url = ruleEngineApiUrl + "/validate";
            LOG.info("🎯 Calling Rule Engine API: POST {}", url);
            
            // Build request body
            Map<String, Object> request = new HashMap<>();
            request.put("vendorCode", vendorCode);
            request.put("serviceName", service);
            request.put("serviceAmount", amount);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            
            RuleEngineResponse response = restTemplate.postForObject(url, entity, RuleEngineResponse.class);
            
            if (response == null) {
                LOG.warn("⚠️ Rule Engine returned null response");
                return new RuleEngineResponse(false, "No response from rule engine");
            }
            
            LOG.info("✅ Rule validation result: valid={}, message={}", 
                     response.isValid(), response.getReason());
            return response;
            
        } catch (Exception e) {
            LOG.error("❌ Rule Engine API error: {}", e.getMessage(), e);
            throw new RuntimeException("Rule Engine API failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Fallback when Rule Engine API is unavailable.
     */
    public RuleEngineResponse validateInvoiceFallback(String vendorCode, String service, 
                                                      BigDecimal amount, Throwable throwable) {
        LOG.error("❌ Rule Engine unavailable. Auto-approving invoice.", throwable);
        return new RuleEngineResponse(true, "Rule engine unavailable - auto-approved");
    }
}
