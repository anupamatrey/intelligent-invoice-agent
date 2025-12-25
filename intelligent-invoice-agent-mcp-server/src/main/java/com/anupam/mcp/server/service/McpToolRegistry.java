package com.anupam.mcp.server.service;

import com.anupam.mcp.server.tools.EmailReaderTool;
import com.anupam.mcp.server.tools.ExtractInvoice;
import com.anupam.mcp.server.tools.StreamData;
import com.anupam.mcp.server.tools.ValidateInvoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Registry for MCP tools, exposing tool names and call dispatching.
 * <p>
 * Tools are registered via constructor injection and can be listed or invoked by name.
 * </p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Service
public class McpToolRegistry {
    private static final Logger LOG = LoggerFactory.getLogger(McpToolRegistry.class);
    private final Map<String, Function<String, Flux<String>>> tools = new HashMap<>();


    /**
     * Constructs the registry and registers available tools.
     *
     * @param extractInvoice tool for invoice extraction
     * @param validateInvoice tool for invoice validation
     * @param streamData tool for streaming customer data
     * @param emailReaderTool tool for triggering Gmail polling
     */
    public McpToolRegistry(ExtractInvoice extractInvoice, ValidateInvoice validateInvoice, 
                          StreamData streamData, EmailReaderTool emailReaderTool) {
        // Register tools dynamically
        tools.put("extractInvoice", extractInvoice::uploadInvoice);
        tools.put("validateInvoice", validateInvoice::validateInvoice);
        tools.put("streamCustomerData", streamData::streamCustomerData);
        tools.put("triggerEmailPoll", input -> Flux.just(emailReaderTool.triggerEmailPoll(input)));
    }

    /**
     * List all tools available in the registry.
     *
     * @return array of tool names
     */
    public String[] listAllTools() {
        return tools.keySet().toArray(new String[0]);
    }

    /**
     * Call a tool by name and return a reactive stream of results.
     *
     * @param toolName the tool name
     * @param input    input to the tool
     * @return Flux of output from the tool, or an error message if not found
     */
    public Flux<String> callTool(String toolName, String input) {
        if (tools.containsKey(toolName)) {
            return tools.get(toolName).apply(input);
        } else {
            return Flux.just("Error: Tool not found");
        }
    }
}
