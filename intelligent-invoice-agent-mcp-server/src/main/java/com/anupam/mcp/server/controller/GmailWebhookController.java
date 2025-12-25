package com.anupam.mcp.server.controller;

import com.anupam.mcp.server.service.GmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/webhook/gmail")
public class GmailWebhookController {
    private static final Logger LOG = LoggerFactory.getLogger(GmailWebhookController.class);
    
    private final GmailService gmailService;

    public GmailWebhookController(GmailService gmailService) {
        this.gmailService = gmailService;
    }

    @PostMapping("/push")
    public ResponseEntity<String> handlePushNotification(@RequestBody Map<String, Object> payload) {
        try {
            LOG.info("Received Gmail push notification");
            
            Map<String, Object> message = (Map<String, Object>) payload.get("message");
            if (message != null) {
                String data = (String) message.get("data");
                if (data != null) {
                    String decoded = new String(Base64.getDecoder().decode(data));
                    LOG.debug("Push notification data: {}", decoded);
                }
                
                String messageId = (String) message.get("messageId");
                gmailService.handlePushNotification(messageId);
            }
            
            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            LOG.error("Error handling push notification", e);
            return ResponseEntity.ok("OK");
        }
    }
}
