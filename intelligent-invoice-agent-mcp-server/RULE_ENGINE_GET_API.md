# Rule Engine API - GET Request Implementation

## ✅ Updated to Use GET Request

The `RuleEngineService` has been updated to use **GET** request with path parameters instead of POST.

## 🔄 API Call Details

### Request Format
```
GET http://localhost:8082/api/vendor-rules/{vendorCode}/{service}
```

### Example
```
GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
```

### Parameters
- **vendorCode**: Vendor identifier (e.g., VEND001)
- **service**: Service type (e.g., DELIVERY, CONSULTING, SUPPORT)
- **amount**: Invoice amount (passed but not used in URL - for logging only)

---

## 📊 Expected Response

Your Rule Engine API should return:

```json
{
  "valid": true,
  "reason": "Range pricing rule found",
  "vendor_code": "VEND001",
  "service_name": "DELIVERY",
  "pricing_type": "RANGE",
  "min_amount": 1000.00,
  "max_amount": 5000.00,
  "currency": "USD",
  "is_active": true
}
```

---

## 🎯 Flow Example

### Invoice Data
```
Invoice Number: INV-2025-001
Vendor: NovaTech Solutions
Vendor Code: VEND001
Service: DELIVERY
Amount: 1,250.00
```

### API Call
```
🔍 Validating invoice: vendorCode=VEND001, service=DELIVERY, amount=1250.00
🎯 Calling Rule Engine API: GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
```

### Response Processing
```
✅ Rule validation result: valid=true, reason=Range pricing rule found
✅ Amount within range: [1000.00, 5000.00], Actual=1250.00
✅ Invoice INV-2025-001 passed rule validation
🐍 Calling Python API for ML processing...
```

---

## 🔧 Configuration

### application.properties
```properties
# Rule Engine Configuration
rule.engine.api.url=http://localhost:8082/api/vendor-rules
rule.engine.enabled=true
```

**Note:** The URL should be the **base path** without the parameters. The service will append `/{vendorCode}/{service}` automatically.

---

## 🧪 Testing

### Test 1: Valid Rule Exists
```bash
curl -X GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
```

**Expected Response:**
```json
{
  "valid": true,
  "reason": "Range pricing rule found",
  "vendor_code": "VEND001",
  "service_name": "DELIVERY",
  "pricing_type": "RANGE",
  "min_amount": 1000.00,
  "max_amount": 5000.00,
  "currency": "USD"
}
```

### Test 2: No Rule Found
```bash
curl -X GET http://localhost:8082/api/vendor-rules/VEND999/UNKNOWN
```

**Expected Response:**
```json
{
  "valid": false,
  "reason": "No pricing rule found for vendor-service combination",
  "vendor_code": "VEND999",
  "service_name": "UNKNOWN"
}
```

---

## 💻 Your Rule Engine Controller Should Look Like

```java
@RestController
@RequestMapping("/api/vendor-rules")
public class VendorRuleController {
    
    @Autowired
    private VendorServiceRuleRepository ruleRepository;
    
    @GetMapping("/{vendorCode}/{serviceName}")
    public RuleEngineResponse getVendorRule(
            @PathVariable String vendorCode,
            @PathVariable String serviceName) {
        
        LOG.info("Fetching rule for vendorCode={}, serviceName={}", vendorCode, serviceName);
        
        // Find rule from database
        VendorServiceRule rule = ruleRepository
            .findByVendorCodeAndServiceNameAndIsActiveTrue(vendorCode, serviceName)
            .orElse(null);
        
        if (rule == null) {
            LOG.warn("No rule found for {}/{}", vendorCode, serviceName);
            RuleEngineResponse response = new RuleEngineResponse(false, 
                "No pricing rule found for vendor-service combination");
            response.setVendorCode(vendorCode);
            response.setServiceName(serviceName);
            return response;
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
        
        LOG.info("Rule found: pricingType={}, minAmount={}, maxAmount={}", 
                 rule.getPricingType(), rule.getMinAmount(), rule.getMaxAmount());
        
        return response;
    }
}
```

---

## 📝 Expected Logs

### Successful Validation
```
🔍 Validating invoice: vendorCode=VEND001, service=DELIVERY, amount=1250.00
🎯 Calling Rule Engine API: GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
✅ Rule validation result: valid=true, reason=Range pricing rule found
📋 Processing invoice: INV-2025-001 - NovaTech Solutions - VEND001 - DELIVERY - 2024-01-15 - 1250.00
✅ Amount within range: [1000.00, 5000.00], Actual=1250.00
✅ Invoice INV-2025-001 passed rule validation
🐍 Calling Python API: http://localhost:8000/process-invoice-data
```

### Rule Not Found
```
🔍 Validating invoice: vendorCode=VEND999, service=UNKNOWN, amount=1250.00
🎯 Calling Rule Engine API: GET http://localhost:8082/api/vendor-rules/VEND999/UNKNOWN
✅ Rule validation result: valid=false, reason=No pricing rule found for vendor-service combination
❌ Invoice INV-XXX rejected by rule engine: No pricing rule found for vendor-service combination
```

### Rule Engine Unavailable
```
🔍 Validating invoice: vendorCode=VEND001, service=DELIVERY, amount=1250.00
🎯 Calling Rule Engine API: GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
❌ Rule Engine API error: Connection refused
❌ Rule Engine unavailable. Auto-approving invoice.
✅ Invoice INV-2025-001 passed rule validation (auto-approved)
🐍 Calling Python API: http://localhost:8000/process-invoice-data
```

---

## ✅ Key Changes

1. ✅ **Changed from POST to GET**
2. ✅ **URL format**: `{baseUrl}/{vendorCode}/{service}`
3. ✅ **No request body** - parameters in URL path
4. ✅ **Base URL updated**: `http://localhost:8082/api/vendor-rules`
5. ✅ **Null response handling** added

---

## 🔍 Troubleshooting

### Issue: 404 Not Found
**Cause:** Rule Engine API endpoint not implemented or wrong URL

**Solution:** 
- Verify Rule Engine is running on port 8082
- Check endpoint: `GET /api/vendor-rules/{vendorCode}/{service}`
- Test with curl: `curl http://localhost:8082/api/vendor-rules/VEND001/DELIVERY`

### Issue: Connection Refused
**Cause:** Rule Engine service not running

**Solution:**
- Start Rule Engine service
- Or disable rule engine: `rule.engine.enabled=false`

### Issue: Null Response
**Cause:** Rule Engine returns null instead of proper response

**Solution:**
- Ensure Rule Engine returns valid JSON
- Check response format matches `RuleEngineResponse` structure

---

## 🎯 Summary

✅ **API Method**: GET (changed from POST)  
✅ **URL Format**: `http://localhost:8082/api/vendor-rules/{vendorCode}/{service}`  
✅ **Example**: `GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY`  
✅ **Response**: `RuleEngineResponse` with vendor service rule details  
✅ **Fallback**: Auto-approve if API unavailable  

Your integration is ready! 🚀
