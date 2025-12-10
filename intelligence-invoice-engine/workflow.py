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
)

def run_workflow(file_bytes: bytes) -> Dict[str, Any]:
    """
    Sequential workflow executor: OCR → Validate → Embed → Similar → Persist → RAG → Synthesis
    """
    state: Dict[str, Any] = {"file_bytes": file_bytes}

    # Execute nodes sequentially
    state = ocr_node(state)
    state = validate_node(state)
    state = embed_node(state)
    state = similar_node(state)  # Check for duplicates BEFORE persisting
    state = persist_node(state)  # Only persist if not duplicate
    state = rag_node(state)
    state = synth_node(state)

    return state
