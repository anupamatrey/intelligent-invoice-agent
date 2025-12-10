package com.anupam.mcp.server.tools;

import com.anupam.mcp.server.service.ExtractInvoiceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class ValidateInvoice {
    private static final Logger LOG = LoggerFactory.getLogger(ValidateInvoice.class);

    @Autowired
    private ExtractInvoiceService extractInvoiceService;

    @Tool(name = "validate_invoice", description = "Validate a invoice.")
    public Flux<String> validateInvoice(String input) {
        LOG.info("Validate invoice via ValidateInvoice tool with input: {}", input);
        // Placeholder for invoice processing logic
        return Flux.just("Invoice processed successfully.");
    }

}
