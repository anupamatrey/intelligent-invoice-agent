# Troubleshooting: Null Response from Rule Engine API

## 🔍 Issue Fixed

Added **debug logging** and **JSON deserialization improvements** to diagnose why `RuleEngineResponse` attributes are null.

## ✅ What Was Fixed

### 1. Added Raw Response Logging
```java
// Get raw response as String first for debugging
String rawResponse = restTemplate.getForObject(url, String.class);
LOG.info("📦 Raw API Response: {}", rawResponse);
```

This will show you **exactly** what your API is returning.

### 2. Added ObjectMapper with JavaTimeModule
```java
ObjectMapper mapper = new ObjectMapper();
mapper.registerModule(new JavaTimeModule());  // For LocalDateTime
RuleEngineResponse response = mapper.readValue(rawResponse, RuleEngineResponse.class);
```

### 3. Added @JsonIgnoreProperties
```java
@JsonIgnoreProperties(ignoreUnknown = true)
public class RuleEngineResponse {
    // Will ignore any extra fields from your API
}
```

### 4. Enhanced Logging
```java
LOG.info("✅ Rule validation result: valid={}, reason={}, pricingType={}, minAmount={}, maxAmount={}", 
         response.isValid(), response.getReason(), response.getPricingType(), 
         response.getMinAmount(), response.getMaxAmount());
```

---

## 🔍 Common Causes of Null Attributes

### Cause 1: Field Name Mismatch

**Your API returns:**
```json
{
  "vendorCode": "VEND001",
  "serviceName": "DELIVERY"
}
```

**But RuleEngineResponse expects:**
```json
{
  "vendor_code": "VEND001",
  "service_name": "DELIVERY"
}
```

**Solution:** Use `@JsonProperty` annotations (already added):
```java
@JsonProperty("vendor_code")
private String vendorCode;

@JsonProperty("service_name")
private String serviceName;
```

---

### Cause 2: Missing Fields in API Response

**Your API returns:**
```json
{
  "id": 1,
  "vendorCode": "VEND001",
  "serviceName": "DELIVERY",
  "pricingType": "RANGE",
  "minAmount": 1000.00,
  "maxAmount": 5000.00
}
```

**But doesn't include:**
- `valid` (required!)
- `reason` (required!)

**Solution:** Your Rule Engine API must return:
```json
{
  "valid": true,
  "reason": "Rule found",
  "vendor_code": "VEND001",
  "service_name": "DELIVERY",
  "pricing_type": "RANGE",
  "min_amount": 1000.00,
  "max_amount": 5000.00
}
```

---

### Cause 3: LocalDateTime Format Issue

**Your API returns:**
```json
{
  "effective_from": "2024-01-15T10:30:00"
}
```

**Solution:** ObjectMapper now has `JavaTimeModule` registered to handle this.

---

## 🧪 Debugging Steps

### Step 1: Check Raw Response

Run your application and look for this log:
```
📦 Raw API Response: {"id":1,"vendorCode":"VEND001",...}
```

This shows **exactly** what your API is returning.

### Step 2: Compare Field Names

Compare the raw response with `RuleEngineResponse` field names:

**Raw Response:**
```json
{
  "vendorCode": "VEND001"  ← camelCase
}
```

**RuleEngineResponse expects:**
```json
{
  "vendor_code": "VEND001"  ← snake_case
}
```

### Step 3: Check for Missing Required Fields

Ensure your API returns:
- ✅ `valid` (boolean)
- ✅ `reason` (string)

These are **required** for the validation logic to work.

---

## 🎯 Your Rule Engine API Should Return

### Minimum Required Response
```json
{
  "valid": true,
  "reason": "Rule found"
}
```

### Complete Response (Recommended)
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

## 💻 Update Your Rule Engine Controller

### Option 1: Return VendorServiceRule Directly (Current)
```java
@GetMapping("/{vendorCode}/{serviceName}")
public VendorServiceRule getVendorRule(@PathVariable String vendorCode,
                                       @PathVariable String serviceName) {
    return ruleRepository.findByVendorCodeAndServiceName(vendorCode, serviceName)
        .orElse(null);
}
```

**Problem:** Missing `valid` and `reason` fields!

### Option 2: Map to RuleEngineResponse (Recommended)
```java
@GetMapping("/{vendorCode}/{serviceName}")
public RuleEngineResponse getVendorRule(@PathVariable String vendorCode,
                                        @PathVariable String serviceName) {
    
    VendorServiceRule rule = ruleRepository
        .findByVendorCodeAndServiceNameAndIsActiveTrue(vendorCode, serviceName)
        .orElse(null);
    
    if (rule == null) {
        RuleEngineResponse response = new RuleEngineResponse(false, 
            "No pricing rule found for vendor-service combination");
        response.setVendorCode(vendorCode);
        response.setServiceName(serviceName);
        return response;
    }
    
    // Map entity to response
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
```

---

## 📝 Expected Logs (After Fix)

### Successful Case
```
🔍 Validating invoice: vendorCode=VEND001, service=DELIVERY, amount=1250.00
🎯 Calling Rule Engine API: GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
📦 Raw API Response: {"valid":true,"reason":"Rule found","vendor_code":"VEND001","service_name":"DELIVERY","pricing_type":"RANGE","min_amount":1000.00,"max_amount":5000.00}
✅ Rule validation result: valid=true, reason=Rule found, pricingType=RANGE, minAmount=1000.00, maxAmount=5000.00
```

### If Fields Are Null
```
🔍 Validating invoice: vendorCode=VEND001, service=DELIVERY, amount=1250.00
🎯 Calling Rule Engine API: GET http://localhost:8082/api/vendor-rules/VEND001/DELIVERY
📦 Raw API Response: {"id":1,"vendorCode":"VEND001","serviceName":"DELIVERY","pricingType":"RANGE","minAmount":1000.00,"maxAmount":5000.00}
✅ Rule validation result: valid=false, reason=null, pricingType=null, minAmount=null, maxAmount=null
```

**Problem:** Field names don't match! Your API uses `vendorCode` but we expect `vendor_code`.

---

## 🔧 Quick Fixes

### Fix 1: Update Your API to Use Snake Case
```java
// In your VendorServiceRule entity
@JsonProperty("vendor_code")
private String vendorCode;

@JsonProperty("service_name")
private String serviceName;
```

### Fix 2: Add valid and reason Fields
```java
@GetMapping("/{vendorCode}/{serviceName}")
public Map<String, Object> getVendorRule(...) {
    VendorServiceRule rule = ...;
    
    Map<String, Object> response = new HashMap<>();
    response.put("valid", rule != null);
    response.put("reason", rule != null ? "Rule found" : "No rule found");
    response.put("vendor_code", rule.getVendorCode());
    response.put("service_name", rule.getServiceName());
    // ... other fields
    
    return response;
}
```

---

## ✅ Checklist

Before testing:
- [ ] Your API returns `valid` field (boolean)
- [ ] Your API returns `reason` field (string)
- [ ] Field names use snake_case (`vendor_code`, not `vendorCode`)
- [ ] Or your entity has `@JsonProperty` annotations
- [ ] Test API with curl to verify JSON structure
- [ ] Check application logs for raw response

---

## 🆘 Still Having Issues?

1. **Check raw response log** - Shows exact JSON from your API
2. **Compare field names** - Must match `@JsonProperty` annotations
3. **Ensure valid/reason fields** - Required for validation logic
4. **Test API directly** - `curl http://localhost:8082/api/vendor-rules/VEND001/DELIVERY`
5. **Check for exceptions** - Look for deserialization errors in logs

The raw response logging will tell you exactly what's wrong! 🎯
