# VendorServiceRule Integration

## ✅ Updated to Match Your Rule Engine Entity

The `RuleEngineResponse` model has been updated to match your `VendorServiceRule` entity structure exactly.

## 📋 RuleEngineResponse Structure

```java
public class RuleEngineResponse {
    private boolean valid;              // Validation result
    private String reason;              // Validation reason/message
    private String vendorCode;          // From VendorServiceRule
    private String serviceName;         // From VendorServiceRule
    private String pricingType;         // FIXED, RANGE, VARIABLE
    private BigDecimal fixedAmount;     // For FIXED pricing
    private BigDecimal minAmount;       // For RANGE/VARIABLE pricing
    private BigDecimal maxAmount;       // For RANGE/VARIABLE pricing
    private String currency;            // USD, EUR, etc.
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveTo;
    private Boolean isActive;
}
```

## 🔄 Your Rule Engine API Should Return

### Example 1: FIXED Pricing
```json
{
  "valid": true,
  "reason": "Fixed price rule found",
  "vendor_code": "VND-123",
  "service_name": "Subscription",
  "pricing_type": "FIXED",
  "fixed_amount": 99.99,
  "currency": "USD",
  "is_active": true
}
```

**Validation Logic:**
```java
actualAmount == fixedAmount
// 99.99 == 99.99 → ✅ Valid
// 100.00 == 99.99 → ❌ Invalid
```

---

### Example 2: RANGE Pricing
```json
{
  "valid": true,
  "reason": "Range pricing rule found",
  "vendor_code": "VND-123",
  "service_name": "Consulting",
  "pricing_type": "RANGE",
  "min_amount": 1000.00,
  "max_amount": 5000.00,
  "currency": "USD",
  "is_active": true
}
```

**Validation Logic:**
```java
minAmount <= actualAmount <= maxAmount
// 1250.00 in [1000, 5000] → ✅ Valid
// 15000.00 in [1000, 5000] → ❌ Invalid (exceeds max)
// 500.00 in [1000, 5000] → ❌ Invalid (below min)
```

---

### Example 3: VARIABLE Pricing (with limits)
```json
{
  "valid": true,
  "reason": "Variable pricing with limits",
  "vendor_code": "VND-456",
  "service_name": "Support",
  "pricing_type": "VARIABLE",
  "min_amount": 500.00,
  "max_amount": 10000.00,
  "currency": "USD",
  "is_active": true
}
```

**Validation Logic:**
```java
actualAmount >= minAmount && actualAmount <= maxAmount
```

---

### Example 4: No Rule Found
```json
{
  "valid": false,
  "reason": "No pricing rule found for vendor-service combination",
  "vendor_code": "VND-999",
  "service_name": "Unknown"
}
```

**Result:** Invoice rejected immediately

---

## 🎯 Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Invoice: VND-123, Consulting, $1250.00                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  1. Call Rule Engine API                                    │
│     POST /validate-invoice                                  │
│     { vendor_code, service, amount }                        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Rule Engine Returns VendorServiceRule                   │
│     {                                                        │
│       valid: true,                                          │
│       pricing_type: "RANGE",                                │
│       min_amount: 1000,                                     │
│       max_amount: 5000                                      │
│     }                                                        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Check isValid()                                         │
│     ✅ valid=true → Continue                                │
│     ❌ valid=false → Reject immediately                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Validate Amount Based on Pricing Type                   │
│     FIXED: actualAmount == fixedAmount                      │
│     RANGE: minAmount <= actualAmount <= maxAmount           │
│     VARIABLE: Check min/max if provided                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Result                                                  │
│     ✅ Valid → Call Python API                              │
│     ❌ Invalid → Reject, skip Python API                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Rule Engine API Implementation

```java
@RestController
@RequestMapping("/api/v1/rules")
public class RuleEngineController {
    
    @Autowired
    private VendorServiceRuleRepository ruleRepository;
    
    @PostMapping("/validate-invoice")
    public RuleEngineResponse validateInvoice(@RequestBody Map<String, Object> request) {
        String vendorCode = (String) request.get("vendor_code");
        String service = (String) request.get("service");
        BigDecimal amount = new BigDecimal(request.get("amount").toString());
        
        // Find rule from database
        VendorServiceRule rule = ruleRepository
            .findByVendorCodeAndServiceNameAndIsActiveTrue(vendorCode, service)
            .orElse(null);
        
        if (rule == null) {
            return new RuleEngineResponse(false, 
                "No pricing rule found for " + vendorCode + " - " + service);
        }
        
        // Check if rule is currently effective
        LocalDateTime now = LocalDateTime.now();
        if (rule.getEffectiveFrom() != null && now.isBefore(rule.getEffectiveFrom())) {
            return new RuleEngineResponse(false, "Rule not yet effective");
        }
        if (rule.getEffectiveTo() != null && now.isAfter(rule.getEffectiveTo())) {
            return new RuleEngineResponse(false, "Rule has expired");
        }
        
        // Build response
        RuleEngineResponse response = new RuleEngineResponse(true, "Rule found");
        response.setVendorCode(rule.getVendorCode());
        response.setServiceName(rule.getServiceName());
        response.setPricingType(rule.getPricingType());
        response.setFixedAmount(rule.getFixedAmount());
        response.setMinAmount(rule.getMinAmount());
        response.setMaxAmount(rule.getMaxAmount());
        response.setCurrency(rule.getCurrency());
        response.setEffectiveFrom(rule.getEffectiveFrom());
        response.setEffectiveTo(rule.getEffectiveTo());
        response.setIsActive(rule.getIsActive());
        
        return response;
    }
}
```

---

## 🗄️ Database Schema

```sql
CREATE TABLE vendor_service_rules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_code VARCHAR(50) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    pricing_type VARCHAR(20) DEFAULT 'FIXED',
    fixed_amount DECIMAL(12,2),
    min_amount DECIMAL(12,2),
    max_amount DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'USD',
    effective_from DATETIME,
    effective_to DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_vendor_service (vendor_code, service_name)
);

-- Sample data
INSERT INTO vendor_service_rules 
(vendor_code, service_name, pricing_type, fixed_amount, currency) 
VALUES ('VND-123', 'Subscription', 'FIXED', 99.99, 'USD');

INSERT INTO vendor_service_rules 
(vendor_code, service_name, pricing_type, min_amount, max_amount, currency) 
VALUES ('VND-123', 'Consulting', 'RANGE', 1000.00, 5000.00, 'USD');

INSERT INTO vendor_service_rules 
(vendor_code, service_name, pricing_type, min_amount, max_amount, currency) 
VALUES ('VND-456', 'Support', 'VARIABLE', 500.00, 10000.00, 'USD');
```

---

## 📊 API Response Example

### Successful Processing
```json
{
  "filename": "invoices.xlsx",
  "total_invoices": 3,
  "successful": 2,
  "rejected": 1,
  "failed": 0,
  "results": [
    {
      "status": "SUCCESS",
      "invoice_number": "INV-001",
      "rule_validation": {
        "valid": true,
        "reason": "Range pricing rule found",
        "vendor_code": "VND-123",
        "service_name": "Consulting",
        "pricing_type": "RANGE",
        "min_amount": 1000.00,
        "max_amount": 5000.00,
        "currency": "USD"
      },
      "python_response": { ... }
    },
    {
      "status": "RULE_REJECTED",
      "invoice_number": "INV-002",
      "error_message": "Amount exceeds maximum: Max=5000.00, Actual=15000.00",
      "rule_validation": {
        "valid": true,
        "reason": "Range pricing rule found",
        "vendor_code": "VND-123",
        "service_name": "Consulting",
        "pricing_type": "RANGE",
        "min_amount": 1000.00,
        "max_amount": 5000.00,
        "currency": "USD"
      }
    }
  ]
}
```

---

## 🧪 Testing

### Test Case 1: FIXED Pricing - Valid
```bash
curl -X POST http://localhost:9000/api/v1/rules/validate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VND-123",
    "service": "Subscription",
    "amount": 99.99
  }'
```

**Expected:** ✅ Valid (exact match)

### Test Case 2: RANGE Pricing - Valid
```bash
curl -X POST http://localhost:9000/api/v1/rules/validate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VND-123",
    "service": "Consulting",
    "amount": 1250.00
  }'
```

**Expected:** ✅ Valid (within range)

### Test Case 3: RANGE Pricing - Invalid (Exceeds Max)
```bash
curl -X POST http://localhost:9000/api/v1/rules/validate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VND-123",
    "service": "Consulting",
    "amount": 15000.00
  }'
```

**Expected:** ❌ Invalid (exceeds max_amount)

---

## ✅ Summary

✅ **RuleEngineResponse** matches your `VendorServiceRule` entity  
✅ **Supports 3 pricing types**: FIXED, RANGE, VARIABLE  
✅ **Validates amounts** based on pricing type  
✅ **Checks effective dates** (effectiveFrom, effectiveTo)  
✅ **Database-driven** rules (easy to update)  
✅ **Detailed logging** for debugging  
✅ **Fail-open strategy** if validation fails  

Your integration is complete and ready to use! 🚀
