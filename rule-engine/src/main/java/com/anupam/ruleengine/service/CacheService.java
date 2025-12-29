package com.anupam.ruleengine.service;

import com.anupam.ruleengine.entity.VendorServiceRule;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class CacheService {
    
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    
    @Value("${cache.ttl:3600}")
    private long cacheTtl;
    
    private static final String CACHE_KEY_PREFIX = "vendor_rule:";
    
    public void cacheVendorRule(String vendorCode, String serviceName, VendorServiceRule rule) {
        try {
            String key = CACHE_KEY_PREFIX + vendorCode + ":" + serviceName;
            String value = objectMapper.writeValueAsString(rule);
            redisTemplate.opsForValue().set(key, value, cacheTtl, TimeUnit.SECONDS);
            log.debug("Cached vendor rule for vendor code: {} and service: {}", vendorCode, serviceName);
        } catch (JsonProcessingException e) {
            log.error("Error caching vendor rule for vendor code: {} and service: {}", vendorCode, serviceName, e);
        }
    }
    
    public VendorServiceRule getCachedVendorRule(String vendorCode, String serviceName) {
        try {
            String key = CACHE_KEY_PREFIX + vendorCode + ":" + serviceName;
            String cachedValue = redisTemplate.opsForValue().get(key);
            if (cachedValue != null) {
                log.debug("Cache hit for vendor code: {} and service: {}", vendorCode, serviceName);
                return objectMapper.readValue(cachedValue, VendorServiceRule.class);
            }
            log.debug("Cache miss for vendor code: {} and service: {}", vendorCode, serviceName);
            return null;
        } catch (JsonProcessingException e) {
            log.error("Error retrieving cached vendor rule for vendor code: {} and service: {}", vendorCode, serviceName, e);
            return null;
        }
    }
    
    public void evictCache(String vendorCode, String serviceName) {
        String key = CACHE_KEY_PREFIX + vendorCode + ":" + serviceName;
        redisTemplate.delete(key);
        log.debug("Evicted cache for vendor code: {} and service: {}", vendorCode, serviceName);
    }
}