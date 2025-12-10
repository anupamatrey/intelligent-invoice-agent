from pydantic import BaseModel
from typing import Optional


class InvoiceData(BaseModel):
    invoice_number: Optional[str]
    vendor: Optional[str]
    date: Optional[str]
    total_amount: Optional[str]
    raw_text: str
