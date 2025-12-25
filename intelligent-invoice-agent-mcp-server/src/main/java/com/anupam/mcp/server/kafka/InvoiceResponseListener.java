package com.anupam.mcp.server.kafka;

import com.anupam.mcp.server.service.WebSocketBroadcastService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

/**
 * Kafka consumer listener for processing invoice response messages.
 * <p>
 * This component listens to the configured Kafka topic and processes incoming
 * invoice analysis responses from the Python API. Messages are automatically
 * deserialized, validated, and broadcast to connected WebSocket clients for
 * real-time UI updates.
 * </p>
 * 
 * @author Anupam
 * @version 1.0
 * @since 2024
 */
@Component
public class InvoiceResponseListener {

    private static final Logger LOG = LoggerFactory.getLogger(InvoiceResponseListener.class);
    private final ObjectMapper objectMapper;
    private final WebSocketBroadcastService webSocketBroadcastService;

    /**
     * Constructs the InvoiceResponseListener with required dependencies.
     *
     * @param objectMapper Jackson ObjectMapper for JSON parsing
     * @param webSocketBroadcastService service for broadcasting to WebSocket clients
     */
    public InvoiceResponseListener(ObjectMapper objectMapper, WebSocketBroadcastService webSocketBroadcastService) {
        this.objectMapper = objectMapper;
        this.webSocketBroadcastService = webSocketBroadcastService;
    }

    /**
     * Consumes and processes invoice response messages from Kafka topic.
     * <p>
     * This method is automatically invoked when a new message arrives on the
     * configured Kafka topic. It performs the following operations:
     * 1. Validates and deserializes the JSON message
     * 2. Logs the processing result with Kafka metadata
     * 3. Broadcasts the message to all connected WebSocket clients
     * 4. Handles errors gracefully without disrupting the consumer
     * </p>
     *
     * @param message the raw JSON message payload from Kafka
     * @param topic the Kafka topic from which the message was received
     * @param partition the Kafka partition number
     * @param offset the message offset in the partition
     */
    @KafkaListener(
            topics = "${kafka.topic.invoice-response:push-analysis-data-topic}",
            groupId = "${spring.kafka.consumer.group-id:spring-local-consumer}",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void consume(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset
    ) {
        try {
            LOG.info("📩 Received message from Kafka [topic={}, partition={}, offset={}]", topic, partition, offset);
            LOG.debug("Message content: {}", message);
            
            // Validate message is not empty
            if (message == null || message.trim().isEmpty()) {
                LOG.warn("⚠️ Received empty message, skipping processing");
                return;
            }
            
            // Parse and validate JSON structure
            Object parsedMessage = objectMapper.readValue(message, Object.class);
            LOG.info("✅ Successfully parsed invoice response: {}", parsedMessage);
            
            // Broadcast to WebSocket clients (with retry)
            try {
                webSocketBroadcastService.broadcastInvoiceUpdate(message);
                LOG.info("📡 Message broadcast to UI clients successfully");
            } catch (Exception broadcastException) {
                LOG.error("❌ Failed to broadcast message after retries: {}", broadcastException.getMessage());
                // Continue processing - don't fail Kafka consumer
            }
            
        } catch (com.fasterxml.jackson.core.JsonProcessingException jsonException) {
            LOG.error("❌ Invalid JSON format from topic [{}]: {}", topic, jsonException.getMessage());
            LOG.error("Raw message: {}", message);
        } catch (Exception e) {
            LOG.error("❌ Unexpected error processing Kafka message from topic [{}]: {}", topic, e.getMessage(), e);
        }
    }
}
