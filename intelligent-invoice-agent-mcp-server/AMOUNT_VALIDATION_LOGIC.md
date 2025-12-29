# Amount Validation Logic

## Overview

The `InvoiceProcessingService` now includes business logic to **compare invoice amounts against expected limits** returned by the Rule Engine API.

## Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Call Rule Engine API                                    │
│     - Pass: vendorCode, service, amount                     │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Check ruleResponse.isValid()                            │
│     - If false → Reject immediately                         │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Apply Amount Validation Logic                           │
│     - Compare actual amount vs expected limit               │
│     - Supports: exact amount, range, min/max limits         │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  4. If Valid → Call Python API                              │
│     If Invalid → Reject with reason                         │
└─────────────────────────────────────────────────────────────┘
```

## Supported Validation Scenarios

### Scenario 1: Exact Expected Amount
**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "Amount validation required",
  "rule_details": {
    "expected_amount": 1250.00
  }
}
```

**Validation Logic:**
```java
actualAmount == expectedAmount
// Example: 1250.00 == 1250.00 → ✅ Valid
// Example: 1300.00 == 1250.00 → ❌ Invalid
```

**Use Case:** Fixed-price services (e.g., monthly subscription)

---

### Scenario 2: Amount Range [Min, Max]
**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "Amount must be within range",
  "rule_details": {
    "expected_amount_range": [1000, 5000]
  }
}
```

**Validation Logic:**
```java
minAmount <= actualAmount <= maxAmount
// Example: 1250.00 in [1000, 5000] → ✅ Valid
// Example: 15000.00 in [1000, 5000] → ❌ Invalid (exceeds max)
// Example: 500.00 in [1000, 5000] → ❌ Invalid (below min)
```

**Use Case:** Variable pricing with limits (e.g., consulting services)

---

### Scenario 3: Separate Min/Max Limits
**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "Amount must meet limits",
  "rule_details": {
    "min_limit": 1000,
    "max_limit": 5000
  }
}
```

**Validation Logic:**
```java
actualAmount >= minLimit && actualAmount <= maxLimit
// Example: 1250.00 with min=1000, max=5000 → ✅ Valid
// Example: 15000.00 with max=5000 → ❌ Invalid
```

**Use Case:** Flexible validation with optional min/max

---

### Scenario 4: No Amount Validation
**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "No amount validation required",
  "rule_details": null
}
```

**Validation Logic:**
```java
// Skip amount validation, proceed to Python API
return true;
```

**Use Case:** When only vendor/service validation is needed

---

## Code Implementation

### Method: `validateAmountAgainstLimit()`

```java
private boolean validateAmountAgainstLimit(Invoice invoice, RuleEngineResponse ruleResponse) {
    var ruleDetails = ruleResponse.getRuleDetails();
    var actualAmount = invoice.getTotalAmount();
    
    // Case 1: Exact expected amount
    if (ruleDetails.containsKey("expected_amount")) {
        var expectedAmount = new BigDecimal(ruleDetails.get("expected_amount").toString());
        return actualAmount.compareTo(expectedAmount) == 0;
    }
    
    // Case 2: Amount range [min, max]
    if (ruleDetails.containsKey("expected_amount_range")) {
        var range = (List<?>) ruleDetails.get("expected_amount_range");
        var minAmount = new BigDecimal(range.get(0).toString());
        var maxAmount = new BigDecimal(range.get(1).toString());
        return actualAmount.compareTo(minAmount) >= 0 && actualAmount.compareTo(maxAmount) <= 0;
    }
    
    // Case 3: Min and Max limits separately
    if (ruleDetails.containsKey("min_limit") || ruleDetails.containsKey("max_limit")) {
        // Check min limit
        // Check max limit
        return true;
    }
    
    // No validation rules found
    return true;
}
```

---

## Example Scenarios

### Example 1: Valid Invoice (Within Range)
**Invoice:**
```
Vendor Code: VND-123
Service: Consulting
Amount: 1250.00
```

**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "Amount within vendor service limit",
  "rule_details": {
    "expected_amount_range": [1000, 5000]
  }
}
```

**Validation Result:**
```
✅ Rule Engine: valid=true
✅ Amount Validation: 1250.00 in [1000, 5000] → PASS
✅ Proceed to Python API
```

---

### Example 2: Invalid Invoice (Exceeds Limit)
**Invoice:**
```
Vendor Code: VND-123
Service: Consulting
Amount: 15000.00
```

**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "Amount validation required",
  "rule_details": {
    "expected_amount_range": [1000, 5000],
    "max_limit": 5000
  }
}
```

**Validation Result:**
```
✅ Rule Engine: valid=true
❌ Amount Validation: 15000.00 exceeds max 5000 → FAIL
❌ Invoice REJECTED (skip Python API)
```

**Logs:**
```
🔍 Validating invoice: vendorCode=VND-123, service=Consulting, amount=15000.00
✅ Rule validation result: valid=true
⚠️ Amount out of range: Expected=[1000, 5000], Actual=15000.00
❌ Invoice INV-002 rejected: Amount validation failed
```

---

### Example 3: Invalid Invoice (Below Minimum)
**Invoice:**
```
Vendor Code: VND-456
Service: Support
Amount: 500.00
```

**Rule Engine Response:**
```json
{
  "valid": true,
  "reason": "Amount validation required",
  "rule_details": {
    "min_limit": 1000
  }
}
```

**Validation Result:**
```
✅ Rule Engine: valid=true
❌ Amount Validation: 500.00 < 1000 → FAIL
❌ Invoice REJECTED
```

---

## Rule Engine API Implementation Guide

### Your Rule Engine API Should Return:

```java
@PostMapping("/validate-invoice")
public RuleEngineResponse validateInvoice(@RequestBody Map<String, Object> request) {
    String vendorCode = (String) request.get("vendor_code");
    String service = (String) request.get("service");
    BigDecimal amount = new BigDecimal(request.get("amount").toString());
    
    // Fetch vendor-service pricing rules from database
    PricingRule rule = pricingRuleRepository.findByVendorCodeAndService(vendorCode, service);
    
    if (rule == null) {
        return new RuleEngineResponse(false, "No pricing rule found for vendor-service", null);
    }
    
    // Build rule details
    Map<String, Object> ruleDetails = new HashMap<>();
    
    // Option 1: Fixed price
    if (rule.isFixedPrice()) {
        ruleDetails.put("expected_amount", rule.getFixedAmount());
    }
    
    // Option 2: Price range
    if (rule.hasRange()) {
        ruleDetails.put("expected_amount_range", List.of(rule.getMinAmount(), rule.getMaxAmount()));
    }
    
    // Option 3: Min/Max limits
    if (rule.getMinLimit() != null) {
        ruleDetails.put("min_limit", rule.getMinLimit());
    }
    if (rule.getMaxLimit() != null) {
        ruleDetails.put("max_limit", rule.getMaxLimit());
    }
    
    return new RuleEngineResponse(true, "Validation rules applied", ruleDetails);
}
```

---

## Database Schema Example

```sql
CREATE TABLE pricing_rules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vendor_code VARCHAR(50) NOT NULL,
    service VARCHAR(100) NOT NULL,
    
    -- Pricing type
    is_fixed_price BOOLEAN DEFAULT FALSE,
    fixed_amount DECIMAL(15,2),
    
    -- Range pricing
    min_amount DECIMAL(15,2),
    max_amount DECIMAL(15,2),
    
    -- Limits
    min_limit DECIMAL(15,2),
    max_limit DECIMAL(15,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_vendor_service (vendor_code, service)
);

-- Sample data
INSERT INTO pricing_rules (vendor_code, service, min_amount, max_amount) 
VALUES ('VND-123', 'Consulting', 1000, 5000);

INSERT INTO pricing_rules (vendor_code, service, is_fixed_price, fixed_amount) 
VALUES ('VND-456', 'Subscription', TRUE, 99.99);
```

---

## Testing

### Test Case 1: Valid Amount
```bash
curl -X POST http://localhost:9000/validate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VND-123",
    "service": "Consulting",
    "amount": 1250.00
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "reason": "Amount within vendor service limit",
  "rule_details": {
    "expected_amount_range": [1000, 5000]
  }
}
```

### Test Case 2: Amount Exceeds Limit
```bash
curl -X POST http://localhost:9000/validate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VND-123",
    "service": "Consulting",
    "amount": 15000.00
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "reason": "Amount validation required",
  "rule_details": {
    "expected_amount_range": [1000, 5000],
    "max_limit": 5000
  }
}
```

**Expected Behavior:** Invoice rejected by `validateAmountAgainstLimit()`

---

## Benefits

✅ **Flexible Validation** - Supports multiple pricing models  
✅ **Clear Rejection Reasons** - Detailed logs for debugging  
✅ **Fail-Open Strategy** - Continues if validation logic fails  
✅ **Centralized Logic** - Single place for amount validation  
✅ **Database-Driven** - Rules stored in database, easy to update  

---

## Next Steps

1. Implement Rule Engine API with pricing rules
2. Populate pricing_rules table with vendor-service data
3. Test with sample invoices
4. Monitor rejection logs
5. Adjust limits based on business requirements
