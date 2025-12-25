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
- **Gmail Push Notifications** - Real-time email processing via Google Pub/Sub
- **Excel parsing** - Converts XLS/XLSX files to structured Invoice objects
- **Kafka Integration** - Consumes invoice responses from Aiven Kafka
- CORS enabled for web applications
- Returns structured JSON with invoice data, validation, and synthesis
- **Real-time streaming** via Server-Sent Events (SSE)
- **MCP streaming tools** for AI agents

## Prerequisites

- Java 21
- Gradle
- Python API running on `http://localhost:8000/process-invoice`
- Kafka cluster (Aiven or self-hosted)
- Kafka SSL certificate (`ca.pem`)

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
4. **triggerEmailPoll** - Manually trigger email check for invoices

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

## Gmail Push Notification System

### Overview

This application uses **Google Cloud Pub/Sub** for real-time email processing. When an email arrives in Gmail, Google instantly pushes a notification to your webhook, triggering immediate invoice processing.

### Architecture Flow

```
[Gmail Inbox] → [Email Arrives] → [Gmail API] → [Pub/Sub Topic] → [Pub/Sub Subscription] 
                                                                            ↓
                                                                    [Your Webhook]
                                                                            ↓
                                                                  [GmailWebhookController]
                                                                            ↓
                                                                    [GmailService]
                                                                            ↓
                                                                    [ExcelParser]
                                                                            ↓
                                                                  [Invoice Processing]
```

### Detailed Step-by-Step Flow

#### 1. Application Startup
**Class:** `GmailPushSetup.java`
- Listens for `ApplicationReadyEvent`
- Calls `GmailService.setupPushNotifications()`
- Registers Gmail watch request with Google
- Processes any existing unread emails

**What happens:**
```java
@EventListener(ApplicationReadyEvent.class)
public void setupPushNotifications() {
    gmailService.setupPushNotifications();      // Register with Gmail
    gmailService.handlePushNotification("startup-check"); // Process existing emails
}
```

#### 2. Gmail Watch Registration
**Class:** `GmailService.java` → `setupPushNotifications()`
- Creates Gmail API client with OAuth credentials
- Sends watch request to Gmail API
- Specifies Pub/Sub topic for notifications
- Watch expires after 7 days (needs renewal)

**What happens:**
```java
WatchRequest watchRequest = new WatchRequest()
    .setTopicName("projects/gmail-push-reader/topics/gmail-push-topic")
    .setLabelIds(List.of("INBOX"));

WatchResponse response = gmail.users().watch("me", watchRequest).execute();
// Gmail now sends notifications to Pub/Sub when emails arrive
```

#### 3. Email Arrives in Gmail
**External Event**
- User sends email with Excel attachment to configured Gmail address
- Gmail receives and stores the email
- Gmail detects new message in watched mailbox

#### 4. Gmail Publishes to Pub/Sub
**Google Infrastructure**
- Gmail API publishes notification to Pub/Sub topic: `gmail-push-topic`
- Notification contains: historyId, emailAddress
- Happens within milliseconds of email arrival

#### 5. Pub/Sub Pushes to Webhook
**Google Cloud Pub/Sub**
- Pub/Sub subscription detects new message
- Makes HTTP POST request to: `https://YOUR_NGROK_URL/webhook/gmail/push`
- Sends JSON payload with notification data

**Payload format:**
```json
{
  "message": {
    "data": "base64-encoded-data",
    "messageId": "12345",
    "publishTime": "2024-01-15T10:30:00Z"
  },
  "subscription": "projects/gmail-push-reader/subscriptions/gmail-push-subscription"
}
```

#### 6. Webhook Receives Notification
**Class:** `GmailWebhookController.java` → `handlePushNotification()`
**Endpoint:** `POST /webhook/gmail/push`

**What happens:**
```java
@PostMapping("/push")
public ResponseEntity<String> handlePushNotification(@RequestBody Map<String, Object> payload) {
    // 1. Extract message data
    Map<String, Object> message = payload.get("message");
    String messageId = message.get("messageId");
    
    // 2. Decode base64 data (contains historyId)
    String data = message.get("data");
    String decoded = new String(Base64.getDecoder().decode(data));
    
    // 3. Delegate to GmailService
    gmailService.handlePushNotification(messageId);
    
    // 4. Return 200 OK to acknowledge receipt
    return ResponseEntity.ok("OK");
}
```

#### 7. Process Push Notification
**Class:** `GmailService.java` → `handlePushNotification()`

**Rate Limiting:**
- Checks if already processing (prevents concurrent execution)
- Enforces 5-second minimum interval between processing
- Prevents Gmail API rate limit errors (429)

**What happens:**
```java
public void handlePushNotification(String historyId) {
    // Rate limiting checks
    if (isProcessing) return;
    if (now - lastProcessTime < 5000) return;
    
    isProcessing = true;
    
    // 1. Search for unread emails with attachments
    String query = "is:unread has:attachment";
    ListMessagesResponse response = gmail.users().messages()
        .list("me")
        .setQ(query)
        .setMaxResults(10L)
        .execute();
    
    // 2. Process each message
    for (Message message : messages) {
        processMessage(message.getId());
    }
    
    isProcessing = false;
}
```

#### 8. Fetch Email Details
**Class:** `GmailService.java` → `processMessage()`

**What happens:**
```java
private void processMessage(String messageId) {
    // 1. Fetch full message details from Gmail
    Message message = gmail.users().messages()
        .get("me", messageId)
        .execute();
    
    // 2. Extract attachments
    processAttachments(message, messageId);
    
    // 3. Mark email as read
    markAsRead(messageId);
}
```

#### 9. Extract Excel Attachments
**Class:** `GmailService.java` → `processAttachments()`

**What happens:**
```java
private void processAttachments(Message message, String messageId) {
    // 1. Iterate through message parts
    List<MessagePart> parts = message.getPayload().getParts();
    
    // 2. Find Excel files (.xlsx or .xls)
    for (MessagePart part : parts) {
        String filename = part.getFilename();
        if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
            // 3. Download attachment
            downloadAndProcessAttachment(messageId, attachmentId, filename);
        }
    }
}
```

#### 10. Download Attachment
**Class:** `GmailService.java` → `downloadAndProcessAttachment()`

**What happens:**
```java
private void downloadAndProcessAttachment(String messageId, String attachmentId, String filename) {
    // 1. Download attachment data from Gmail
    MessagePartBody attachmentData = gmail.users().messages().attachments()
        .get("me", messageId, attachmentId)
        .execute();
    
    // 2. Decode base64 data
    byte[] data = Base64.getUrlDecoder().decode(attachmentData.getData());
    
    // 3. Parse Excel file
    List<Invoice> invoices = excelParser.parseInvoices(new ByteArrayInputStream(data));
    
    // 4. Process invoices
    processInvoices(invoices, filename);
}
```

#### 11. Parse Excel File
**Class:** `ExcelParser.java` → `parseInvoices()`

**What happens:**
```java
public List<Invoice> parseInvoices(InputStream inputStream) {
    // 1. Open Excel workbook
    Workbook workbook = new XSSFWorkbook(inputStream);
    Sheet sheet = workbook.getSheetAt(0);
    
    // 2. Iterate rows (skip header)
    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
        Row row = sheet.getRow(i);
        
        // 3. Extract cell values
        String invoiceNumber = getCellValueAsString(row.getCell(0));
        String vendor = getCellValueAsString(row.getCell(1));
        LocalDate date = getCellValueAsDate(row.getCell(2));  // Supports MM/dd/yyyy, yyyy-MM-dd
        BigDecimal amount = getCellValueAsBigDecimal(row.getCell(3));  // Handles $1,234.56
        String description = getCellValueAsString(row.getCell(4));
        
        // 4. Create Invoice object
        invoices.add(new Invoice(invoiceNumber, vendor, date, amount, description));
    }
    
    return invoices;
}
```

#### 12. Process Invoices
**Class:** `GmailService.java` → `processInvoices()`

**What happens:**
```java
private void processInvoices(List<Invoice> invoices, String filename) {
    // 1. Log invoice details
    for (Invoice invoice : invoices) {
        LOG.info("Invoice: {} - {} - {} - {} - {}", 
            invoice.getInvoiceNumber(),
            invoice.getVendor(),
            invoice.getDate(),
            invoice.getTotalAmount(),
            invoice.getDescription());
    }
    
    // 2. TODO: Save to database
    // 3. TODO: Send to Python API for further processing
    // 4. TODO: Trigger downstream workflows
}
```

#### 13. Mark Email as Read
**Class:** `GmailService.java` → `markAsRead()`

**What happens:**
```java
private void markAsRead(String messageId) {
    // Remove UNREAD label from email
    gmail.users().messages().modify("me", messageId,
        new ModifyMessageRequest()
            .setRemoveLabelIds(List.of("UNREAD")))
        .execute();
}
```

### Key Classes and Their Roles

| Class | Purpose | Key Methods |
|-------|---------|-------------|
| `GmailPushSetup` | Initializes push notifications on startup | `setupPushNotifications()` |
| `GmailWebhookController` | Receives HTTP POST from Pub/Sub | `handlePushNotification()` |
| `GmailService` | Core Gmail integration logic | `setupPushNotifications()`, `handlePushNotification()`, `processMessage()` |
| `ExcelParser` | Parses Excel files into Invoice objects | `parseInvoices()`, `parseRow()` |
| `Invoice` | Data model for invoice records | Getters/Setters |
| `SecurityConfig` | Allows public access to webhook | `securityFilterChain()` |
| `OAuthController` | Generates OAuth refresh tokens | `handleCallback()` |

### Configuration Requirements

**`.env` file:**
```properties
email.username=your-gmail@gmail.com
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/auth/callback
GOOGLE_REFRESH_TOKEN=1//your-refresh-token
GOOGLE_PUB_SUB_TOPIC_NAME=projects/gmail-push-reader/topics/gmail-push-topic
GOOGLE_PUSH_ENDPOINT_URI=https://your-ngrok-url.ngrok-free.app/webhook/gmail/push
```

**Google Cloud Setup:**
1. Enable Gmail API
2. Create OAuth 2.0 credentials
3. Create Pub/Sub topic: `gmail-push-topic`
4. Grant `gmail-api-push@system.gserviceaccount.com` Publisher role
5. Create Pub/Sub subscription with Push delivery to webhook

**Excel Format Expected:**
- Column A: Invoice Number (String)
- Column B: Vendor (String)
- Column C: Date (MM/dd/yyyy or yyyy-MM-dd)
- Column D: Total Amount (Number or String like "$1,234.56")
- Column E: Description (String)

### Rate Limiting & Error Handling

**Rate Limiting:**
- Only one notification processed at a time
- Minimum 5-second interval between processing
- Prevents Gmail API 429 (rate limit exceeded) errors

**Error Handling:**
- All exceptions logged but don't crash the app
- Webhook always returns 200 OK to Pub/Sub
- Failed emails remain unread for retry

### Manual Trigger

**MCP Tool:** `EmailReaderTool`
- Allows manual triggering of email check
- Useful for testing or processing on-demand
- Calls `GmailService.handlePushNotification("manual-trigger")`

### Monitoring & Debugging

**Check if push notifications are working:**
```bash
# Test webhook endpoint
curl -X POST https://your-ngrok-url.ngrok-free.app/webhook/gmail/push \
  -H "Content-Type: application/json" \
  -d '{"message":{"messageId":"test"}}'
```

**Expected logs on email arrival:**
```
Received Gmail push notification
Processing push notification for historyId: ...
Processing Excel attachment: invoice.xlsx
Parsed 1 invoices from attachment: invoice.xlsx
Invoice: INV-001 - ABC Corp - 2024-01-15 - 1250.00 - Services
```

**Common Issues:**
- Watch registration expires after 7 days (needs renewal)
- ngrok URL changes require updating Pub/Sub subscription
- Rate limit errors if too many emails arrive simultaneously

### Security

- OAuth 2.0 authentication with refresh tokens
- Webhook endpoint publicly accessible (required for Pub/Sub)
- No authentication on webhook (Pub/Sub handles authorization)
- Credentials stored in `.env` (gitignored)
- CSRF disabled for webhook endpoint

### Performance

- **Latency:** < 2 seconds from email arrival to processing start
- **Throughput:** Processes up to 10 unread emails per notification
- **Rate Limit:** 5-second cooldown between processing cycles
- **Scalability:** Single-threaded processing (prevents race conditions)

---

For detailed setup instructions, see [GmailSetup.md](GmailSetup.md)

## Kafka Integration

### Overview

This application integrates with **Aiven Kafka** to consume invoice analysis responses from the Python API. The Kafka consumer automatically processes messages from the configured topic in real-time.

### Architecture Flow

```
[Python API] → [Kafka Topic: push-analysis-data-topic] → [Spring Boot Consumer]
                                                                    ↓
                                                          [InvoiceResponseListener]
                                                                    ↓
                                                            [Process & Log]
```

### Configuration

**1. Add Kafka credentials to `.env`:**
```properties
# Kafka Configuration (Aiven)
KAFKA_USERNAME=your-aiven-username
KAFKA_PASSWORD=your-aiven-password
```

**2. Place SSL certificate:**
- Download `ca.pem` from Aiven console
- Place in `src/main/resources/kafka/ca.pem`

**3. Configure topic in `application.properties`:**
```properties
spring.kafka.bootstrap-servers=your-kafka-server.aivencloud.com:10442
kafka.topic.invoice-response=push-analysis-data-topic
```

### Kafka Consumer

**Class:** `InvoiceResponseListener.java`

**Features:**
- Listens to `push-analysis-data-topic`
- Automatic JSON deserialization
- Error handling with detailed logging
- Kafka metadata tracking (topic, partition, offset)

**Example log output:**
```
📩 Received message from Kafka [topic=push-analysis-data-topic, partition=0, offset=123]
✅ Successfully processed invoice response: {invoice data}
```

### Kafka Configuration

**Class:** `KafkaConfig.java`

**Security:**
- SASL_SSL protocol
- SCRAM-SHA-256 authentication
- PEM certificate for SSL/TLS

**Performance:**
- Concurrency: 3 consumer threads
- Batch acknowledgment mode
- Max poll records: 100
- Producer acks: all (for reliability)

### Testing Kafka Integration

**1. Produce a test message:**
```bash
# Using Kafka CLI
kafka-console-producer --bootstrap-server your-server:10442 \
  --topic push-analysis-data-topic \
  --producer.config client.properties
```

**2. Send JSON message:**
```json
{"invoice": {"number": "INV-001", "amount": 1250.00}, "status": "processed"}
```

**3. Check application logs:**
```
📩 Received message from Kafka [topic=push-analysis-data-topic, partition=0, offset=1]
✅ Successfully processed invoice response: {invoice={number=INV-001, amount=1250.0}, status=processed}
```

### Docker Configuration

Kafka credentials are automatically passed to Docker container:

```yaml
environment:
  - KAFKA_USERNAME=${KAFKA_USERNAME}
  - KAFKA_PASSWORD=${KAFKA_PASSWORD}
```

### Troubleshooting

**Connection refused:**
- Check bootstrap server URL
- Verify firewall/network access
- Ensure Kafka cluster is running

**Authentication failed:**
- Verify KAFKA_USERNAME and KAFKA_PASSWORD in `.env`
- Check credentials in Aiven console
- Ensure SCRAM-SHA-256 is enabled

**SSL/TLS errors:**
- Verify `ca.pem` is in `src/main/resources/kafka/`
- Check certificate is not expired
- Ensure PEM format (not JKS)

**No messages received:**
- Check topic name matches configuration
- Verify consumer group ID
- Check offset reset policy (earliest/latest)
- Ensure messages are being produced to topic

### Monitoring

**Check consumer status:**
```bash
# View consumer groups
kafka-consumer-groups --bootstrap-server your-server:10442 \
  --command-config client.properties \
  --describe --group spring-local-consumer
```

**Application logs:**
```
Kafka Consumer configured with bootstrap servers: your-server:10442
Kafka SSL certificate loaded successfully from: /tmp/kafka-ca...pem
Kafka Listener Container Factory configured
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|----------|
| `KAFKA_USERNAME` | Aiven Kafka username | `avnadmin` |
| `KAFKA_PASSWORD` | Aiven Kafka password | `your-password` |
| `spring.kafka.bootstrap-servers` | Kafka broker URL | `kafka-xxx.aivencloud.com:10442` |
| `kafka.topic.invoice-response` | Topic to consume from | `push-analysis-data-topic` |

### Best Practices

✅ **Security:**
- Store credentials in `.env` (gitignored)
- Use SASL_SSL for encryption
- Rotate passwords regularly

✅ **Reliability:**
- Enable auto-commit for simplicity
- Use batch acknowledgment
- Configure retries for producers

✅ **Performance:**
- Tune concurrency based on load
- Adjust max poll records
- Monitor consumer lag

✅ **Monitoring:**
- Log all consumed messages
- Track processing errors
- Monitor consumer group lag
