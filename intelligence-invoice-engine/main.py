import os
import sys
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).parent))
logger.info(f"Added to sys.path: {Path(__file__).parent}")

from fastapi import FastAPI, UploadFile, File, Request, Query
from fastapi.responses import JSONResponse
from extract_invoice import extract_invoice_from_xls_bytes
from workflow import run_workflow
from rag_engine import RAGEngine
import traceback

app = FastAPI(title="Invoice AI Processor")
logger.info("FastAPI app initialized")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()}
    )

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup complete")

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"status": "running", "message": "Invoice AI Processor"}

@app.get("/test")
async def test():
    logger.info("Test endpoint called")
    return {"status": "ok", "message": "API is working"}

@app.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    logger.info(f"Test upload called with file: {file.filename}")
    return {"filename": file.filename, "content_type": file.content_type}


@app.post("/ocr/extract")
async def extract_invoice(file: UploadFile = File(...)):
    try:
        logger.info(f"Received file: {file.filename}")
        
        content = await file.read()
        logger.info(f"Read {len(content)} bytes")

        logger.info("Starting invoice extraction")
        invoice_data = extract_invoice_from_xls_bytes(content)
        logger.info("Invoice extraction completed")

        return invoice_data.dict()

    except Exception as e:
        logger.error(f"Error processing invoice: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": str(e), "traceback": traceback.format_exc()},
            status_code=500
        )


@app.post("/process-invoice")
async def process_invoice(file: UploadFile = File(...)):
    try:
        logger.info(f"Received file: {file.filename}")
        
        file_bytes = await file.read()
        logger.info(f"Read {len(file_bytes)} bytes")

        logger.info("Starting complete invoice workflow")
        result = run_workflow(file_bytes)
        logger.info("Workflow completed")

        # Convert to JSON-serializable format
        serializable_result = {
            "invoice": result.get("invoice", {}),
            "validation": result.get("validation", {}),
            "persisted_chunks": result.get("persisted_chunks", 0),
            "vector_doc_id": result.get("vector_doc_id", ""),
            "similar_invoices": result.get("similar_invoices", []),
            "is_duplicate": result.get("is_duplicate", False),
            "duplicate_details": result.get("duplicate_details"),
            "synthesis": result.get("synthesis", "")
        }

        return serializable_result

    except Exception as e:
        logger.error(f"Error processing invoice: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": str(e), "traceback": traceback.format_exc()},
            status_code=500
        )

# Vector Database Management Endpoints
rag_engine = RAGEngine()

@app.get("/vector-db/status")
async def get_vector_db_status():
    """Get vector database status and statistics"""
    try:
        status = rag_engine.get_database_status()
        return status
    except Exception as e:
        logger.error(f"Error getting database status: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.delete("/vector-db/clear")
async def clear_vector_db(confirm: bool = Query(False)):
    """Clear all documents from vector database (requires confirmation)"""
    try:
        if not confirm:
            return JSONResponse(
                content={"error": "Confirmation required. Use ?confirm=true"},
                status_code=400
            )
        
        result = rag_engine.clear_database()
        logger.info(f"Vector database cleared: {result}")
        return result
    except Exception as e:
        logger.error(f"Error clearing database: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.get("/vector-db/invoices")
async def list_invoices():
    """List all stored invoices with metadata"""
    try:
        result = rag_engine.list_invoices()
        return result
    except Exception as e:
        logger.error(f"Error listing invoices: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.delete("/vector-db/invoice/{invoice_id}")
async def delete_invoice(invoice_id: str):
    """Delete specific invoice by ID"""
    try:
        result = rag_engine.delete_invoice(invoice_id)
        logger.info(f"Invoice deleted: {result}")
        return result
    except Exception as e:
        logger.error(f"Error deleting invoice: {str(e)}", exc_info=True)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )