# WebSocket Integration for Rejected Invoices

## Overview
Real-time notifications for rejected invoices via WebSocket using STOMP protocol.

## Architecture

```
Invoice Processing → Rule Validation Failed → WebSocket Broadcast
                                                      ↓
                                              /topic/invoices/rejected
                                                      ↓
                                              Connected UI Clients
```

## Best Practices Implemented

✅ **Async Broadcasting** - Non-blocking with @Async  
✅ **Dedicated Thread Pool** - Separate executor for notifications  
✅ **Error Isolation** - Broadcast failures don't affect processing  
✅ **Structured DTO** - Clean separation of concerns  
✅ **STOMP Protocol** - Industry standard WebSocket messaging  
✅ **SockJS Fallback** - Works even without WebSocket support  

## WebSocket Endpoint

**Connection URL:** `ws://localhost:8080/ws`  
**Topic:** `/topic/invoices/rejected`

## Message Format

```json
{
  "invoice_number": "INV-001",
  "vendor": "ABC Corp",
  "vendor_code": "VEND001",
  "service": "DELIVERY",
  "date": "2024-01-15",
  "amount": 25.50,
  "description": "Delivery service",
  "rejection_reason": "Amount validation failed",
  "expected_amount": 50.00,
  "pricing_type": "FIXED",
  "source": "EMAIL",
  "filename": "invoices.xlsx",
  "timestamp": "2024-01-15T10:30:00"
}
```

## JavaScript Client (Vanilla)

```javascript
// Install: npm install sockjs-client stompjs

const SockJS = require('sockjs-client');
const Stomp = require('stompjs');

const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, function(frame) {
    console.log('Connected: ' + frame);
    
    stompClient.subscribe('/topic/invoices/rejected', function(message) {
        const rejectedInvoice = JSON.parse(message.body);
        console.log('Rejected Invoice:', rejectedInvoice);
        
        // Update UI
        displayRejectedInvoice(rejectedInvoice);
    });
});

function displayRejectedInvoice(invoice) {
    // Your UI update logic
    alert(`Invoice ${invoice.invoice_number} rejected: ${invoice.rejection_reason}`);
}
```

## React Client

```javascript
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useEffect, useState } from 'react';

function useRejectedInvoices() {
    const [rejectedInvoices, setRejectedInvoices] = useState([]);
    
    useEffect(() => {
        const socket = new SockJS('http://localhost:8080/ws');
        const stompClient = Stomp.over(socket);
        
        stompClient.connect({}, () => {
            stompClient.subscribe('/topic/invoices/rejected', (message) => {
                const invoice = JSON.parse(message.body);
                setRejectedInvoices(prev => [invoice, ...prev]);
            });
        });
        
        return () => {
            if (stompClient.connected) {
                stompClient.disconnect();
            }
        };
    }, []);
    
    return rejectedInvoices;
}

// Usage in component
function RejectedInvoicesDashboard() {
    const rejectedInvoices = useRejectedInvoices();
    
    return (
        <div>
            <h2>Rejected Invoices ({rejectedInvoices.length})</h2>
            {rejectedInvoices.map(invoice => (
                <div key={invoice.invoice_number} className="alert alert-danger">
                    <strong>{invoice.invoice_number}</strong> - {invoice.rejection_reason}
                    <br/>
                    Expected: ${invoice.expected_amount}, Actual: ${invoice.amount}
                </div>
            ))}
        </div>
    );
}
```

## Testing

### 1. Test WebSocket Connection
```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:8080/ws
```

### 2. Upload Invalid Invoice
```bash
curl -X POST http://localhost:8080/api/v1/invoice-agent/upload \
  -F "file=@invalid_invoice.xlsx"
```

### 3. Check Browser Console
Open browser console and you should see rejected invoice notification.

## Performance Optimization

**Thread Pool Configuration:**
- Core Pool Size: 2 threads
- Max Pool Size: 5 threads
- Queue Capacity: 100 messages

**Async Processing:**
- Broadcast happens in separate thread
- Invoice processing not blocked
- Failures logged but don't crash app

**Memory Management:**
- No message persistence (stateless)
- Clients receive only live messages
- No replay of historical rejections

## Monitoring

**Check active WebSocket connections:**
```java
// Add to WebSocketConfig
@Override
public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
    registration.setMessageSizeLimit(128 * 1024);
    registration.setSendBufferSizeLimit(512 * 1024);
    registration.setSendTimeLimit(20000);
}
```

**Logs to monitor:**
```
📡 Broadcasted rejected invoice: INV-001 to WebSocket clients
❌ Failed to broadcast rejected invoice: INV-002
```

## Security Considerations

⚠️ **Current Setup:** No authentication (development only)

**Production Recommendations:**
1. Add Spring Security WebSocket authentication
2. Use JWT tokens for connection
3. Implement user-specific topics
4. Add rate limiting
5. Enable HTTPS/WSS

## Dependencies Required

Add to `build.gradle`:
```gradle
implementation 'org.springframework.boot:spring-boot-starter-websocket'
```

Or `pom.xml`:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

## CORS Configuration

Already configured in `WebSocketConfig`:
- Allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`
- Update for production domains

## Troubleshooting

**Connection refused:**
- Check if Spring Boot app is running
- Verify port 8080 is accessible
- Check firewall settings

**No messages received:**
- Verify subscription to correct topic
- Check invoice is actually rejected
- Review server logs for broadcast errors

**High latency:**
- Increase thread pool size
- Check network bandwidth
- Monitor message queue capacity
