package com.anupam.mcp.server.tools;

import com.anupam.mcp.server.service.ExtractInvoiceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class ExtractInvoice {
    private static final Logger LOG = LoggerFactory.getLogger(ExtractInvoice.class);

    @Autowired
    private ExtractInvoiceService extractInvoiceService;

    @Tool(name = "upload_invoice", description = "Upload and process a invoice.")
    public Flux<String> uploadInvoice(String input) {
        LOG.info("Processing invoice via ExtractInvoice tool with input: {}", input);
        // Placeholder for invoice processing logic
        return Flux.just("Invoice processed successfully.");
    }

}
