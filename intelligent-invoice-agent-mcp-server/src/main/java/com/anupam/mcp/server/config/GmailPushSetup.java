package com.anupam.mcp.server.config;

import com.anupam.mcp.server.service.GmailService;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class GmailPushSetup {
    
    private final GmailService gmailService;

    public GmailPushSetup(GmailService gmailService) {
        this.gmailService = gmailService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void setupPushNotifications() {
        gmailService.setupPushNotifications();
        // Process any existing unread emails on startup
        gmailService.handlePushNotification("startup-check");
    }
}
