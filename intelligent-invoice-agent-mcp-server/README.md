# Intelligent Invoice Agent MCP Server

Spring Boot application that processes invoice files (XLSX) by integrating with a Python-based extraction API.

## What is MCP Server?

Model Context Protocol (MCP) Server enables AI assistants to interact with external tools and services. This server:
- Exposes invoice processing capabilities as MCP tools
- Allows AI agents to extract, validate, and synthesize invoice data
- Provides structured responses for AI-driven workflows
- Acts as a bridge between AI models and the Python extraction service

## Features

- Upload XLSX invoice files via REST API
- Integration with Python extraction service
- CORS enabled for web applications
- Returns structured JSON with invoice data, validation, and synthesis

## Prerequisites

- Java 21
- Gradle
- Python API running on `http://localhost:8000/process-invoice`

## Configuration

Edit `src/main/resources/application.properties`:

```properties
# Server runs on port 8080 by default
python.api.url=http://localhost:8000/process-invoice
```

## Running the Application

```bash
./gradlew bootRun
```

## API Endpoints

### Upload Invoice

**POST** `/api/v1/invoice-agent/upload`

- **Content-Type**: `multipart/form-data`
- **Parameter**: `file` (XLSX file)
- **Response**: JSON object with invoice data

```json
{
  "invoice": {},
  "validation": {},
  "persisted_chunks": 0,
  "vector_doc_id": "",
  "synthesis": ""
}
```

## CORS Configuration

Allowed origin: `http://localhost:3000`

## Environment Variables

Create `.env` file for sensitive configuration (already in .gitignore).
