package com.anupam.mcp.server.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

/**
 * Configuration for Resilience4j event logging.
 * <p>
 * Registers event listeners for retry and circuit breaker events
 * to provide detailed logging of resilience patterns in action.
 * </p>
 * 
 * @author Anupam
 * @version 1.0
 * @since 2024
 */
@Configuration
public class ResilienceEventConfig {

    private static final Logger LOG = LoggerFactory.getLogger(ResilienceEventConfig.class);

    private final RetryRegistry retryRegistry;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public ResilienceEventConfig(RetryRegistry retryRegistry, CircuitBreakerRegistry circuitBreakerRegistry) {
        this.retryRegistry = retryRegistry;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
    }

    @PostConstruct
    public void registerEventListeners() {
        // Register retry event listeners
        retryRegistry.retry("externalApi").getEventPublisher()
                .onRetry(event -> LOG.warn("🔄 Retry attempt {} for externalApi: {}", 
                        event.getNumberOfRetryAttempts(), event.getLastThrowable().getMessage()))
                .onSuccess(event -> LOG.info("✅ externalApi call succeeded after {} attempts", 
                        event.getNumberOfRetryAttempts()))
                .onError(event -> LOG.error("❌ externalApi failed after {} retry attempts: {}", 
                        event.getNumberOfRetryAttempts(), event.getLastThrowable().getMessage()));

        retryRegistry.retry("websocketBroadcast").getEventPublisher()
                .onRetry(event -> LOG.warn("🔄 Retry attempt {} for websocketBroadcast: {}", 
                        event.getNumberOfRetryAttempts(), event.getLastThrowable().getMessage()))
                .onSuccess(event -> LOG.info("✅ websocketBroadcast succeeded after {} attempts", 
                        event.getNumberOfRetryAttempts()))
                .onError(event -> LOG.error("❌ websocketBroadcast failed after {} retry attempts: {}", 
                        event.getNumberOfRetryAttempts(), event.getLastThrowable().getMessage()));

        // Register circuit breaker event listeners
        circuitBreakerRegistry.circuitBreaker("externalApi").getEventPublisher()
                .onStateTransition(event -> LOG.warn("⚡ Circuit Breaker 'externalApi' state changed: {} -> {}", 
                        event.getStateTransition().getFromState(), 
                        event.getStateTransition().getToState()))
                .onFailureRateExceeded(event -> LOG.error("🔥 Circuit Breaker 'externalApi' failure rate exceeded: {}%", 
                        event.getFailureRate()))
                .onSlowCallRateExceeded(event -> LOG.warn("🐌 Circuit Breaker 'externalApi' slow call rate exceeded: {}%", 
                        event.getSlowCallRate()))
                .onCallNotPermitted(event -> LOG.warn("🚫 Circuit Breaker 'externalApi' call not permitted (circuit is OPEN)"));

        circuitBreakerRegistry.circuitBreaker("websocketBroadcast").getEventPublisher()
                .onStateTransition(event -> LOG.warn("⚡ Circuit Breaker 'websocketBroadcast' state changed: {} -> {}", 
                        event.getStateTransition().getFromState(), 
                        event.getStateTransition().getToState()))
                .onFailureRateExceeded(event -> LOG.error("🔥 Circuit Breaker 'websocketBroadcast' failure rate exceeded: {}%", 
                        event.getFailureRate()))
                .onCallNotPermitted(event -> LOG.warn("🚫 Circuit Breaker 'websocketBroadcast' call not permitted (circuit is OPEN)"));

        LOG.info("✅ Resilience4j event listeners registered successfully");
    }
}
