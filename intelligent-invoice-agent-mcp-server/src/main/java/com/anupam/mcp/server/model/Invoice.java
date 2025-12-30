package com.anupam.mcp.server.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Represents an invoice record parsed from uploaded files or external sources.
 *
 * <p>Contains basic invoice attributes such as number, vendor, date, total amount, and description.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
public class Invoice {
    @JsonProperty("invoice_number")
    private String invoiceNumber;
    
    @JsonProperty("vendor")
    private String vendor;
    
    @JsonProperty("vendor_code")
    private String vendorCode;
    
    @JsonProperty("service")
    private String service;
    
    @JsonProperty("date")
    @com.fasterxml.jackson.databind.annotation.JsonSerialize(using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private LocalDate date;
    
    @JsonProperty("total_amount")
    @com.fasterxml.jackson.databind.annotation.JsonSerialize(using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
    private BigDecimal totalAmount;
    
    @JsonProperty("description")
    private String description;
    
    @JsonProperty("status")
    private String status;
    
    @JsonProperty("rejected_reason")
    private String rejectedReason;

    @JsonProperty("is_duplicate")
    private java.lang.Boolean isDuplicate;

    /**
     * Creates an empty invoice instance.
     */
    public Invoice() {}

    /**
     * Creates a populated invoice instance.
     *
     * @param invoiceNumber invoice identifier/number
     * @param vendor        vendor name
     * @param vendorCode    vendor code
     * @param service       service type
     * @param date          invoice date
     * @param totalAmount   total amount
     * @param description   optional description or notes
     */
    public Invoice(String invoiceNumber, String vendor, String vendorCode, String service,
                   LocalDate date, BigDecimal totalAmount, String description) {
        this.invoiceNumber = invoiceNumber;
        this.vendor = vendor;
        this.vendorCode = vendorCode;
        this.service = service;
        this.date = date;
        this.totalAmount = totalAmount;
        this.description = description;
        this.status = "PENDING";
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

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    
    public String getRejectedReason() { return rejectedReason; }
    public void setRejectedReason(String rejectedReason) { this.rejectedReason = rejectedReason; }

    public Boolean getDuplicate() { return isDuplicate; }
    public void setDuplicate(Boolean duplicate) { isDuplicate = duplicate; }
}