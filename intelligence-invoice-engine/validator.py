import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def run_all_validations(invoice: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates invoice fields and returns validation results.
    """
    logger.info("Running invoice validations")
    
    issues = []
    
    # Check required fields
    if not invoice.get("invoice_number"):
        issues.append("Missing invoice number")
    
    if not invoice.get("vendor"):
        issues.append("Missing vendor")
    
    if not invoice.get("date"):
        issues.append("Missing date")
    
    if not invoice.get("total_amount"):
        issues.append("Missing total amount")
    
    overall_ok = len(issues) == 0
    
    validation_result = {
        "overall_ok": overall_ok,
        "issues": issues,
        "fields_validated": ["invoice_number", "vendor", "date", "total_amount"]
    }
    
    logger.info(f"Validation result: {validation_result}")
    return validation_result
