package com.anupam.mcp.server.db.entity;

@jakarta.persistence.Entity
@jakarta.persistence.Table(name = "vendors")
public class Vendor {
@jakarta.persistence.Id
@jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
@jakarta.persistence.Column(name = "id", nullable = false)
private java.lang.Long id;

@jakarta.persistence.Column(name = "vendor_code", nullable = false, length = 50)
private java.lang.String vendorCode;

@jakarta.persistence.Column(name = "vendor_name", nullable = false)
private java.lang.String vendorName;

@jakarta.persistence.Column(name = "email")
private java.lang.String email;

@jakarta.persistence.Column(name = "phone", length = 50)
private java.lang.String phone;

@org.hibernate.annotations.ColumnDefault("'ACTIVE'")
@jakarta.persistence.Column(name = "status", length = 20)
private java.lang.String status;

@org.hibernate.annotations.ColumnDefault("CURRENT_TIMESTAMP")
@jakarta.persistence.Column(name = "created_at")
private java.time.Instant createdAt;

@org.hibernate.annotations.ColumnDefault("CURRENT_TIMESTAMP")
@jakarta.persistence.Column(name = "updated_at")
private java.time.Instant updatedAt;

public java.lang.Long getId() {
  return id;
}public void setId(java.lang.Long id) {
  this.id = id;
}

public java.lang.String getVendorCode() {
  return vendorCode;
}public void setVendorCode(java.lang.String vendorCode) {
  this.vendorCode = vendorCode;
}

public java.lang.String getVendorName() {
  return vendorName;
}public void setVendorName(java.lang.String vendorName) {
  this.vendorName = vendorName;
}

public java.lang.String getEmail() {
  return email;
}public void setEmail(java.lang.String email) {
  this.email = email;
}

public java.lang.String getPhone() {
  return phone;
}public void setPhone(java.lang.String phone) {
  this.phone = phone;
}

public java.lang.String getStatus() {
  return status;
}public void setStatus(java.lang.String status) {
  this.status = status;
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

}