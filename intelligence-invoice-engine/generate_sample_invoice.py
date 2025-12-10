import pandas as pd

# Sample invoice data
data = {
    "Invoice Number": ["INV-2024-001"],
    "Vendor": ["ABC Corporation"],
    "Date": ["01/15/2024"],
    "Total Amount": ["1,250.00"],
    "Description": ["Professional Services"]
}

df = pd.DataFrame(data)

# Save as Excel file
df.to_excel("sample_invoice.xlsx", index=False, engine='openpyxl')
print("Sample invoice created: sample_invoice.xlsx")
