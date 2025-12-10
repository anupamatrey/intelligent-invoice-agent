# Invoice Agent - Testing Guide

## How to Run

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Test

### Screen 1: Upload Invoice
1. Click the upload area or drag & drop a file (PDF, PNG, JPG)
2. File preview will appear with name and size
3. Click "Start Processing" button (enabled only when file is selected)
4. Click the X icon to remove the selected file

### Screen 2: Processing
1. Watch the animated workflow progress through 3 stages:
   - **OCR Extraction** - Extracting text from invoice
   - **Data Validation** - Validating extracted data
   - **AI Analysis** - Generating insights
2. Progress bar shows overall completion percentage
3. Each step animates with pulse effect when active
4. Completed steps show green checkmark

### Screen 3: Results
1. **Validation Badge** - Shows ✓ Valid or ✗ Invalid status
2. **Extracted Data** - View invoice number, date, vendor, amount
3. **Line Items** - See itemized list with quantities and prices
4. **AI Insights & Analysis** - AI-generated insights, recommendations, and analysis about the invoice
5. **Duplicate Detection** - Red alert box if duplicate found with similarity score and details
6. **Submit Payment** - Button disabled/grayed out for duplicates
7. **JSON Viewer** - Raw JSON data in formatted view
8. **Download JSON** - Downloads the JSON file
9. **Process Another** - Returns to upload screen

## Features Included

✅ Drag & drop file upload  
✅ File preview with remove option  
✅ Animated processing workflow  
✅ Step-by-step progress indicators  
✅ Validation status badge  
✅ Structured data display  
✅ AI insights and analysis  
✅ Duplicate detection with red alerts  
✅ Payment button disabled for duplicates  
✅ JSON viewer with syntax highlighting  
✅ Download JSON functionality  
✅ Responsive design  
✅ Smooth transitions and animations  

## Next Steps (Backend Integration)

To connect with a real backend:

1. Replace `simulateProcessing()` with actual API calls
2. Add error handling for failed uploads/processing
3. Implement cancel functionality during processing
4. Add authentication if needed
5. Connect to your OCR, validation, and AI services

Example API integration:
```typescript
const processInvoice = async (file: File) => {
  const formData = new FormData();
  formData.append('invoice', file);
  
  const response = await fetch('/api/process-invoice', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
};
```
