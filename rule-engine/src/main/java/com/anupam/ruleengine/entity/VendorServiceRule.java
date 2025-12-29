package com.anupam.ruleengine.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "vendor_service_rules", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"vendor_code", "service_name"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorServiceRule implements Serializable {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "vendor_code", nullable = false, length = 50)
    private String vendorCode;
    
    @Column(name = "service_name", nullable = false, length = 100)
    private String serviceName;
    
    @Column(name = "pricing_type", length = 20)
    private String pricingType = "FIXED";
    
    @Column(name = "fixed_amount", precision = 12, scale = 2)
    private BigDecimal fixedAmount;
    
    @Column(name = "min_amount", precision = 12, scale = 2)
    private BigDecimal minAmount;
    
    @Column(name = "max_amount", precision = 12, scale = 2)
    private BigDecimal maxAmount;
    
    @Column(name = "currency", length = 10)
    private String currency = "USD";
    
    @Column(name = "effective_from")
    private LocalDateTime effectiveFrom;
    
    @Column(name = "effective_to")
    private LocalDateTime effectiveTo;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (effectiveFrom == null) {
            effectiveFrom = now;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}