package com.anupam.mcp.server.service;

import com.anupam.mcp.server.model.Invoice;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePart;
import com.google.api.services.gmail.model.MessagePartBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.Base64;
import java.util.List;

/**
 * Service for polling Gmail and processing invoice attachments.
 * <p>
 * Authenticates using OAuth client credentials and a refresh token, searches for unread
 * messages with Excel attachments, parses invoices, and logs or forwards them for
 * further processing.
 * </p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Service
public class GmailService {
    private static final Logger LOG = LoggerFactory.getLogger(GmailService.class);

    @Value("${GOOGLE_CLIENT_ID}")
    private String clientId;

    @Value("${GOOGLE_CLIENT_SECRET}")
    private String clientSecret;

    @Value("${GOOGLE_REFRESH_TOKEN}")
    private String refreshToken;

    @Value("${email.username}")
    private String emailUsername;

    @Value("${google.pubsub.topic}")
    private String pubsubTopic;

    private final ExcelParser excelParser;
    private final ExtractInvoiceService extractInvoiceService;
    private final InvoiceProcessingService invoiceProcessingService;
    private Gmail gmail;
    private volatile boolean isProcessing = false;
    private long lastProcessTime = 0;
    private static final long MIN_PROCESS_INTERVAL = 5000; // 5 seconds

    /**
     * Creates a Gmail service wrapper.
     *
     * @param excelParser parser used to extract invoices from Excel attachments
     * @param extractInvoiceService service to send invoices to Python API
     * @param invoiceProcessingService centralized invoice processing service
     */
    public GmailService(ExcelParser excelParser, ExtractInvoiceService extractInvoiceService,
                       InvoiceProcessingService invoiceProcessingService) {
        this.excelParser = excelParser;
        this.extractInvoiceService = extractInvoiceService;
        this.invoiceProcessingService = invoiceProcessingService;
        LOG.info("GmailService initialized");
    }

    /**
     * Sets up Gmail push notifications by watching the mailbox.
     * Called once on startup.
     */
    public void setupPushNotifications() {
        if (refreshToken == null || refreshToken.isEmpty()) {
            LOG.warn("Cannot setup push notifications - refresh token not configured");
            return;
        }
        
        try {
            if (gmail == null) {
                gmail = createGmailService();
            }

            com.google.api.services.gmail.model.WatchRequest watchRequest = 
                new com.google.api.services.gmail.model.WatchRequest()
                    .setTopicName(pubsubTopic)
                    .setLabelIds(List.of("INBOX"));

            com.google.api.services.gmail.model.WatchResponse watchResponse = 
                gmail.users().watch("me", watchRequest).execute();

            LOG.info("Gmail push notifications enabled. Expiration: {}", watchResponse.getExpiration());
        } catch (Exception e) {
            LOG.error("Error setting up push notifications", e);
        }
    }

    /**
     * Handles push notification from Gmail.
     * Called by webhook when new email arrives.
     */
    public void handlePushNotification(String historyId) {
        // Rate limiting: prevent concurrent processing
        if (isProcessing) {
            LOG.debug("Already processing, skipping notification: {}", historyId);
            return;
        }
        
        // Debounce: prevent processing too frequently
        long now = System.currentTimeMillis();
        if (now - lastProcessTime < MIN_PROCESS_INTERVAL) {
            LOG.debug("Too soon since last process, skipping notification: {}", historyId);
            return;
        }
        
        isProcessing = true;
        lastProcessTime = now;
        
        try {
            LOG.info("Processing push notification for historyId: {}", historyId);
            
            if (gmail == null) {
                gmail = createGmailService();
            }

            // Search for unread messages with attachments
            String query = "is:unread has:attachment";
            ListMessagesResponse response = gmail.users().messages()
                    .list("me")
                    .setQ(query)
                    .setMaxResults(10L)
                    .execute();

            List<Message> messages = response.getMessages();
            if (messages == null || messages.isEmpty()) {
                LOG.info("No unread messages with attachments found");
                return;
            }

            for (Message message : messages) {
                processMessage(message.getId());
            }

        } catch (Exception e) {
            LOG.error("Error handling push notification", e);
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Builds an authenticated Gmail client using the configured credentials.
     *
     * @return authenticated Gmail client
     * @throws Exception if the client cannot be created
     */
    private Gmail createGmailService() throws Exception {
        GoogleCredential credential = new GoogleCredential.Builder()
                .setTransport(GoogleNetHttpTransport.newTrustedTransport())
                .setJsonFactory(GsonFactory.getDefaultInstance())
                .setClientSecrets(clientId, clientSecret)
                .build()
                .setRefreshToken(refreshToken);

        return new Gmail.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                credential)
                .setApplicationName("Invoice Agent")
                .build();
    }

    /**
     * Processes a single Gmail message by downloading attachments and marking the message as read.
     *
     * @param messageId the Gmail message ID
     */
    private void processMessage(String messageId) {
        try {
            Message message = gmail.users().messages()
                    .get("me", messageId)
                    .execute();

            // Log email details
            String subject = message.getPayload().getHeaders().stream()
                .filter(h -> "Subject".equalsIgnoreCase(h.getName()))
                .map(h -> h.getValue())
                .findFirst()
                .orElse("No Subject");
            String from = message.getPayload().getHeaders().stream()
                .filter(h -> "From".equalsIgnoreCase(h.getName()))
                .map(h -> h.getValue())
                .findFirst()
                .orElse("Unknown");
            
            LOG.info("Processing email - ID: {}, From: {}, Subject: {}", messageId, from, subject);

            processAttachments(message, messageId);
            markAsRead(messageId);

        } catch (Exception e) {
            LOG.error("Error processing message {}", messageId, e);
        }
    }

    /**
     * Iterates over message parts and finds Excel attachments for further processing.
     *
     * @param message   Gmail message
     * @param messageId Gmail message ID (used for logging/download)
     */
    private void processAttachments(Message message, String messageId) {
        try {
            List<MessagePart> parts = message.getPayload().getParts();
            if (parts == null) return;

            for (MessagePart part : parts) {
                if (part.getFilename() != null && !part.getFilename().isEmpty()) {
                    String filename = part.getFilename();
                    
                    if (filename.toLowerCase().endsWith(".xlsx") || 
                        filename.toLowerCase().endsWith(".xls")) {
                        
                        // Only process files with 'invoice' in the name
                        if (filename.toLowerCase().contains("invoice")) {
                            LOG.info("Processing Excel attachment: {}", filename);
                            downloadAndProcessAttachment(messageId, part.getBody().getAttachmentId(), filename);
                        } else {
                            LOG.info("Skipping non-invoice Excel file: {}", filename);
                        }
                    }
                }
            }
        } catch (Exception e) {
            LOG.error("Error processing attachments for message {}", messageId, e);
        }
    }

    /**
     * Downloads the attachment content and parses invoices from Excel files.
     *
     * @param messageId    Gmail message ID
     * @param attachmentId attachment identifier
     * @param filename     original filename
     */
    private void downloadAndProcessAttachment(String messageId, String attachmentId, String filename) {
        try {
            MessagePartBody attachmentData = gmail.users().messages().attachments()
                    .get("me", messageId, attachmentId)
                    .execute();

            byte[] data = Base64.getUrlDecoder().decode(attachmentData.getData());
            
            try (ByteArrayInputStream inputStream = new ByteArrayInputStream(data)) {
                List<Invoice> invoices = excelParser.parseInvoices(inputStream);
                processInvoices(invoices, filename);
            }

        } catch (Exception e) {
            LOG.error("Error downloading attachment {} from message {}", attachmentId, messageId, e);
        }
    }

    /**
     * Removes the UNREAD label from a Gmail message.
     *
     * @param messageId Gmail message ID
     */
    private void markAsRead(String messageId) {
        try {
            gmail.users().messages().modify("me", messageId,
                    new com.google.api.services.gmail.model.ModifyMessageRequest()
                            .setRemoveLabelIds(List.of("UNREAD")))
                    .execute();
        } catch (Exception e) {
            LOG.error("Error marking message {} as read", messageId, e);
        }
    }

    /**
     * Handles parsed invoices. Delegates to InvoiceProcessingService for rule validation and Python API processing.
     *
     * @param invoices list of parsed invoices
     * @param filename source filename for traceability
     */
    private void processInvoices(List<Invoice> invoices, String filename) {
        // Delegate to centralized processing service
        var results = invoiceProcessingService.processInvoices(invoices, filename, "EMAIL");
        
        // Log results
        for (var result : results) {
            if (result.isSuccess()) {
                LOG.info("✅ Invoice {} processed successfully", result.getInvoice().getInvoiceNumber());
            } else if (result.isRejected()) {
                LOG.warn("❌ Invoice {} rejected: {}", 
                        result.getInvoice() != null ? result.getInvoice().getInvoiceNumber() : "N/A", 
                        result.getErrorMessage());
            } else {
                LOG.error("❌ Invoice {} failed: {}", 
                         result.getInvoice() != null ? result.getInvoice().getInvoiceNumber() : "N/A", 
                         result.getErrorMessage());
            }
        }
    }
}