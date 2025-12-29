# Rule Engine Integration

## Overview

The Rule Engine integration validates invoices against business rules **before** calling the Python API. This ensures that only valid invoices are processed, saving API costs and improving efficiency.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Entry Points                                  │
├─────────────────────────────────────────────────────────────────┤
│  GmailService              │  InvoiceAgentController             │
│  (Email attachments)       │  (Manual upload)                    │
└──────────────┬─────────────┴──────────────┬─────────────────────┘
               │                             │
               └──────────────┬──────────────┘
                              ↓
              ┌───────────────────────────────┐
              │  InvoiceProcessingService     │
              │  (Centralized orchestration)  │
              └───────────────┬───────────────┘
                              ↓
              ┌───────────────────────────────┐
              │  1. Parse Excel               │
              │  2. Validate Rules ✅         │
              │  3. Call Python API           │
              │  4. Return Result             │
              └───────────────────────────────┘
```

## New Components

### 1. RuleEngineService
**Location:** `src/main/java/com/anupam/mcp/server/service/RuleEngineService.java`

**Purpose:** Validates invoices against business rules by calling external Rule Engine API.

**Key Features:**
- Calls Rule Engine API with vendor code, service, and amount
- Resilience4j retry and circuit breaker support
- Fail-open strategy (auto-approve if API unavailable)
- Can be disabled via configuration

**API Request:**
```json
POST http://localhost:9000/validate-invoice
{
  "vendor_code": "VND-123",
  "service": "Consulting",
  "amount": 1250.00
}
```

**API Response:**
```json
{
  "valid": true,
  "reason": "Amount within vendor service limit",
  "rule_details": {
    "expected_amount_range": [1000, 5000],
    "actual_amount": 1250
  }
}
```

### 2. InvoiceProcessingService
**Location:** `src/main/java/com/anupam/mcp/server/service/InvoiceProcessingService.java`

**Purpose:** Centralized orchestrator for invoice processing workflow.

**Key Features:**
- Handles both file uploads and email attachments
- Validates rules before Python API call
- Returns structured processing results
- Tracks source (EMAIL vs MANUAL_UPLOAD)

**Processing Flow:**
1. Parse Excel file
2. Validate each invoice against Rule Engine
3. If valid → Call Python API
4. If invalid → Skip Python API, mark as rejected
5. Return detailed results

### 3. InvoiceProcessingResult
**Location:** `src/main/java/com/anupam/mcp/server/model/InvoiceProcessingResult.java`

**Purpose:** Tracks status and results of invoice processing.

**Status Types:**
- `SUCCESS` - Passed all validations and processed
- `RULE_REJECTED` - Failed rule engine validation
- `ERROR` - Processing error
- `FILE_REJECTED` - File parsing failed

### 4. RuleEngineResponse
**Location:** `src/main/java/com/anupam/mcp/server/model/RuleEngineResponse.java`

**Purpose:** Holds validation results from Rule Engine API.

**Fields:**
- `valid` - Whether invoice passed validation
- `reason` - Explanation of validation result
- `rule_details` - Additional rule metadata

## Configuration

### application.properties
```properties
# Rule Engine Configuration
rule.engine.api.url=http://localhost:9000/validate-invoice
rule.engine.enabled=true
```

### application-resilience.properties
```properties
# Retry Configuration for Rule Engine API
resilience4j.retry.instances.ruleEngine.max-attempts=3
resilience4j.retry.instances.ruleEngine.wait-duration=1s
resilience4j.retry.instances.ruleEngine.enable-exponential-backoff=true

# Circuit Breaker Configuration for Rule Engine
resilience4j.circuitbreaker.instances.ruleEngine.failure-rate-threshold=50
resilience4j.circuitbreaker.instances.ruleEngine.wait-duration-in-open-state=30s
```

## Updated Components

### GmailService
**Changes:**
- Injects `InvoiceProcessingService`
- Delegates invoice processing to centralized service
- Logs detailed results (success/rejected/failed)

**Before:**
```java
private void processInvoices(List<Invoice> invoices, String filename) {
    for (Invoice invoice : invoices) {
        String response = extractInvoiceService.processInvoiceData(invoice);
        LOG.info("Python API response: {}", response);
    }
}
```

**After:**
```java
private void processInvoices(List<Invoice> invoices, String filename) {
    var results = invoiceProcessingService.processInvoices(invoices, filename, "EMAIL");
    
    for (var result : results) {
        if (result.isSuccess()) {
            LOG.info("✅ Invoice {} processed successfully", result.getInvoice().getInvoiceNumber());
        } else if (result.isRejected()) {
            LOG.warn("❌ Invoice {} rejected: {}", result.getInvoice().getInvoiceNumber(), result.getErrorMessage());
        }
    }
}
```

### InvoiceAgentController
**Changes:**
- Injects `InvoiceProcessingService`
- Returns detailed processing results
- Includes rule validation status in response

**Response Format:**
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
        "reason": "Amount within limit"
      },
      "python_response": { ... }
    },
    {
      "status": "RULE_REJECTED",
      "invoice_number": "INV-002",
      "error_message": "Amount exceeds vendor limit",
      "rule_validation": {
        "valid": false,
        "reason": "Amount exceeds vendor limit",
        "rule_details": {
          "expected_amount_range": [1000, 5000],
          "actual_amount": 15000
        }
      }
    }
  ]
}
```

## Benefits

✅ **Fail Fast** - Reject invalid invoices before expensive operations  
✅ **Cost Efficient** - Don't call Python API/Vector DB for invalid data  
✅ **Clear Separation** - Business rules → ML processing → Storage  
✅ **Better UX** - Immediate feedback on rule violations  
✅ **Easier Testing** - Independent validation layer  
✅ **Centralized Logic** - Single processing workflow for all entry points  
✅ **Detailed Tracking** - Know exactly why each invoice succeeded/failed  

## Testing

### Disable Rule Engine (for testing)
```properties
rule.engine.enabled=false
```

### Test Rule Engine API
```bash
curl -X POST http://localhost:9000/validate-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "VND-123",
    "service": "Consulting",
    "amount": 1250.00
  }'
```

### Expected Logs

**Successful Invoice:**
```
🔍 Validating invoice: vendorCode=VND-123, service=Consulting, amount=1250.00
✅ Rule validation result: valid=true, reason=Amount within vendor service limit
📋 Processing invoice: INV-001 - ABC Corp - VND-123 - Consulting - 2024-01-15 - 1250.00 - Services
✅ Invoice INV-001 passed rule validation
🐍 Python API response for invoice INV-001: {...}
✅ Invoice INV-001 processed successfully
```

**Rejected Invoice:**
```
🔍 Validating invoice: vendorCode=VND-123, service=Consulting, amount=15000.00
✅ Rule validation result: valid=false, reason=Amount exceeds vendor service limit
❌ Invoice INV-002 rejected by rule engine: Amount exceeds vendor service limit
❌ Invoice INV-002 rejected: Amount exceeds vendor service limit
```

## Backward Compatibility

✅ **Existing functionality preserved** - All current features work as before  
✅ **Optional feature** - Can be disabled via configuration  
✅ **Fail-open strategy** - Auto-approves if Rule Engine unavailable  
✅ **No breaking changes** - Existing API contracts maintained  

## Next Steps

1. Implement Rule Engine API endpoint
2. Define business rules (vendor limits, service pricing)
3. Test with sample invoices
4. Monitor rule rejection rates
5. Add MySQL persistence for rejected invoices
