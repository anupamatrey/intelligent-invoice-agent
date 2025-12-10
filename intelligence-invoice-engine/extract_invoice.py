# extractor.py
import pandas as pd
import re
import logging
import json
from pydantic import BaseModel
from typing import Dict, Any
from io import BytesIO

logger = logging.getLogger(__name__)

class InvoiceData(BaseModel):
    invoice_number: str | None = None
    vendor: str | None = None
    date: str | None = None
    total_amount: str | None = None
    raw_text: str | None = None


def extract_invoice_from_excel_rows(xls_bytes: bytes) -> Dict[str, Any]:
    """
    Reads Excel file row by row and extracts invoice fields.
    """
    excel_file = BytesIO(xls_bytes)
    df = pd.read_excel(excel_file, sheet_name=0, dtype=str)
    df = df.fillna("")
    
    invoice_data = {
        "invoice_number": None,
        "vendor": None,
        "date": None,
        "total_amount": None,
        "raw_text": ""
    }
    
    # Read row by row
    for idx, row in df.iterrows():
        row_text = " ".join(str(cell) for cell in row.values if str(cell).strip())
        invoice_data["raw_text"] += row_text + "\n"
        
        # Check each cell for invoice fields
        for col_name, cell_value in row.items():
            col_lower = str(col_name).lower()
            val_lower = str(cell_value).lower()
            
            # Invoice Number
            if not invoice_data["invoice_number"]:
                if "invoice" in col_lower and ("number" in col_lower or "no" in col_lower or "#" in col_lower):
                    invoice_data["invoice_number"] = str(cell_value).strip()
                elif re.search(r"invoice\s*(?:no|#|number)", val_lower):
                    match = re.search(r"([A-Z0-9\-\_\/]+)", str(cell_value), re.IGNORECASE)
                    if match:
                        invoice_data["invoice_number"] = match.group(1).strip()
            
            # Vendor
            if not invoice_data["vendor"]:
                if "vendor" in col_lower or "supplier" in col_lower or "from" in col_lower:
                    invoice_data["vendor"] = str(cell_value).strip()
            
            # Date
            if not invoice_data["date"]:
                if "date" in col_lower:
                    invoice_data["date"] = str(cell_value).strip()
            
            # Total Amount
            if not invoice_data["total_amount"]:
                if "total" in col_lower or "amount" in col_lower:
                    # Try multiple patterns for amount extraction
                    cell_str = str(cell_value).strip()
                    # Pattern 1: Numbers with commas and decimals (1,350.00)
                    amount_match = re.search(r"[\d,]+\.\d{1,2}", cell_str)
                    if not amount_match:
                        # Pattern 2: Just numbers with decimals (1350.00)
                        amount_match = re.search(r"\d+\.\d{1,2}", cell_str)
                    if not amount_match:
                        # Pattern 3: Numbers with commas but no decimals (1,350)
                        amount_match = re.search(r"[\d,]+", cell_str)
                    
                    if amount_match:
                        invoice_data["total_amount"] = amount_match.group(0)
                # Also check if the cell value itself looks like an amount
                elif not invoice_data["total_amount"]:
                    cell_str = str(cell_value).strip()
                    if re.match(r"^[\d,]+\.\d{1,2}$", cell_str) or re.match(r"^\d+\.\d{1,2}$", cell_str):
                        invoice_data["total_amount"] = cell_str
    
    return invoice_data





def extract_invoice_from_xls_bytes(xls_bytes: bytes) -> InvoiceData:
    logger.info("Extracting invoice from Excel file")
    fields = extract_invoice_from_excel_rows(xls_bytes)
    
    # Log extracted data as JSON
    logger.info(f"Extracted invoice data: {json.dumps(fields, indent=2)}")
    
    return InvoiceData(**fields)
