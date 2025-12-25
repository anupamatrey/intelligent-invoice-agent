package com.anupam.mcp.server.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket configuration for real-time message broadcasting.
 * <p>
 * Enables STOMP protocol over WebSocket for bidirectional communication
 * between server and UI clients. Used to push Kafka messages to connected
 * web clients in real-time.
 * </p>
 * 
 * @author Anupam
 * @version 1.0
 * @since 2024
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    private static final Logger LOG = LoggerFactory.getLogger(WebSocketConfig.class);

    /**
     * Configures message broker for handling message routing.
     * <p>
     * - /topic: Server-to-client broadcast messages (Kafka to UI)
     * - /app: Client-to-server messages (if needed)
     * </p>
     *
     * @param config the message broker registry
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
        LOG.info("✅ WebSocket message broker configured");
    }

    /**
     * Registers STOMP endpoints for WebSocket connections.
     * <p>
     * Endpoint: /ws-invoice
     * - Allows connections from localhost:3000 (UI app)
     * - Enables SockJS fallback for browsers without WebSocket support
     * 
     * Endpoint: /ws-invoice-native
     * - Native WebSocket without SockJS (for testing tools like Insomnia)
     * </p>
     *
     * @param registry the STOMP endpoint registry
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // SockJS endpoint for browsers
        registry.addEndpoint("/ws-invoice")
                .setAllowedOriginPatterns("*")
                .withSockJS();
        
        // Native WebSocket endpoint for testing tools (Insomnia, Postman)
        registry.addEndpoint("/ws-invoice-native")
                .setAllowedOriginPatterns("*");
        
        LOG.info("✅ WebSocket endpoints registered: /ws-invoice, /ws-invoice-native");
    }
}
