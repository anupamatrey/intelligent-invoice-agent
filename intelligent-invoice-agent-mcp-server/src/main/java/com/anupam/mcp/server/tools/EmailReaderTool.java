package com.anupam.mcp.server.tools;

import com.anupam.mcp.server.service.GmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * MCP tool that manually triggers Gmail check to process incoming invoice emails.
 *
 * <p>This tool delegates to {@link com.anupam.mcp.server.service.GmailService}.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Component
public class EmailReaderTool {
    private static final Logger LOG = LoggerFactory.getLogger(EmailReaderTool.class);
    
    private final GmailService gmailService;
    
    /**
     * Creates a new tool instance.
     *
     * @param gmailService Gmail integration service
     */
    public EmailReaderTool(GmailService gmailService) {
        this.gmailService = gmailService;
    }
    
    /**
     * Manually triggers Gmail check for new emails.
     *
     * @param input unused input payload (reserved for future options)
     * @return status message indicating success or error
     */
    public String triggerEmailPoll(String input) {
        LOG.info("MCP Tool: triggerEmailPoll called with input: {}", input);
        
        try {
            gmailService.handlePushNotification("manual-trigger");
            return "Gmail check completed successfully";
        } catch (Exception e) {
            LOG.error("Error during Gmail check", e);
            return "Error during Gmail check: " + e.getMessage();
        }
    }
}