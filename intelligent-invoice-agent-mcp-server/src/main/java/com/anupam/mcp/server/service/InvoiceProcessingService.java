package com.anupam.mcp.server.service;

import com.anupam.mcp.server.model.Invoice;
import com.anupam.mcp.server.model.InvoiceProcessingResult;
import com.anupam.mcp.server.model.RuleEngineResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Centralized service for invoice processing workflow.
 * Handles parsing, rule validation, and Python API integration.
 * 
 * @author Anupam Sharma
 * @since 2.0
 */
@Service
public class InvoiceProcessingService {
    private static final Logger LOG = LoggerFactory.getLogger(InvoiceProcessingService.class);
    
    private final ExcelParser excelParser;
    private final RuleEngineService ruleEngineService;
    private final ExtractInvoiceService extractInvoiceService;
    private final WebSocketBroadcastService webSocketBroadcastService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    
    public InvoiceProcessingService(ExcelParser excelParser, 
                                   RuleEngineService ruleEngineService,
                                   ExtractInvoiceService extractInvoiceService,
                                   WebSocketBroadcastService webSocketBroadcastService,
                                   com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.excelParser = excelParser;
        this.ruleEngineService = ruleEngineService;
        this.extractInvoiceService = extractInvoiceService;
        this.webSocketBroadcastService = webSocketBroadcastService;
        this.objectMapper = objectMapper;
    }
    
    /**
     * Process invoice from MultipartFile (Controller upload).
     * 
     * @param file uploaded Excel file
     * @param source source identifier (e.g., "MANUAL_UPLOAD", "EMAIL")
     * @return list of processing results
     */
    public List<InvoiceProcessingResult> processInvoiceFile(MultipartFile file, String source) {
        try {
            LOG.info("📄 Processing invoice file: {} from source: {}", file.getOriginalFilename(), source);
            List<Invoice> invoices = excelParser.parseInvoices(file.getInputStream());
            return processInvoices(invoices, file.getOriginalFilename(), source);
        } catch (Exception e) {
            LOG.error("❌ Error processing invoice file: {}", file.getOriginalFilename(), e);
            return List.of(InvoiceProcessingResult.error(file.getOriginalFilename(), 
                          "File processing failed: " + e.getMessage()));
        }
    }
    
    /**
     * Process invoice from InputStream (Gmail attachment).
     * 
     * @param inputStream Excel file input stream
     * @param filename original filename
     * @param source source identifier
     * @return list of processing results
     */
    public List<InvoiceProcessingResult> processInvoiceStream(InputStream inputStream, 
                                                              String filename, 
                                                              String source) {
        try {
            LOG.info("📄 Processing invoice stream: {} from source: {}", filename, source);
            List<Invoice> invoices = excelParser.parseInvoices(inputStream);
            return processInvoices(invoices, filename, source);
        } catch (Exception e) {
            LOG.error("❌ Error processing invoice stream: {}", filename, e);
            return List.of(InvoiceProcessingResult.error(filename, 
                          "Stream processing failed: " + e.getMessage()));
        }
    }
    
    /**
     * Process already parsed invoices (for Gmail service).
     * 
     * @param invoices parsed invoice list
     * @param filename source filename
     * @param source source identifier
     * @return list of processing results
     */
    public List<InvoiceProcessingResult> processInvoices(List<Invoice> invoices, 
                                                         String filename, 
                                                         String source) {
        List<InvoiceProcessingResult> results = new ArrayList<>();
        
        if (invoices.isEmpty()) {
            LOG.warn("⚠️ File '{}' rejected: No valid invoice data found", filename);
            return List.of(InvoiceProcessingResult.rejected(filename, 
                          "No valid invoice data found"));
        }
        
        LOG.info("✅ Parsed {} invoices from file: {}", invoices.size(), filename);
        
        for (Invoice invoice : invoices) {
            results.add(processSingleInvoice(invoice, filename, source));
        }
        
        return results;
    }
    
    /**
     * Process a single invoice through the complete workflow.
     * 
     * @param invoice invoice to process
     * @param filename source filename
     * @param source source identifier
     * @return processing result
     */
    private InvoiceProcessingResult processSingleInvoice(Invoice invoice, 
                                                         String filename, 
                                                         String source) {
        try {
            LOG.info("📋 Processing invoice: {} - {} - {} - {} - {} - {} - {}", 
                    invoice.getInvoiceNumber(), 
                    invoice.getVendor(),
                    invoice.getVendorCode(),
                    invoice.getService(),
                    invoice.getDate(),
                    invoice.getTotalAmount(),
                    invoice.getDescription());
            
            // Step 1: Validate against Rule Engine (includes amount validation)
            RuleEngineResponse ruleResponse = ruleEngineService.validateInvoice(
                invoice.getVendorCode(), 
                invoice.getService(), 
                invoice.getTotalAmount()
            );
            
            if (!ruleResponse.isValid()) {
                LOG.warn("❌ Invoice {} rejected by rule engine: {} for file: {} with source: {}",
                        invoice.getInvoiceNumber(), ruleResponse.getReason(), filename, source);
                
                // Broadcast rejection to WebSocket clients
                try {
                    var notification = com.anupam.mcp.server.model.RejectedInvoiceNotification.from(
                        invoice, ruleResponse, filename, source
                    );
                    String json = objectMapper.writeValueAsString(notification);
                    LOG.info("📡 Broadcasting rejection: {}", json);
                    webSocketBroadcastService.broadcastToTopic("/topic/invoices/rejected", json);
                } catch (Exception e) {
                    LOG.error("❌ Failed to broadcast rejection", e);
                }
                
                // Early return - don't call Python API for rejected invoices
                return InvoiceProcessingResult.ruleRejected(invoice, ruleResponse, filename, source);
            }
            
            LOG.info("✅ Invoice {} passed rule validation", invoice.getInvoiceNumber());
            
            // Step 2: Send to Python API for ML processing (only for valid invoices)
            String pythonResponse = extractInvoiceService.processInvoiceData(invoice);
            LOG.info("🐍 Python API response for invoice {}: {}", 
                    invoice.getInvoiceNumber(), pythonResponse);
            
            return InvoiceProcessingResult.success(invoice, ruleResponse, 
                                                  pythonResponse, filename, source);
            
        } catch (Exception e) {
            LOG.error("❌ Error processing invoice {}: {}", 
                     invoice.getInvoiceNumber(), e.getMessage(), e);
            return InvoiceProcessingResult.error(invoice, 
                                                "Processing failed: " + e.getMessage(), 
                                                filename, source);
        }
    }
}
