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
            answer = f"Validation overall_ok={validation.get('overall_ok')}. Issues: {validation.get('issues')}. No duplicates detected."

    state["synthesis"] = answer
    logger.debug("synth_node: synthesis completed")
    return state
