package com.anupam.mcp.server.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

/**
 * Monitors WebSocket connections and subscriptions.
 */
@Component
public class WebSocketEventListener {
    private static final Logger LOG = LoggerFactory.getLogger(WebSocketEventListener.class);
    
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        LOG.info("🔌 WebSocket CONNECT event: sessionId={}", headerAccessor.getSessionId());
    }
    
    @EventListener
    public void handleWebSocketConnectedListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        LOG.info("✅ WebSocket CONNECTED (handshake complete): sessionId={}", headerAccessor.getSessionId());
    }
    
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        LOG.info("🔌 WebSocket disconnected: sessionId={}", headerAccessor.getSessionId());
    }
    
    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = headerAccessor.getDestination();
        LOG.info("📡 Client subscribed: sessionId={}, destination={}", 
                headerAccessor.getSessionId(), destination);
    }
}
