# workflow.py
from typing import Dict, Any
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

def run_workflow(file_bytes: bytes) -> Dict[str, Any]:
    """
    Autonomous Agent Workflow: OCR → Validate → Embed → Similar → Decision → Risk Assessment → Persist → RAG → Synthesis → Escalation
    """
    state: Dict[str, Any] = {"file_bytes": file_bytes}

    # Execute nodes sequentially with autonomous decision making
    state = ocr_node(state)                    # Extract invoice data
    state = validate_node(state)               # Validate extracted data
    state = embed_node(state)                  # Prepare for vector operations
    state = similar_node(state)                # Check for duplicates BEFORE persisting
    
    # AUTONOMOUS DECISION MAKING NODES
    state = decision_node(state)               # LLM decides next action
    state = risk_assessment_node(state)        # LLM assesses risk level
    
    state = persist_node(state)                # Only persist if not duplicate
    state = rag_node(state)                    # Build context for synthesis
    state = synth_node(state)                  # Generate AI recommendations
    
    state = escalation_decision_node(state)    # LLM decides if human intervention needed

    return state
