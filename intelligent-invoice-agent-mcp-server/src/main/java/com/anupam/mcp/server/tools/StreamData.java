package com.anupam.mcp.server.tools;

import com.anupam.mcp.server.service.RandomDataGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

@Component
public class StreamData {
    private static final Logger LOG = LoggerFactory.getLogger(StreamData.class);
    
    private final RandomDataGenerator randomDataGenerator;
    
    public StreamData(RandomDataGenerator randomDataGenerator) {
        this.randomDataGenerator = randomDataGenerator;
    }
    
    public Flux<String> streamCustomerData(String input) {
        LOG.info("MCP Tool: streamCustomerData called with input: {}", input);
        return randomDataGenerator.stream();
    }
}