package com.anupam.mcp.server.controller;

import com.anupam.mcp.server.service.WebSocketBroadcastService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/test")
public class WebSocketTestController {

    private final WebSocketBroadcastService webSocketBroadcastService;

    public WebSocketTestController(WebSocketBroadcastService webSocketBroadcastService) {
        this.webSocketBroadcastService = webSocketBroadcastService;
    }

    @PostMapping("/broadcast")
    public Map<String, String> testBroadcast(@RequestBody String message) {
        webSocketBroadcastService.broadcastInvoiceUpdate(message,false);
        return Map.of("status", "Message broadcast to WebSocket clients");
    }
}
