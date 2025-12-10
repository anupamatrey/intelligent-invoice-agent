package com.anupam.mcp.server.service;

import com.anupam.mcp.server.tools.ExtractInvoice;
import com.anupam.mcp.server.tools.ValidateInvoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
public class McpToolRegistry {
    private static final Logger LOG = LoggerFactory.getLogger(McpToolRegistry.class);
    private final Map<String, Function<String, Flux<String>>> tools = new HashMap<>();


    public McpToolRegistry(ExtractInvoice extractInvoice, ValidateInvoice validateInvoice) {
        // Register tools dynamically
        tools.put("extractInvoice", extractInvoice::uploadInvoice);
        tools.put("validateInvoice", validateInvoice::validateInvoice);
    }

    /**
     * List all tools available in the registry.
     * @return String array of tool names
     */
    public String[] listAllTools() {
        return tools.keySet().toArray(new String[0]);
    }

    /**
     * Call a tool by name and return the result.
     * @param toolName tool name
     * @param input input to the tool
     * @return Flux of output from the tool
     */
    public Flux<String> callTool(String toolName, String input) {
        if (tools.containsKey(toolName)) {
            return tools.get(toolName).apply(input);
        } else {
            return Flux.just("Error: Tool not found");
        }
    }
}
