# Rule Engine Validation API Update

## Summary
Updated the application to use the new Rule Engine validation endpoint that performs amount validation on the server side.

## Changes Made

### 1. RuleEngineService.java
**Changed from:** GET `/api/vendor-rules/{vendorCode}/{service}`  
**Changed to:** POST `/api/vendor-rules/validate`

**Request Body:**
```json
{
    "vendorCode": "VEND001",
    "serviceName": "DELIVERY",
    "serviceAmount": 25.50
}
```

**Response:**
```json
{
    "message": "Amount validation failed",
    "expectedAmount": 50.00,
    "actualAmount": 25.50,
    "pricingType": "FIXED",
    "valid": false
}
```

### 2. RuleEngineResponse.java
**Simplified model to match new API response:**
- `valid` (boolean) - validation result
- `reason/message` (String) - validation message
- `expectedAmount` (BigDecimal) - expected amount from rule
- `actualAmount` (BigDecimal) - actual invoice amount
- `pricingType` (String) - FIXED, RANGE, or VARIABLE

**Removed fields** (no longer needed):
- vendorCode, serviceName, fixedAmount, minAmount, maxAmount, currency, effectiveFrom, effectiveTo, isActive

### 3. InvoiceProcessingService.java
**Removed local amount validation logic:**
- Deleted `validateAmountAgainstRule()` method (~80 lines)
- Rule Engine API now handles all validation logic
- Simplified `processSingleInvoice()` to only check `ruleResponse.isValid()`

## Benefits

✅ **Single Source of Truth** - All validation logic in Rule Engine API  
✅ **Simplified Code** - Removed ~80 lines of complex validation logic  
✅ **Easier Maintenance** - Update rules in one place (Rule Engine)  
✅ **Better Error Messages** - Rule Engine provides detailed validation messages  
✅ **Consistent Validation** - Same logic across all consumers

## Data Flow

```
Excel File → Parse Invoice → Rule Engine Validation API
                                      ↓
                              [valid: true/false]
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                                   ↓
              [If valid]                          [If invalid]
                    ↓                                   ↓
          Python API Processing              Reject with reason
                    ↓
          Kafka → MySQL/Vector DB
```

## Testing

**Test with valid invoice:**
```bash
curl -X POST http://localhost:8082/api/vendor-rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "vendorCode": "VEND001",
    "serviceName": "DELIVERY",
    "serviceAmount": 50.00
  }'
```

**Expected response:**
```json
{
  "valid": true,
  "message": "Amount validation passed",
  "expectedAmount": 50.00,
  "actualAmount": 50.00,
  "pricingType": "FIXED"
}
```

**Test with invalid invoice:**
```bash
curl -X POST http://localhost:8082/api/vendor-rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "vendorCode": "VEND001",
    "serviceName": "DELIVERY",
    "serviceAmount": 25.50
  }'
```

**Expected response:**
```json
{
  "valid": false,
  "message": "Amount validation failed",
  "expectedAmount": 50.00,
  "actualAmount": 25.50,
  "pricingType": "FIXED"
}
```

## Configuration

No changes needed to `application.properties`. The base URL remains:
```properties
rule.engine.api.url=http://localhost:8082/api/vendor-rules
```

The service appends `/validate` to this URL automatically.

## Backward Compatibility

⚠️ **Breaking Change** - This update requires the Rule Engine API to have the `/validate` endpoint implemented.

Ensure Rule Engine API is updated before deploying this change.
