# Troubleshooting: "Invoice N/A rejected: No valid invoice data found"

## 🔍 Root Cause

This error occurs when the **ExcelParser** returns an empty list of invoices, meaning no rows passed validation.

## 📋 Excel File Requirements

Your Excel file **MUST** have the following structure:

### Column Order (0-indexed)
| Column | Field | Type | Required | Example |
|--------|-------|------|----------|---------|
| A (0) | Invoice Number | String | ✅ Yes | INV-001 |
| B (1) | Vendor | String | ✅ Yes | ABC Corp |
| C (2) | Vendor Code | String | ✅ Yes | VND-123 |
| D (3) | Service | String | ✅ Yes | Consulting |
| E (4) | Date | Date | ✅ Yes | 01/15/2024 |
| F (5) | Total Amount | Number | ✅ Yes | 1250.00 |
| G (6) | Description | String | ❌ No | Services rendered |

### ⚠️ Common Issues

#### 1. **Missing Header Row**
```
❌ WRONG:
INV-001 | ABC Corp | VND-123 | ...

✅ CORRECT:
Invoice Number | Vendor | Vendor Code | Service | Date | Amount | Description
INV-001 | ABC Corp | VND-123 | Consulting | 01/15/2024 | 1250.00 | Services
```

#### 2. **Wrong Column Order**
```
❌ WRONG:
Vendor | Invoice Number | Date | ...

✅ CORRECT:
Invoice Number | Vendor | Vendor Code | Service | Date | Amount | Description
```

#### 3. **Missing Required Fields**
All fields except Description are **required**:
- ❌ Empty Invoice Number → Row rejected
- ❌ Empty Vendor Code → Row rejected
- ❌ Empty Service → Row rejected
- ❌ Missing Date → Row rejected
- ❌ Amount = 0 or negative → Row rejected

#### 4. **Invalid Date Format**
Supported formats:
- ✅ `MM/dd/yyyy` (01/15/2024)
- ✅ `yyyy-MM-dd` (2024-01-15)
- ✅ `dd/MM/yyyy` (15/01/2024)
- ✅ `M/d/yyyy` (1/15/2024)
- ❌ `15-Jan-2024` (NOT supported)

#### 5. **Invalid Amount Format**
Supported formats:
- ✅ `1250.00` (number)
- ✅ `$1,250.00` (string with currency)
- ✅ `1250` (integer)
- ❌ `1250.00 USD` (NOT supported)
- ❌ Empty cell (NOT supported)

---

## 🔧 Debugging Steps

### Step 1: Check Application Logs

Look for these log messages:

```
📊 Parsing Excel file: X rows found (including header)
Processing row 1
Row 1 values: invoiceNum=INV-001, vendor=ABC Corp, vendorCode=VND-123, ...
✅ All required fields present and valid
✅ Parsed invoice: num=INV-001, vendor=ABC Corp, ...
✅ Row 1 parsed successfully
✅ Successfully parsed 1 invoices from 1 data rows
```

### Step 2: Identify Validation Failures

If you see:
```
❌ Validation failed: Missing vendor code
❌ Row 2 rejected: Missing required invoice fields
❌ Row 2 skipped - validation failed
```

**Action:** Check that row 2 has a value in column C (Vendor Code)

### Step 3: Check for Parsing Errors

If you see:
```
❌ Error parsing row 3: Cannot parse date
```

**Action:** Check the date format in row 3, column E

---

## 📝 Sample Valid Excel File

### Sheet1
```
| Invoice Number | Vendor    | Vendor Code | Service     | Date       | Total Amount | Description        |
|----------------|-----------|-------------|-------------|------------|--------------|-------------------|
| INV-001        | ABC Corp  | VND-123     | Consulting  | 01/15/2024 | 1250.00      | Services rendered |
| INV-002        | XYZ Inc   | VND-456     | Support     | 01/16/2024 | 500.00       | Monthly support   |
| INV-003        | DEF Ltd   | VND-789     | Development | 01/17/2024 | 3500.00      | Custom dev work   |
```

---

## 🧪 Testing

### Test 1: Minimal Valid File
Create a file with just 1 data row:
```
Invoice Number | Vendor   | Vendor Code | Service    | Date       | Total Amount | Description
INV-TEST       | Test Co  | VND-TEST    | Testing    | 01/15/2024 | 100.00       | Test invoice
```

**Expected Logs:**
```
📊 Parsing Excel file: 2 rows found (including header)
Processing row 1
✅ All required fields present and valid
✅ Parsed invoice: num=INV-TEST, vendor=Test Co, vendorCode=VND-TEST, ...
✅ Successfully parsed 1 invoices from 1 data rows
```

### Test 2: Missing Vendor Code
```
Invoice Number | Vendor   | Vendor Code | Service    | Date       | Total Amount | Description
INV-TEST       | Test Co  |             | Testing    | 01/15/2024 | 100.00       | Test invoice
```

**Expected Logs:**
```
📊 Parsing Excel file: 2 rows found (including header)
Processing row 1
Row 1 values: invoiceNum=INV-TEST, vendor=Test Co, vendorCode=null, ...
❌ Validation failed: Missing vendor code
❌ Row 1 rejected: Missing required invoice fields
⚠️ File 'test.xlsx' rejected: No valid invoice data found
```

---

## 🛠️ Quick Fixes

### Fix 1: Enable Debug Logging
In `application.properties`:
```properties
logging.level.com.anupam.mcp.server.service.ExcelParser=DEBUG
```

This will show detailed cell values for each row.

### Fix 2: Temporarily Disable Validation
For testing, you can comment out validation in `ExcelParser.java`:
```java
// Temporarily disable for testing
// if (!isValidInvoice(...)) {
//     return null;
// }
```

### Fix 3: Check File Format
Ensure your file is:
- ✅ `.xlsx` format (not `.xls` or `.csv`)
- ✅ Has data in Sheet1 (first sheet)
- ✅ Has header row in row 1
- ✅ Has data starting from row 2

---

## 📊 Expected Log Flow

### Successful Processing
```
📄 Processing invoice file: invoices.xlsx from source: MANUAL_UPLOAD
📊 Parsing Excel file: 4 rows found (including header)
Processing row 1
✅ All required fields present and valid
✅ Parsed invoice: num=INV-001, vendor=ABC Corp, vendorCode=VND-123, service=Consulting, date=2024-01-15, amount=1250.00
✅ Row 1 parsed successfully
Processing row 2
✅ All required fields present and valid
✅ Parsed invoice: num=INV-002, vendor=XYZ Inc, vendorCode=VND-456, service=Support, date=2024-01-16, amount=500.00
✅ Row 2 parsed successfully
✅ Successfully parsed 2 invoices from 3 data rows
📋 Processing invoice: INV-001 - ABC Corp - VND-123 - Consulting - 2024-01-15 - 1250.00 - Services
🔍 Validating invoice: vendorCode=VND-123, service=Consulting, amount=1250.00
```

### Failed Processing
```
📄 Processing invoice file: invoices.xlsx from source: MANUAL_UPLOAD
📊 Parsing Excel file: 2 rows found (including header)
Processing row 1
Row 1 values: invoiceNum=INV-001, vendor=ABC Corp, vendorCode=null, service=Consulting, date=2024-01-15, amount=1250.00
❌ Validation failed: Missing vendor code
❌ Row 1 rejected: Missing required invoice fields
❌ Row 1 skipped - validation failed
✅ Successfully parsed 0 invoices from 1 data rows
⚠️ File 'invoices.xlsx' rejected: No valid invoice data found
❌ Invoice N/A rejected: No valid invoice data found
```

---

## 🎯 Checklist

Before uploading, verify:
- [ ] File is `.xlsx` format
- [ ] Header row exists in row 1
- [ ] All 7 columns present (A-G)
- [ ] Column order matches specification
- [ ] Invoice Number is not empty
- [ ] Vendor is not empty
- [ ] Vendor Code is not empty
- [ ] Service is not empty
- [ ] Date is in supported format
- [ ] Amount is > 0
- [ ] At least one data row exists

---

## 💡 Pro Tips

1. **Use Excel's Data Validation** to prevent empty cells
2. **Format date column** as Date type in Excel
3. **Format amount column** as Number with 2 decimals
4. **Test with a single row** first before uploading full file
5. **Check logs immediately** after upload to see parsing details

---

## 🆘 Still Having Issues?

1. Enable DEBUG logging
2. Upload a single-row test file
3. Check logs for exact validation failure
4. Verify column order matches specification
5. Ensure all required fields have values
