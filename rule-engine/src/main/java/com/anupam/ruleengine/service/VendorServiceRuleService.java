package com.anupam.ruleengine.service;

import com.anupam.ruleengine.entity.VendorServiceRule;
import com.anupam.ruleengine.exception.VendorRuleNotFoundException;
import com.anupam.ruleengine.repository.VendorServiceRuleRepository;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class VendorServiceRuleService {
    
    private final VendorServiceRuleRepository repository;
    private final CacheService cacheService;
    
    @Transactional(readOnly = true)
    @Retry(name = "database")
    public VendorServiceRule getVendorRule(String vendorCode, String serviceName) {
        log.info("Fetching vendor rule for vendor code: {} and service: {}", vendorCode, serviceName);
        
        // Check cache first
        VendorServiceRule cachedRule = cacheService.getCachedVendorRule(vendorCode, serviceName);
        if (cachedRule != null) {
            return cachedRule;
        }
        
        // Cache miss - fetch from database
        try {
            Optional<VendorServiceRule> rule = repository.findActiveByVendorCodeAndServiceName(vendorCode, serviceName);
            if (rule.isPresent()) {
                // Cache the result
                cacheService.cacheVendorRule(vendorCode, serviceName, rule.get());
                log.info("Vendor rule found and cached for vendor code: {} and service: {}", vendorCode, serviceName);
                return rule.get();
            } else {
                log.warn("No active vendor rule found for vendor code: {} and service: {}", vendorCode, serviceName);
                throw new VendorRuleNotFoundException("No active rule found for vendor code: " + vendorCode + " and service: " + serviceName);
            }
        } catch (DataAccessException e) {
            log.error("Database error while fetching vendor rule for vendor code: {} and service: {}", vendorCode, serviceName, e);
            throw e; // Let retry handle this
        }
    }
    
    public VendorServiceRule getVendorRuleFallback(String vendorCode, String serviceName, Exception ex) {
        log.error("CRITICAL: Database unavailable for vendor code: {} and service: {} - REJECTING REQUEST to prevent wrong business rule application", vendorCode, serviceName);
        
        // Don't return wrong business rules - throw exception to fail fast
        throw new RuntimeException("Service temporarily unavailable - database connection failed after retries. Please try again later.");
    }
    
    @Transactional(readOnly = true)
    @Retry(name = "database", fallbackMethod = "getVendorRulesFallback")
    public List<VendorServiceRule> getVendorRules(String vendorCode) {
        try {
            return repository.findActiveByVendorCode(vendorCode);
        } catch (DataAccessException e) {
            log.error("Database error while fetching vendor rules for vendor code: {}", vendorCode, e);
            throw e; // Let retry handle this
        }
    }
    
    public List<VendorServiceRule> getVendorRulesFallback(String vendorCode, Exception ex) {
        log.warn("Fallback triggered for vendor rules for vendor code: {} due to: {}", vendorCode, ex.getMessage());
        return Collections.emptyList();
    }
    
    @Transactional
    @Retry(name = "database")
    public VendorServiceRule saveVendorRule(VendorServiceRule rule) {
        try {
            VendorServiceRule savedRule = repository.save(rule);
            // Update cache
            cacheService.cacheVendorRule(savedRule.getVendorCode(), savedRule.getServiceName(), savedRule);
            log.info("Vendor rule saved and cached for vendor code: {} and service: {}", savedRule.getVendorCode(), savedRule.getServiceName());
            return savedRule;
        } catch (DataAccessException e) {
            log.error("Database error while saving vendor rule for vendor code: {} and service: {}", rule.getVendorCode(), rule.getServiceName(), e);
            throw e; // Let retry handle this
        }
    }
    
    @Transactional
    @Retry(name = "database")
    public void deleteVendorRule(String vendorCode, String serviceName) {
        try {
            Optional<VendorServiceRule> rule = repository.findByVendorCodeAndServiceName(vendorCode, serviceName);
            if (rule.isPresent()) {
                repository.delete(rule.get());
                cacheService.evictCache(vendorCode, serviceName);
                log.info("Vendor rule deleted and cache evicted for vendor code: {} and service: {}", vendorCode, serviceName);
            } else {
                throw new VendorRuleNotFoundException("Vendor rule not found for vendor code: " + vendorCode + " and service: " + serviceName);
            }
        } catch (DataAccessException e) {
            log.error("Database error while deleting vendor rule for vendor code: {} and service: {}", vendorCode, serviceName, e);
            throw e; // Let retry handle this
        }
    }
    
    public boolean validateServiceAmount(VendorServiceRule rule, BigDecimal serviceAmount) {
        log.info("Validating service amount {} for vendor code: {} and service: {}", serviceAmount, rule.getVendorCode(), rule.getServiceName());

        return switch (rule.getPricingType()) {
            case "FIXED" -> rule.getFixedAmount() != null && rule.getFixedAmount().compareTo(serviceAmount) == 0;
            case "RANGE" -> (rule.getMinAmount() == null || serviceAmount.compareTo(rule.getMinAmount()) >= 0) &&
                    (rule.getMaxAmount() == null || serviceAmount.compareTo(rule.getMaxAmount()) <= 0);
            case "MAX" -> rule.getMaxAmount() != null && serviceAmount.compareTo(rule.getMaxAmount()) <= 0;
            default -> {
                log.warn("Unknown pricing type: {} for vendor: {}", rule.getPricingType(), rule.getVendorCode());
                yield false;
            }
        };
    }
}