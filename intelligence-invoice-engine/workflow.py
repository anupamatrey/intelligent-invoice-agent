# workflow.py
from typing import Dict, Any, Union
from nodes import (
    ocr_node,
    validate_node,
    embed_node,
    persist_node,
    similar_node,
    rag_node,
    synth_node,
    decision_node,
    risk_assessment_node,
    escalation_decision_node,
)
from extract_invoice import InvoiceData

def run_workflow(input_data: Union[bytes, dict, InvoiceData]) -> Dict[str, Any]:
    """
    Autonomous Agent Workflow: OCR → Validate → Embed → Similar → Decision → Risk Assessment → Persist → RAG → Synthesis → Escalation
    Accepts either file bytes or InvoiceData (dict or model)
    """
    # Determine starting point based on input type
    if isinstance(input_data, bytes):
        state: Dict[str, Any] = {"file_bytes": input_data}
        state = ocr_node(state)  # Extract invoice data from file
    else:
        # InvoiceData provided directly (skip OCR)
        invoice_dict = input_data.dict() if isinstance(input_data, InvoiceData) else input_data
        state: Dict[str, Any] = {"invoice": invoice_dict}

    # Execute remaining nodes sequentially
    state = validate_node(state)
    state = embed_node(state)
    state = similar_node(state)
    state = decision_node(state)
    state = risk_assessment_node(state)
    state = persist_node(state)
    state = rag_node(state)
    state = synth_node(state)
    state = escalation_decision_node(state)

    return state
