package com.anupam.mcp.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Application entry point for Intelligent Invoice Agent MCP Server.
 *
 * <p>Bootstraps the Spring Boot application.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@SpringBootApplication
@EnableScheduling
public class IntelligentInvoiceAgentMcpServerApplication {

    /**
     * Starts the Spring Boot application.
     *
     * @param args command-line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(IntelligentInvoiceAgentMcpServerApplication.class, args);
    }

}
