# Intelligent Invoice Agent MCP Server

Spring Boot application that processes invoice files (XLSX) by integrating with a Python-based extraction API. Supports both traditional MCP tools and streaming transport.

## What is MCP Server?

Model Context Protocol (MCP) Server enables AI assistants to interact with external tools and services. This server:
- Exposes invoice processing capabilities as MCP tools
- Allows AI agents to extract, validate, and synthesize invoice data
- Provides structured responses for AI-driven workflows
- Acts as a bridge between AI models and the Python extraction service
- **Supports streaming transport** for real-time data delivery

## Features

- Upload XLSX invoice files via REST API
- Integration with Python extraction service
- CORS enabled for web applications
- Returns structured JSON with invoice data, validation, and synthesis
- **Real-time streaming** via Server-Sent Events (SSE)
- **MCP streaming tools** for AI agents

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

### Local Development
```bash
./gradlew bootRun
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop services
docker-compose down
```

**Docker Configuration:**
- **External Port**: 8081
- **Internal Port**: 8080
- **Python API**: `host.docker.internal:8000`

## API Endpoints

### Test Endpoint
**GET** `/api/v1/test`
- **Response**: Server status and timestamp

### Upload Invoice
**POST** `/api/v1/invoice-agent/upload`
- **Content-Type**: `multipart/form-data`
- **Parameter**: `file` (XLSX file)
- **Response**: Structured JSON with invoice data

```json
{
  "invoice": {},
  "validation": {},
  "persisted_chunks": 0,
  "vector_doc_id": "",
  "similar_invoices": [],
  "is_duplicate": false,
  "duplicate_details": null,
  "synthesis": ""
}
```

### Stream Data (SSE)
**GET** `/api/v1/stream`
- **Content-Type**: `text/event-stream`
- **Response**: Real-time customer data stream
- **Frequency**: Every 10 seconds

```json
{
  "id": "uuid",
  "name": "Anupam",
  "email": "user123@example.com",
  "city": "New York",
  "balance": 2847.65
}
```

## MCP Tools

Registered tools available for AI agents:

1. **extractInvoice** - Process and extract invoice data
2. **validateInvoice** - Validate invoice information
3. **streamCustomerData** - Stream real-time customer data

## Transport Methods

- **STDIO Transport**: For AI agents via MCP protocol
- **SSE Transport**: For web UIs via HTTP streaming
- **REST API**: Traditional HTTP endpoints

## CORS Configuration

Allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`

## Client Integration

### JavaScript SSE Client
```javascript
const eventSource = new EventSource('http://localhost:8081/api/v1/stream');
eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
};
```

### React Hook
```javascript
function useCustomerStream() {
    const [customers, setCustomers] = useState([]);
    useEffect(() => {
        const eventSource = new EventSource('http://localhost:8081/api/v1/stream');
        eventSource.onmessage = (event) => {
            setCustomers(prev => [...prev, JSON.parse(event.data)]);
        };
        return () => eventSource.close();
    }, []);
    return customers;
}
```

## Environment Variables

Create `.env` file for sensitive configuration (already in .gitignore).
