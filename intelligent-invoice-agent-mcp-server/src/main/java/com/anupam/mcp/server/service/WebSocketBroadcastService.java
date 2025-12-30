package com.anupam.mcp.server.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service for broadcasting messages to WebSocket clients with Resilience4j.
 * <p>
 * Handles real-time message delivery from Kafka to connected UI clients
 * via WebSocket. Includes retry logic, circuit breaker, and fallback
 * mechanisms for reliability and fault tolerance.
 * </p>
 * 
 * @author Anupam
 * @version 2.0
 * @since 2024
 */
@Service
public class WebSocketBroadcastService {

    private static final Logger LOG = LoggerFactory.getLogger(WebSocketBroadcastService.class);
    private static final String INVOICE_TOPIC = "/topic/invoice-updates";
    private static final String DUPLICATE_INVOICE_TOPIC = "/topic/duplicate_invoice";
    private static final String ERROR_TOPIC = "/topic/invoice-errors";
    
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Constructs the WebSocketBroadcastService.
     *
     * @param messagingTemplate Spring's messaging template for WebSocket
     */
    public WebSocketBroadcastService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Broadcasts invoice message to all connected WebSocket clients.
     * <p>
     * Resilience4j Configuration:
     * - Retry: 3 attempts with exponential backoff (2s, 4s, 8s)
     * - Circuit Breaker: Opens after 50% failure rate
     * - Fallback: Sends error notification to clients
     * </p>
     *
     * @param message the invoice message to broadcast
     */
    @Retry(name = "websocketBroadcast", fallbackMethod = "broadcastFallback")
    @CircuitBreaker(name = "websocketBroadcast", fallbackMethod = "broadcastFallback")
    public void broadcastInvoiceUpdate(String message, Boolean isDuplicate) {
        LOG.info("📡 Broadcasting invoice update to WebSocket clients");
        if(Boolean.TRUE.equals(isDuplicate)) {
            messagingTemplate.convertAndSend(DUPLICATE_INVOICE_TOPIC, message);
            LOG.info("✅ Successfully broadcast duplicate invoice message to {}", DUPLICATE_INVOICE_TOPIC);
        } else {
            messagingTemplate.convertAndSend(INVOICE_TOPIC, message);
            LOG.info("✅ Successfully broadcast message to {}", INVOICE_TOPIC);
        }
    }

    /**
     * Fallback method when broadcast fails after all retries.
     * <p>
     * Sends error notification to clients and logs the failure.
     * This ensures clients are aware of processing issues.
     * </p>
     *
     * @param message the original message that failed
     * @param throwable the exception that caused the failure
     */
    public void broadcastFallback(String message, Boolean isDuplicate,Throwable throwable) {
        LOG.error("❌ WebSocket broadcast failed after retries. Sending error notification.", throwable);
        
        try {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", "Failed to deliver invoice update");
            errorResponse.put("error", throwable.getMessage());
            errorResponse.put("timestamp", System.currentTimeMillis());
            errorResponse.put("originalMessage", message);
            
            // Send error notification to error topic
            messagingTemplate.convertAndSend(ERROR_TOPIC, errorResponse);
            LOG.info("⚠️ Error notification sent to {}", ERROR_TOPIC);
        } catch (Exception e) {
            LOG.error("❌ Failed to send error notification: {}", e.getMessage());
        }
    }

    /**
     * Broadcasts invoice message with custom topic.
     *
     * @param topic custom topic destination
     * @param message the message to broadcast
     */
    @Retry(name = "websocketBroadcast")
    public void broadcastToTopic(String topic, String message) {
        LOG.info("📡 Broadcasting to custom topic: {}", topic);
        messagingTemplate.convertAndSend(topic, message);
        LOG.info("✅ Successfully broadcast to {}", topic);
    }
}
