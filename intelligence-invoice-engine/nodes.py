# nodes.py
from typing import Dict, Any, List
from extract_invoice import extract_invoice_from_xls_bytes
from validator import run_all_validations
from rag_engine import RAGEngine   # <- your merged class (embed + vectorstore + RAG)
import logging

logger = logging.getLogger(__name__)

# Create one shared RAGEngine instance (cheap to reuse models/clients)
rag_engine = RAGEngine()

# -----------------------
# OCR Node
# -----------------------
def ocr_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expects: state["file_bytes"]
    Produces: state["invoice"] (dict with fields + raw_text)
    """
    file_bytes = state.get("file_bytes")
    if not file_bytes:
        raise ValueError("ocr_node requires 'file_bytes' in state")

    invoice = extract_invoice_from_xls_bytes(file_bytes).dict()
    state["invoice"] = invoice
    logger.debug("ocr_node: extracted invoice fields")
    return state

# -----------------------
# Validation Node
# -----------------------
def validate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expects: state["invoice"]
    Produces: state["validation"]
    """
    invoice = state.get("invoice", {})
    validation = run_all_validations(invoice)
    state["validation"] = validation
    logger.debug("validate_node: validation completed")
    return state

# -----------------------
# Embed Node (split text into chunks)
# -----------------------
def embed_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expects: state["invoice"]
    Produces: state["chunks"] (List[Document]) and state["embedding_text"]
    """
    invoice = state.get("invoice", {})
    text = invoice.get("raw_text") or " ".join(filter(None, [
        invoice.get("vendor"),
        invoice.get("vendor_code"),
        invoice.get("service"),
        invoice.get("invoice_number"),
        invoice.get("total_amount")
    ]))
    # Save the text we will embed/retrieve on
    state["embedding_text"] = text

    # Split into chunks (langchain Document objects)
    chunks = rag_engine.split_documents(text)
    state["chunks"] = chunks
    logger.debug(f"embed_node: split into {len(chunks)} chunks")
    return state

# -----------------------
# Persist Node (embed & persist with dedup)
# -----------------------
def persist_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expects: state["chunks"], state["is_duplicate"]
    Produces: state["vector_doc_id"] (derived from invoice number or hash)
    Side-effect: upserts embeddings into Chroma (persisted) - only if not duplicate
    """
    chunks = state.get("chunks", [])
    if not chunks:
        logger.warning("persist_node: no chunks found, skipping persist")
        return state

    # Skip persisting if this is a duplicate
    if state.get("is_duplicate", False):
        logger.info("persist_node: skipping persist - duplicate detected")
        state["persisted_chunks"] = 0
    else:
        # embed + store with dedup checks inside RAGEngine
        inserted = rag_engine.embed_documents(chunks)  # returns number new docs (per your RAGEngine)
        state["persisted_chunks"] = inserted
        logger.debug(f"persist_node: persisted {inserted} new chunks")

    # create a doc id for the invoice (use invoice number when available)
    invoice_num = state.get("invoice", {}).get("invoice_number")
    if invoice_num:
        state["vector_doc_id"] = f"invoice_{invoice_num}"
    else:
        # fall back to a deterministic hash of the text
        import hashlib
        h = hashlib.md5(state["embedding_text"].encode("utf-8")).hexdigest()
        state["vector_doc_id"] = f"invoice_{h}"

    return state

# -----------------------
# Similarity Node (semantic duplicates / similar docs)
# -----------------------
def similar_node(state: Dict[str, Any], top_k: int = 5) -> Dict[str, Any]:
    """
    Expects: state["embedding_text"] OR state["embedding"] (we use text here)
    Produces: state["similar_invoices"], state["is_duplicate"], state["duplicate_details"]
    """
    text = state.get("embedding_text", "")
    if not text:
        logger.warning("similar_node: no embedding_text found, skipping similarity search")
        state["similar_invoices"] = []
        state["is_duplicate"] = False
        state["duplicate_details"] = None
        return state

    # Get similarity results with scores (ChromaDB returns distance, lower = more similar)
    similar_results = rag_engine.retrieve_with_scores(text, top_k=top_k)
    
    # Process results for duplicate detection and formatting
    similar_invoices = []
    is_duplicate = False
    duplicate_details = None
    
    for doc, distance in similar_results:
        # Convert distance to similarity score (1 - distance, capped at 0-1)
        similarity_score = max(0, 1 - distance)
        
        # Extract invoice info from metadata or content
        metadata = doc.metadata or {}
        
        invoice_info = {
            "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
            "similarity_score": round(similarity_score, 3),
            "metadata": metadata
        }
        
        # Check for duplicates (distance < 0.1 means very similar, similarity > 0.9)
        if distance < 0.1 and not is_duplicate:
            is_duplicate = True
            duplicate_details = {
                "duplicate_content": doc.page_content,
                "similarity_score": round(similarity_score, 3),
                "metadata": metadata
            }
        
        similar_invoices.append(invoice_info)
    
    state["similar_invoices"] = similar_invoices
    state["is_duplicate"] = is_duplicate
    state["duplicate_details"] = duplicate_details
    
    logger.debug(f"similar_node: found {len(similar_invoices)} similar docs, duplicate: {is_duplicate}")
    return state

# -----------------------
# RAG Node (build retrieval context)
# -----------------------
def rag_node(state: Dict[str, Any], top_k: int = 5) -> Dict[str, Any]:
    """
    Expects: state["embedding_text"]
    Produces: state["rag"] (retrieved hits / context)
    """
    text = state.get("embedding_text", "")
    if not text:
        logger.warning("rag_node: no embedding_text found, skipping RAG")
        state["rag"] = {"hits": []}
        return state

    rag_context = rag_engine.build_rag_context(text, top_k=top_k)
    state["rag"] = rag_context
    logger.debug(f"rag_node: retrieved {len(rag_context.get('hits', []))} hits")
    return state

# -----------------------
# Synthesis Node (LLM explanation)
# -----------------------
def synth_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expects: state["invoice"], state["validation"], state["rag"], state["is_duplicate"]
    Produces: state["synthesis"] (text)
    """
    invoice = state.get("invoice", {})
    validation = state.get("validation", {})
    rag_hits = state.get("rag", {}).get("hits", [])
    is_duplicate = state.get("is_duplicate", False)
    duplicate_details = state.get("duplicate_details")
    similar_invoices = state.get("similar_invoices", [])

    # Check for duplicate first
    if is_duplicate and duplicate_details:
        similarity_score = duplicate_details.get("similarity_score", 0)
        answer = f"⚠️ DUPLICATE DETECTED: This invoice appears to be a duplicate of a previously processed invoice (similarity: {similarity_score}). Recommendation: REJECT - Do not process for payment to avoid duplicate payment."
    else:
        # Build a short question/prompt automatically
        highest_similarity = max([inv.get("similarity_score", 0) for inv in similar_invoices], default=0)
        question = (
            f"Explain validation results for invoice {invoice.get('invoice_number')} "
            f"and recommend next steps. Include any evidence from retrieved documents. "
            f"Highest similarity to existing invoices: {highest_similarity}"
        )

        try:
            # Convert rag_hits to Documents for generate_answer
            from langchain_core.documents import Document
            docs = [Document(page_content=hit["content"], metadata=hit.get("metadata", {})) for hit in rag_hits]
            answer = rag_engine.generate_answer(question, docs)
            
            # Add duplicate check info to the answer
            if highest_similarity > 0:
                answer += f" No duplicates detected (highest similarity: {highest_similarity}). Recommendation: Approve for payment."
            else:
                answer += " No similar invoices found. Recommendation: Approve for payment."
                
        except Exception as e:
            logger.exception("synth_node: generate_answer failed, falling back to plain summary")
            # fallback synthesis
            answer = f"Validation overall_ok={validation.get('overall_ok')}. Issues: {validation.get('issues')}"

    state["synthesis"] = answer
    logger.debug("synth_node: synthesis completed")
    return state

# -----------------------
# AUTONOMOUS DECISION NODES
# -----------------------

def decision_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLM analyzes invoice and decides next processing action
    Produces: state["next_action"], state["decision_reasoning"]
    """
    invoice = state.get("invoice", {})
    validation = state.get("validation", {})
    is_duplicate = state.get("is_duplicate", False)
    
    prompt = f"""
    Analyze this invoice and decide the next action:
    
    Invoice Details:
    - Number: {invoice.get('invoice_number', 'N/A')}
    - Vendor: {invoice.get('vendor', 'N/A')}
    - Vendor Code: {invoice.get('vendor_code', 'N/A')}
    - Service: {invoice.get('service', 'N/A')}
    - Amount: {invoice.get('total_amount', 'N/A')}
    - Date: {invoice.get('date', 'N/A')}
    
    Validation Status:
    - Overall OK: {validation.get('overall_ok', False)}
    - Issues: {validation.get('issues', [])}
    
    Duplicate Status: {is_duplicate}
    
    Choose ONE action and provide reasoning:
    1. APPROVE - Process normally (low risk, all validations pass)
    2. MANUAL_REVIEW - Requires human review (medium risk, some concerns)
    3. REJECT - Reject immediately (high risk, major issues)
    4. REQUEST_INFO - Need more information (missing critical data)
    
    Format: ACTION: [choice] | REASON: [brief explanation]
    """
    
    try:
        decision_response = rag_engine.generate_answer(prompt, [])
        
        # Parse the response
        if "ACTION:" in decision_response and "REASON:" in decision_response:
            parts = decision_response.split("|")
            action_part = parts[0].replace("ACTION:", "").strip().upper()
            reason_part = parts[1].replace("REASON:", "").strip() if len(parts) > 1 else "No reason provided"
        else:
            # Fallback parsing
            action_part = "MANUAL_REVIEW"  # Safe default
            reason_part = decision_response
        
        # Validate action
        valid_actions = ["APPROVE", "MANUAL_REVIEW", "REJECT", "REQUEST_INFO"]
        if action_part not in valid_actions:
            action_part = "MANUAL_REVIEW"
        
        state["next_action"] = action_part
        state["decision_reasoning"] = reason_part
        
    except Exception as e:
        logger.exception("decision_node: LLM decision failed, using fallback logic")
        # Fallback decision logic
        if is_duplicate:
            state["next_action"] = "REJECT"
            state["decision_reasoning"] = "Duplicate invoice detected"
        elif not validation.get("overall_ok", False):
            state["next_action"] = "MANUAL_REVIEW"
            state["decision_reasoning"] = "Validation issues found"
        else:
            state["next_action"] = "APPROVE"
            state["decision_reasoning"] = "All checks passed"
    
    logger.debug(f"decision_node: Action={state['next_action']}, Reason={state['decision_reasoning']}")
    return state

def risk_assessment_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLM assesses risk level and determines processing priority
    Produces: state["risk_level"], state["risk_analysis"], state["requires_approval"]
    """
    invoice = state.get("invoice", {})
    similar_invoices = state.get("similar_invoices", [])
    validation = state.get("validation", {})
    
    # Extract amount as float for analysis
    amount_str = invoice.get("total_amount", "0")
    try:
        amount = float(amount_str.replace(",", "").replace("$", ""))
    except:
        amount = 0
    
    prompt = f"""
    Assess the risk level for this invoice processing:
    
    Invoice Analysis:
    - Vendor: {invoice.get('vendor', 'Unknown')}
    - Vendor Code: {invoice.get('vendor_code', 'Unknown')}
    - Service: {invoice.get('service', 'Unknown')}
    - Amount: ${amount:,.2f}
    - Similar invoices in system: {len(similar_invoices)}
    - Validation issues: {len(validation.get('issues', []))}
    
    Risk Factors to Consider:
    - High amounts (>$10,000) = higher risk
    - New/unknown vendors = higher risk
    - Validation failures = higher risk
    - No similar invoices = medium risk
    - Many similar invoices = potential pattern
    
    Rate risk as: LOW, MEDIUM, or HIGH
    Provide reasoning for your assessment.
    
    Format: RISK: [level] | ANALYSIS: [detailed reasoning]
    """
    
    try:
        risk_response = rag_engine.generate_answer(prompt, [])
        
        # Parse response
        if "RISK:" in risk_response and "ANALYSIS:" in risk_response:
            parts = risk_response.split("|")
            risk_part = parts[0].replace("RISK:", "").strip().upper()
            analysis_part = parts[1].replace("ANALYSIS:", "").strip() if len(parts) > 1 else risk_response
        else:
            # Fallback parsing
            if "HIGH" in risk_response.upper():
                risk_part = "HIGH"
            elif "MEDIUM" in risk_response.upper():
                risk_part = "MEDIUM"
            else:
                risk_part = "LOW"
            analysis_part = risk_response
        
        # Validate risk level
        if risk_part not in ["LOW", "MEDIUM", "HIGH"]:
            risk_part = "MEDIUM"  # Safe default
        
        state["risk_level"] = risk_part
        state["risk_analysis"] = analysis_part
        state["requires_approval"] = risk_part in ["MEDIUM", "HIGH"]
        
    except Exception as e:
        logger.exception("risk_assessment_node: LLM risk assessment failed, using fallback logic")
        # Fallback risk assessment
        if amount > 10000 or len(validation.get("issues", [])) > 0:
            state["risk_level"] = "HIGH"
            state["requires_approval"] = True
        elif amount > 1000 or len(similar_invoices) == 0:
            state["risk_level"] = "MEDIUM"
            state["requires_approval"] = True
        else:
            state["risk_level"] = "LOW"
            state["requires_approval"] = False
        
        state["risk_analysis"] = f"Fallback assessment: Amount=${amount:,.2f}, Issues={len(validation.get('issues', []))}"
    
    logger.debug(f"risk_assessment_node: Risk={state['risk_level']}, Approval Required={state['requires_approval']}")
    return state

def escalation_decision_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLM decides if human intervention is needed
    Produces: state["escalate_to_human"], state["escalation_reason"], state["priority_level"]
    """
    risk_level = state.get("risk_level", "MEDIUM")
    validation = state.get("validation", {})
    is_duplicate = state.get("is_duplicate", False)
    next_action = state.get("next_action", "APPROVE")
    invoice = state.get("invoice", {})
    
    prompt = f"""
    Determine if this invoice requires human escalation:
    
    Current Status:
    - Risk Level: {risk_level}
    - Recommended Action: {next_action}
    - Validation Issues: {validation.get('issues', [])}
    - Is Duplicate: {is_duplicate}
    - Invoice Amount: {invoice.get('total_amount', 'N/A')}
    - Vendor: {invoice.get('vendor', 'N/A')}
    - Vendor Code: {invoice.get('vendor_code', 'N/A')}
    - Service: {invoice.get('service', 'N/A')}
    
    Escalation Criteria:
    - HIGH risk always escalates
    - REJECT actions need human confirmation
    - Complex validation issues
    - Large amounts (>$5,000)
    - New vendor patterns
    
    Also assign priority: URGENT, HIGH, NORMAL, LOW
    
    Should this be escalated to a human? Respond YES or NO with reasoning.
    
    Format: ESCALATE: [YES/NO] | PRIORITY: [level] | REASON: [explanation]
    """
    
    try:
        escalation_response = rag_engine.generate_answer(prompt, [])
        
        # Parse response
        escalate = "NO"
        priority = "NORMAL"
        reason = escalation_response
        
        if "ESCALATE:" in escalation_response:
            parts = escalation_response.split("|")
            escalate_part = parts[0].replace("ESCALATE:", "").strip().upper()
            escalate = "YES" if "YES" in escalate_part else "NO"
            
            if len(parts) > 1 and "PRIORITY:" in parts[1]:
                priority_part = parts[1].replace("PRIORITY:", "").strip().upper()
                if priority_part in ["URGENT", "HIGH", "NORMAL", "LOW"]:
                    priority = priority_part
            
            if len(parts) > 2 and "REASON:" in parts[2]:
                reason = parts[2].replace("REASON:", "").strip()
        else:
            # Simple parsing
            escalate = "YES" if "YES" in escalation_response.upper() else "NO"
        
        state["escalate_to_human"] = escalate == "YES"
        state["escalation_reason"] = reason
        state["priority_level"] = priority
        
    except Exception as e:
        logger.exception("escalation_decision_node: LLM escalation decision failed, using fallback logic")
        # Fallback escalation logic
        should_escalate = (
            risk_level == "HIGH" or 
            next_action in ["REJECT", "MANUAL_REVIEW"] or
            is_duplicate or
            len(validation.get("issues", [])) > 2
        )
        
        state["escalate_to_human"] = should_escalate
        state["escalation_reason"] = f"Fallback: Risk={risk_level}, Action={next_action}, Issues={len(validation.get('issues', []))}"
        state["priority_level"] = "HIGH" if should_escalate else "NORMAL"
    
    logger.debug(f"escalation_decision_node: Escalate={state['escalate_to_human']}, Priority={state['priority_level']}")
    return state