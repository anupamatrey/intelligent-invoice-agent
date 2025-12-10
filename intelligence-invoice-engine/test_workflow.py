"""
Test script to demonstrate the complete workflow step by step
"""
import logging
from workflow import run_workflow

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_workflow_with_sample():
    print("\n" + "="*80)
    print("INVOICE AI PROCESSOR - WORKFLOW DEMONSTRATION")
    print("="*80 + "\n")
    
    # Read sample invoice
    with open("sample_invoice.xlsx", "rb") as f:
        file_bytes = f.read()
    
    print("📄 Step 1: File loaded - sample_invoice.xlsx")
    print(f"   File size: {len(file_bytes)} bytes\n")
    
    # Run workflow
    print("🚀 Starting workflow...\n")
    result = run_workflow(file_bytes)
    
    # Display results step by step
    print("\n" + "="*80)
    print("WORKFLOW RESULTS")
    print("="*80 + "\n")
    
    print("📋 Step 2: OCR - Invoice Extraction")
    print("-" * 40)
    invoice = result.get("invoice", {})
    print(f"   Invoice Number: {invoice.get('invoice_number')}")
    print(f"   Vendor: {invoice.get('vendor')}")
    print(f"   Date: {invoice.get('date')}")
    print(f"   Total Amount: {invoice.get('total_amount')}")
    print()
    
    print("✅ Step 3: Validation")
    print("-" * 40)
    validation = result.get("validation", {})
    print(f"   Overall OK: {validation.get('overall_ok')}")
    print(f"   Issues: {validation.get('issues', [])}")
    print()
    
    print("📦 Step 4: Embedding")
    print("-" * 40)
    chunks = result.get("chunks", [])
    print(f"   Text chunks created: {len(chunks)}")
    print()
    
    print("💾 Step 5: Persistence")
    print("-" * 40)
    print(f"   New chunks stored: {result.get('persisted_chunks', 0)}")
    print(f"   Document ID: {result.get('vector_doc_id')}")
    print()
    
    print("🔍 Step 6: Similarity Search")
    print("-" * 40)
    similar = result.get("similar", [])
    print(f"   Similar documents found: {len(similar)}")
    print()
    
    print("🧠 Step 7: RAG Context")
    print("-" * 40)
    rag = result.get("rag", {})
    hits = rag.get("hits", [])
    print(f"   Context hits retrieved: {len(hits)}")
    print()
    
    print("✨ Step 8: AI Synthesis")
    print("-" * 40)
    synthesis = result.get("synthesis", "")
    print(f"   {synthesis}")
    print()
    
    print("="*80)
    print("WORKFLOW COMPLETED SUCCESSFULLY")
    print("="*80)

if __name__ == "__main__":
    test_workflow_with_sample()
