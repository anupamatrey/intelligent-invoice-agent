package com.anupam.mcp.server.service;

import com.anupam.mcp.server.db.repository.InvoiceRepository;
import com.anupam.mcp.server.db.repository.VendorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class InvoicePersistenceService {
    private static final Logger LOG = LoggerFactory.getLogger(InvoicePersistenceService.class);
    
    private final InvoiceRepository invoiceRepository;
    private final VendorRepository vendorRepository;
    
    public InvoicePersistenceService(InvoiceRepository invoiceRepository, 
                                    VendorRepository vendorRepository) {
        this.invoiceRepository = invoiceRepository;
        this.vendorRepository = vendorRepository;
    }
    
    @Transactional
    public com.anupam.mcp.server.db.entity.Invoice saveInvoice(com.anupam.mcp.server.model.Invoice invoice, 
                                    String gmailMessageId,
                                    String attachmentFilename, 
                                    String emailSender,
                                    Boolean isDuplicate) {
        // Find vendor by vendor code
        com.anupam.mcp.server.db.entity.Vendor vendor = vendorRepository.findByVendorCode(invoice.getVendorCode())
            .orElseThrow(() -> new RuntimeException("Vendor not found: " + invoice.getVendorCode()));
        
        // Map model to entity
        com.anupam.mcp.server.db.entity.Invoice entity = new com.anupam.mcp.server.db.entity.Invoice();
        entity.setInvoiceNumber(invoice.getInvoiceNumber());
        entity.setVendor(vendor);
        entity.setInvoiceDate(invoice.getDate());
        entity.setTotalAmount(invoice.getTotalAmount());
        entity.setDescription(invoice.getDescription());
        entity.setStatus(invoice.getStatus());
        entity.setService(invoice.getService());
        entity.setRejectedReason(invoice.getRejectedReason());
        entity.setIsDuplicate(isDuplicate != null ? isDuplicate : false);
        entity.setGmailMessageId(gmailMessageId);
        entity.setAttachmentFilename(attachmentFilename);
        entity.setEmailSender(emailSender);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        
        com.anupam.mcp.server.db.entity.Invoice saved = invoiceRepository.save(entity);
        LOG.info("💾 Saved invoice to DB: {} (ID: {})", saved.getInvoiceNumber(), saved.getId());
        return saved;
    }
}
