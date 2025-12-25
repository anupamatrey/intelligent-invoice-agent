package com.anupam.mcp.server.tools;

import com.anupam.mcp.server.service.ExtractInvoiceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

/**
 * MCP tool that accepts an input request to process an invoice.
 *
 * <p>Currently a placeholder for integration with {@link com.anupam.mcp.server.service.ExtractInvoiceService}.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Component
public class ExtractInvoice {
    private static final Logger LOG = LoggerFactory.getLogger(ExtractInvoice.class);

    @Autowired
    private ExtractInvoiceService extractInvoiceService;

    /**
     * Uploads and processes an invoice.
     *
     * @param input input payload or metadata (reserved)
     * @return flux with processing status
     */
    @Tool(name = "upload_invoice", description = "Upload and process a invoice.")
    public Flux<String> uploadInvoice(String input) {
        LOG.info("Processing invoice via ExtractInvoice tool with input: {}", input);
        // Placeholder for invoice processing logic
        return Flux.just("Invoice processed successfully.");
    }

}
