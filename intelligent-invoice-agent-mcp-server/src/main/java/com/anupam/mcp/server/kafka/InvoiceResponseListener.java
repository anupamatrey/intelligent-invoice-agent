package com.anupam.mcp.server.kafka;

import com.anupam.mcp.server.model.Invoice;
import com.anupam.mcp.server.service.InvoicePersistenceService;
import com.anupam.mcp.server.service.WebSocketBroadcastService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

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
    private final InvoicePersistenceService invoicePersistenceService;

    /**
     * Constructs the InvoiceResponseListener with required dependencies.
     *
     * @param objectMapper Jackson ObjectMapper for JSON parsing
     * @param webSocketBroadcastService service for broadcasting to WebSocket clients
     */
    public InvoiceResponseListener(ObjectMapper objectMapper, WebSocketBroadcastService webSocketBroadcastService, InvoicePersistenceService invoicePersistenceService) {
        this.objectMapper = objectMapper;
        this.webSocketBroadcastService = webSocketBroadcastService;
        this.invoicePersistenceService = invoicePersistenceService;
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
    @SuppressWarnings("unchecked")
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
            
            // Parse JSON to extract invoice data
            var parsedMessage = objectMapper.readValue(message, Map.class);
            LOG.info("✅ Successfully parsed invoice response: {}", parsedMessage);
            Boolean isDuplicate = null;
            // Extract invoice_data.invoice object
            try {
                var invoiceData = (Map<String, Object>) parsedMessage.get("invoice_data");
                if (invoiceData != null) {
                    // Log is_duplicate status
                    isDuplicate = (Boolean) invoiceData.get("is_duplicate");
                    LOG.info("🔍 Invoice duplicate status: {}", isDuplicate);
                    
                    var invoiceMap = (Map<String, Object>) invoiceData.get("invoice");
                    if (invoiceMap != null) {
                        // Map to Invoice model
                        var invoice = new Invoice();
                        invoice.setInvoiceNumber((String) invoiceMap.get("invoice_number"));
                        invoice.setVendor((String) invoiceMap.get("vendor"));
                        invoice.setVendorCode((String) invoiceMap.get("vendor_code"));
                        invoice.setService((String) invoiceMap.get("service"));
                        invoice.setDate(LocalDate.parse((String) invoiceMap.get("date")));
                        invoice.setTotalAmount(new BigDecimal(invoiceMap.get("total_amount").toString()));
                        invoice.setDuplicate(isDuplicate);
                        invoice.setStatus(isDuplicate ? "DUPLICATE" : "APPROVED");

                        // Save to database
                        invoicePersistenceService.saveInvoice(invoice, null, "kafka-message", null, isDuplicate);
                        LOG.info("💾 Saved invoice {} to database", invoice.getInvoiceNumber());
                    }
                }
            } catch (Exception parseException) {
                LOG.error("❌ Failed to parse invoice data: {}", parseException.getMessage());
            }

            if(Boolean.FALSE.equals(isDuplicate)) {
                // Broadcast to WebSocket clients
                try {
                    webSocketBroadcastService.broadcastInvoiceUpdate(message, isDuplicate);
                    LOG.info("📡 Message broadcast to UI clients successfully");
                } catch (Exception broadcastException) {
                    LOG.error("❌ Failed to broadcast message: {}", broadcastException.getMessage());
                }
            }
            if(Boolean.TRUE.equals(isDuplicate)) {
                // Broadcast to WebSocket clients
                try {
                    webSocketBroadcastService.broadcastInvoiceUpdate(message,isDuplicate);
                    LOG.info("📡 Duplicate Invoice Message broadcast to UI clients successfully");
                } catch (Exception broadcastException) {
                    LOG.error("❌ Duplicate Invoice Message Failed to broadcast message: {}", broadcastException.getMessage());
                }
            }
            
        } catch (JsonProcessingException jsonException) {
            LOG.error("❌ Invalid JSON format from topic [{}]: {}", topic, jsonException.getMessage());
            LOG.error("Raw message: {}", message);
        } catch (Exception e) {
            LOG.error("❌ Unexpected error processing Kafka message from topic [{}]: {}", topic, e.getMessage(), e);
        }
    }
}
