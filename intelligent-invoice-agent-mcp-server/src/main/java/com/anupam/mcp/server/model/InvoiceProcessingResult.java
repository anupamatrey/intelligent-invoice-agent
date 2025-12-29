package com.anupam.mcp.server.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * Result of invoice processing workflow.
 * Contains status, validation results, and API responses.
 * 
 * @author Anupam Sharma
 * @since 2.0
 */
public class InvoiceProcessingResult {
    
    public enum Status {
        SUCCESS,           // Passed all validations and processed
        RULE_REJECTED,     // Failed rule engine validation
        ERROR,             // Processing error
        FILE_REJECTED      // File parsing failed
    }
    
    @JsonProperty("status")
    private Status status;
    
    @JsonProperty("invoice")
    private Invoice invoice;
    
    @JsonProperty("filename")
    private String filename;
    
    @JsonProperty("source")
    private String source;
    
    @JsonProperty("rule_response")
    private RuleEngineResponse ruleResponse;
    
    @JsonProperty("python_api_response")
    private String pythonApiResponse;
    
    @JsonProperty("error_message")
    private String errorMessage;
    
    @JsonProperty("processed_at")
    private LocalDateTime processedAt;
    
    // Private constructor - use factory methods
    private InvoiceProcessingResult() {
        this.processedAt = LocalDateTime.now();
    }
    
    // Factory Methods
    public static InvoiceProcessingResult success(Invoice invoice, 
                                                  RuleEngineResponse ruleResponse,
                                                  String pythonResponse,
                                                  String filename,
                                                  String source) {
        InvoiceProcessingResult result = new InvoiceProcessingResult();
        result.status = Status.SUCCESS;
        result.invoice = invoice;
        result.ruleResponse = ruleResponse;
        result.pythonApiResponse = pythonResponse;
        result.filename = filename;
        result.source = source;
        return result;
    }
    
    public static InvoiceProcessingResult ruleRejected(Invoice invoice,
                                                       RuleEngineResponse ruleResponse,
                                                       String filename,
                                                       String source) {
        InvoiceProcessingResult result = new InvoiceProcessingResult();
        result.status = Status.RULE_REJECTED;
        result.invoice = invoice;
        result.ruleResponse = ruleResponse;
        result.errorMessage = ruleResponse.getReason();
        result.filename = filename;
        result.source = source;
        return result;
    }
    
    public static InvoiceProcessingResult error(Invoice invoice,
                                               String errorMessage,
                                               String filename,
                                               String source) {
        InvoiceProcessingResult result = new InvoiceProcessingResult();
        result.status = Status.ERROR;
        result.invoice = invoice;
        result.errorMessage = errorMessage;
        result.filename = filename;
        result.source = source;
        return result;
    }
    
    public static InvoiceProcessingResult error(String filename, String errorMessage) {
        InvoiceProcessingResult result = new InvoiceProcessingResult();
        result.status = Status.ERROR;
        result.filename = filename;
        result.errorMessage = errorMessage;
        return result;
    }
    
    public static InvoiceProcessingResult rejected(String filename, String reason) {
        InvoiceProcessingResult result = new InvoiceProcessingResult();
        result.status = Status.FILE_REJECTED;
        result.filename = filename;
        result.errorMessage = reason;
        return result;
    }
    
    // Getters
    public Status getStatus() { return status; }
    public Invoice getInvoice() { return invoice; }
    public String getFilename() { return filename; }
    public String getSource() { return source; }
    public RuleEngineResponse getRuleResponse() { return ruleResponse; }
    public String getPythonApiResponse() { return pythonApiResponse; }
    public String getErrorMessage() { return errorMessage; }
    public LocalDateTime getProcessedAt() { return processedAt; }
    
    public boolean isSuccess() { return status == Status.SUCCESS; }
    public boolean isRejected() { return status == Status.RULE_REJECTED || status == Status.FILE_REJECTED; }
    public boolean isError() { return status == Status.ERROR; }
}
