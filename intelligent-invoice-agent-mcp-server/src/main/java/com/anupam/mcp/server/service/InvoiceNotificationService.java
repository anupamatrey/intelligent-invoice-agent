package com.anupam.mcp.server.service;

import com.anupam.mcp.server.model.Invoice;
import com.anupam.mcp.server.model.RejectedInvoiceNotification;
import com.anupam.mcp.server.model.RuleEngineResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Service for broadcasting invoice notifications via WebSocket.
 * 
 * @author Anupam Sharma
 * @since 2.0
 */
@Service
public class InvoiceNotificationService {
    private static final Logger LOG = LoggerFactory.getLogger(InvoiceNotificationService.class);
    private static final String REJECTED_TOPIC = "/topic/invoices/rejected";
    
    private final SimpMessagingTemplate messagingTemplate;
    
    public InvoiceNotificationService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }
    
    /**
     * Broadcasts rejected invoice to all connected WebSocket clients.
     */
    public void broadcastRejectedInvoice(Invoice invoice, RuleEngineResponse ruleResponse, 
                                        String filename, String source) {
        try {
            RejectedInvoiceNotification notification = RejectedInvoiceNotification.from(
                invoice, ruleResponse, filename, source
            );
            
            LOG.info("📡 Broadcasting rejected invoice: {} to topic: {}", 
                    invoice.getInvoiceNumber(), REJECTED_TOPIC);
            
            messagingTemplate.convertAndSend(REJECTED_TOPIC, notification);
            
            LOG.info("✅ Successfully broadcasted rejected invoice: {}", invoice.getInvoiceNumber());
            
        } catch (Exception e) {
            LOG.error("❌ Failed to broadcast rejected invoice: {}", invoice.getInvoiceNumber(), e);
        }
    }
}
