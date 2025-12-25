package com.anupam.mcp.server.tools;

import com.anupam.mcp.server.service.RandomDataGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

/**
 * MCP tool that streams customer data using the {@link com.anupam.mcp.server.service.RandomDataGenerator}.
 *
 * <p>Intended for demonstrating SSE or streaming capabilities.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Component
public class StreamData {
    private static final Logger LOG = LoggerFactory.getLogger(StreamData.class);
    
    private final RandomDataGenerator randomDataGenerator;
    
    /**
     * Creates a new tool instance.
     *
     * @param randomDataGenerator generator of random customer data
     */
    public StreamData(RandomDataGenerator randomDataGenerator) {
        this.randomDataGenerator = randomDataGenerator;
    }
    
    /**
     * Streams random customer data.
     *
     * @param input unused input payload (reserved for future options)
     * @return flux of customer records in JSON form
     */
    public Flux<String> streamCustomerData(String input) {
        LOG.info("MCP Tool: streamCustomerData called with input: {}", input);
        return randomDataGenerator.stream();
    }
}