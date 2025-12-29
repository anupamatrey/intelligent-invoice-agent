package com.anupam.mcp.server.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO for rejected invoice notifications sent via WebSocket.
 * 
 * @author Anupam Sharma
 * @since 2.0
 */
public class RejectedInvoiceNotification {
    
    @JsonProperty("invoice_number")
    private String invoiceNumber;
    
    @JsonProperty("vendor")
    private String vendor;
    
    @JsonProperty("vendor_code")
    private String vendorCode;
    
    @JsonProperty("service")
    private String service;
    
    @JsonProperty("date")
    private LocalDate date;
    
    @JsonProperty("amount")
    private BigDecimal amount;
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("rejection_reason")
    private String rejectionReason;
    
    @JsonProperty("expected_amount")
    private BigDecimal expectedAmount;
    
    @JsonProperty("pricing_type")
    private String pricingType;
    
    @JsonProperty("source")
    private String source;
    
    @JsonProperty("filename")
    private String filename;
    
    @JsonProperty("timestamp")
    private LocalDateTime timestamp;
    
    public RejectedInvoiceNotification() {
        this.timestamp = LocalDateTime.now();
    }
    
    public static RejectedInvoiceNotification from(Invoice invoice, RuleEngineResponse ruleResponse, 
                                                   String filename, String source) {
        RejectedInvoiceNotification notification = new RejectedInvoiceNotification();
        notification.setInvoiceNumber(invoice.getInvoiceNumber());
        notification.setVendor(invoice.getVendor());
        notification.setVendorCode(invoice.getVendorCode());
        notification.setService(invoice.getService());
        notification.setDate(invoice.getDate());
        notification.setAmount(invoice.getTotalAmount());
        notification.setDescription(invoice.getDescription());
        notification.setRejectionReason(ruleResponse.getReason());
        notification.setExpectedAmount(ruleResponse.getExpectedAmount());
        notification.setPricingType(ruleResponse.getPricingType());
        notification.setSource(source);
        notification.setFilename(filename);
        return notification;
    }
    
    // Getters and Setters
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    
    public String getVendor() { return vendor; }
    public void setVendor(String vendor) { this.vendor = vendor; }
    
    public String getVendorCode() { return vendorCode; }
    public void setVendorCode(String vendorCode) { this.vendorCode = vendorCode; }
    
    public String getService() { return service; }
    public void setService(String service) { this.service = service; }
    
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    
    public BigDecimal getExpectedAmount() { return expectedAmount; }
    public void setExpectedAmount(BigDecimal expectedAmount) { this.expectedAmount = expectedAmount; }
    
    public String getPricingType() { return pricingType; }
    public void setPricingType(String pricingType) { this.pricingType = pricingType; }
    
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
