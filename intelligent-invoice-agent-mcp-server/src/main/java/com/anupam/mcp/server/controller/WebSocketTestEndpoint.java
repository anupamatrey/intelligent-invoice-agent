package com.anupam.mcp.server.controller;

import com.anupam.mcp.server.model.Invoice;
import com.anupam.mcp.server.model.RuleEngineResponse;
import com.anupam.mcp.server.service.InvoiceNotificationService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Test controller for WebSocket debugging.
 */
@RestController
@RequestMapping("/api/v1/test")
@CrossOrigin(originPatterns = "*")
public class WebSocketTestEndpoint {
    
    private final InvoiceNotificationService notificationService;
    
    public WebSocketTestEndpoint(InvoiceNotificationService notificationService) {
        this.notificationService = notificationService;
    }
    
    @GetMapping("/health")
    public String health() {
        return "WebSocket Test Endpoint is running on port 8081";
    }
    
    @PostMapping("/broadcast-rejected")
    public String testBroadcast() {
        // Create test invoice
        Invoice testInvoice = new Invoice(
            "TEST-001",
            "Test Vendor",
            "VEND001",
            "DELIVERY",
            LocalDate.now(),
            new BigDecimal("25.50"),
            "Test invoice for WebSocket"
        );
        
        // Create test rejection response
        RuleEngineResponse ruleResponse = new RuleEngineResponse(false, "Amount validation failed - TEST");
        ruleResponse.setExpectedAmount(new BigDecimal("50.00"));
        ruleResponse.setActualAmount(new BigDecimal("25.50"));
        ruleResponse.setPricingType("FIXED");
        
        // Broadcast
        notificationService.broadcastRejectedInvoice(testInvoice, ruleResponse, "test.xlsx", "MANUAL_TEST");
        
        return "Test broadcast sent! Check your WebSocket client.";
    }
}
