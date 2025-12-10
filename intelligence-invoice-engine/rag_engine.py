import os
import hashlib
import logging
from typing import List
from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

# Your working Groq helper
from langchain.chat_models import init_chat_model

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class RAGEngine:
    """
    Single combined module that performs:
    - text splitting
    - embeddings
    - vector storage with dedup
    - retrieval
    - LLM answer generation
    """

    def __init__(self):
        self.persist_directory = "./chroma_store"
        self.collection_name = "rag_collection"

        # Embedder - Using HuggingFace (free, runs locally)
        logger.info("Initializing HuggingFace embeddings...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

        # Vector DB (persistent)
        self.vector_store = Chroma(
            collection_name=self.collection_name,
            embedding_function=self.embeddings,
            persist_directory=self.persist_directory
        )

    # ----------------------------
    # 1. TEXT SPLITTING
    # ----------------------------
    def split_documents(self, text: str) -> List[Document]:
        logger.info("Splitting text into chunks...")
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        docs = [Document(page_content=text)]
        chunks = splitter.split_documents(docs)
        logger.info(f"Created {len(chunks)} chunks")
        return chunks

    # ----------------------------
    # 2. EMBEDDINGS + DEDUP
    # ----------------------------
    def compute_hash(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def embed_documents(self, docs: List[Document]) -> int:
        logger.info("Embedding documents with dedup check...")

        try:
            existing = self.vector_store.get(include=["metadatas"])
            existing_hashes = {m["hash"] for m in existing["metadatas"] if "hash" in m}
        except:
            existing_hashes = set()

        new_docs = []
        for d in docs:
            h = self.compute_hash(d.page_content)
            d.metadata["hash"] = h
            if h not in existing_hashes:
                new_docs.append(d)
            else:
                logger.info(f"Skipping duplicate chunk: {h}")

        if new_docs:
            self.vector_store.add_documents(new_docs)
            self.vector_store.persist()

        logger.info(f"{len(new_docs)} new documents embedded.")
        return len(new_docs)

    # ----------------------------
    # 3. RETRIEVAL
    # ----------------------------
    def retrieve(self, query: str) -> List[Document]:
        logger.info(f"Retrieving for query: {query}")
        retriever = self.vector_store.as_retriever(search_kwargs={"k": 3})
        return retriever.invoke(query)
    
    def retrieve_with_scores(self, query: str, top_k: int = 5) -> List[tuple]:
        """Retrieve documents with similarity scores for duplicate detection"""
        logger.info(f"Retrieving with scores for query: {query}")
        results = self.vector_store.similarity_search_with_score(query, k=top_k)
        return results
    
    def build_rag_context(self, query: str, top_k: int = 5) -> dict:
        logger.info(f"Building RAG context for query: {query}")
        docs = self.retrieve(query)
        return {
            "hits": [{
                "content": d.page_content,
                "metadata": d.metadata
            } for d in docs],
            "query": query
        }

    # ----------------------------
    # 4. RAG GENERATION
    # ----------------------------
    def docs_to_context(self, docs: List[Document]) -> str:
        return "\n\n".join(d.page_content for d in docs)

    def generate_answer(self, query: str, docs: List[Document]) -> str:
        llm = init_chat_model("llama-3.1-8b-instant", model_provider="groq")

        prompt = ChatPromptTemplate.from_template("""
Answer ONLY based on the following context:

{context}

Question: {question}
Answer:
""")

        chain = (
            {
                "context": lambda _: self.docs_to_context(docs),
                "question": RunnablePassthrough(),
            }
            | prompt
            | llm
            | StrOutputParser()
        )

        return chain.invoke(query)
    
    # ----------------------------
    # 5. DATABASE MANAGEMENT
    # ----------------------------
    def get_database_status(self) -> dict:
        """Get vector database status and statistics"""
        try:
            collection = self.vector_store._collection
            count = collection.count()
            return {
                "status": "active",
                "total_documents": count,
                "collection_name": self.collection_name,
                "persist_directory": self.persist_directory
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "total_documents": 0
            }
    
    def clear_database(self) -> dict:
        """Clear all documents from vector database"""
        try:
            collection = self.vector_store._collection
            count_before = collection.count()
            collection.delete()
            return {
                "status": "success",
                "message": "Vector database cleared",
                "documents_removed": count_before
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to clear database: {str(e)}"
            }
    
    def list_invoices(self) -> dict:
        """List all stored invoices with metadata"""
        try:
            collection = self.vector_store._collection
            results = collection.get(include=["metadatas", "documents"])
            
            invoices = []
            for i, (doc, metadata) in enumerate(zip(results["documents"], results["metadatas"])):
                invoices.append({
                    "id": results["ids"][i],
                    "content_preview": doc[:100] + "..." if len(doc) > 100 else doc,
                    "metadata": metadata
                })
            
            return {
                "status": "success",
                "total_invoices": len(invoices),
                "invoices": invoices
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to list invoices: {str(e)}"
            }
    
    def delete_invoice(self, invoice_id: str) -> dict:
        """Delete specific invoice by ID"""
        try:
            collection = self.vector_store._collection
            collection.delete(ids=[invoice_id])
            return {
                "status": "success",
                "message": f"Invoice {invoice_id} deleted"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to delete invoice: {str(e)}"
            }
