package com.anupam.mcp.server.db.entity;

import jakarta.persistence.Column;

@jakarta.persistence.Entity
@jakarta.persistence.Table(name = "invoices")
public class Invoice {
@jakarta.persistence.Id
@jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
@jakarta.persistence.Column(name = "id", nullable = false)
private java.lang.Long id;

@jakarta.persistence.Column(name = "invoice_number", nullable = false, length = 100)
private java.lang.String invoiceNumber;

@jakarta.persistence.ManyToOne(fetch = jakarta.persistence.FetchType.LAZY, optional = false)
@org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.RESTRICT)
@jakarta.persistence.JoinColumn(name = "vendor_id", nullable = false)
private com.anupam.mcp.server.db.entity.Vendor vendor;

@jakarta.persistence.Column(name = "invoice_date", nullable = false)
private java.time.LocalDate invoiceDate;

@jakarta.persistence.Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
private java.math.BigDecimal totalAmount;

@jakarta.persistence.Column(name = "description", length = Integer.MAX_VALUE)
private java.lang.String description;

@org.hibernate.annotations.ColumnDefault("'PENDING'")
@jakarta.persistence.Column(name = "status", length = 50)
private java.lang.String status;

@jakarta.persistence.Column(name = "vector_doc_id")
private java.lang.String vectorDocId;

@org.hibernate.annotations.ColumnDefault("false")
@jakarta.persistence.Column(name = "is_duplicate")
private java.lang.Boolean isDuplicate;

@jakarta.persistence.Column(name = "gmail_message_id")
private java.lang.String gmailMessageId;

@jakarta.persistence.Column(name = "attachment_filename")
private java.lang.String attachmentFilename;

@jakarta.persistence.Column(name = "email_sender")
private java.lang.String emailSender;

@org.hibernate.annotations.ColumnDefault("CURRENT_TIMESTAMP")
@jakarta.persistence.Column(name = "created_at")
private java.time.Instant createdAt;

@org.hibernate.annotations.ColumnDefault("CURRENT_TIMESTAMP")
@jakarta.persistence.Column(name = "updated_at")
private java.time.Instant updatedAt;

@jakarta.persistence.Column(name = "processed_at")
private java.time.Instant processedAt;
  @Column(name = "rejected_reason", length = Integer.MAX_VALUE)
  private String rejectedReason;
  @Column(name = "service", length = Integer.MAX_VALUE)
  private String service;

  public java.lang.Long getId() {
  return id;
}public void setId(java.lang.Long id) {
  this.id = id;
}

public java.lang.String getInvoiceNumber() {
  return invoiceNumber;
}public void setInvoiceNumber(java.lang.String invoiceNumber) {
  this.invoiceNumber = invoiceNumber;
}

public com.anupam.mcp.server.db.entity.Vendor getVendor() {
  return vendor;
}public void setVendor(com.anupam.mcp.server.db.entity.Vendor vendor) {
  this.vendor = vendor;
}

public java.time.LocalDate getInvoiceDate() {
  return invoiceDate;
}public void setInvoiceDate(java.time.LocalDate invoiceDate) {
  this.invoiceDate = invoiceDate;
}

public java.math.BigDecimal getTotalAmount() {
  return totalAmount;
}public void setTotalAmount(java.math.BigDecimal totalAmount) {
  this.totalAmount = totalAmount;
}

public java.lang.String getDescription() {
  return description;
}public void setDescription(java.lang.String description) {
  this.description = description;
}

public java.lang.String getStatus() {
  return status;
}public void setStatus(java.lang.String status) {
  this.status = status;
}

public java.lang.String getVectorDocId() {
  return vectorDocId;
}public void setVectorDocId(java.lang.String vectorDocId) {
  this.vectorDocId = vectorDocId;
}

public java.lang.Boolean getIsDuplicate() {
  return isDuplicate;
}public void setIsDuplicate(java.lang.Boolean isDuplicate) {
  this.isDuplicate = isDuplicate;
}

public java.lang.String getGmailMessageId() {
  return gmailMessageId;
}public void setGmailMessageId(java.lang.String gmailMessageId) {
  this.gmailMessageId = gmailMessageId;
}

public java.lang.String getAttachmentFilename() {
  return attachmentFilename;
}public void setAttachmentFilename(java.lang.String attachmentFilename) {
  this.attachmentFilename = attachmentFilename;
}

public java.lang.String getEmailSender() {
  return emailSender;
}public void setEmailSender(java.lang.String emailSender) {
  this.emailSender = emailSender;
}

public java.time.Instant getCreatedAt() {
  return createdAt;
}public void setCreatedAt(java.time.Instant createdAt) {
  this.createdAt = createdAt;
}

public java.time.Instant getUpdatedAt() {
  return updatedAt;
}public void setUpdatedAt(java.time.Instant updatedAt) {
  this.updatedAt = updatedAt;
}

public java.time.Instant getProcessedAt() {
  return processedAt;
}public void setProcessedAt(java.time.Instant processedAt) {
  this.processedAt = processedAt;
}

  public String getRejectedReason() {
    return rejectedReason;
  }

  public void setRejectedReason(String rejectedReason) {
    this.rejectedReason = rejectedReason;
  }

  public String getService() {
    return service;
  }

  public void setService(String service) {
    this.service = service;
  }

}