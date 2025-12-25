# Resilience4j Implementation Guide

## Overview

This project now uses **Resilience4j** for fault tolerance and resilience patterns including:
- **Retry** - Automatic retry with exponential backoff
- **Circuit Breaker** - Prevents cascading failures
- **Fallback** - Graceful degradation when all retries fail

## Architecture

```
Kafka → InvoiceResponseListener → WebSocketBroadcastService (Resilience4j) → WebSocket Clients
                                            ↓ (on failure)
                                        Fallback Method
                                            ↓
                                    Error Notification Topic
```

## Configuration

### Retry Configuration (`application-resilience.properties`)

**WebSocket Broadcast:**
- Max Attempts: 3
- Wait Duration: 2s, 4s, 8s (exponential backoff with multiplier 2)
- Retry on: All exceptions

**External API:**
- Max Attempts: 3
- Wait Duration: 1s, 1.5s, 2.25s (exponential backoff with multiplier 1.5)
- Retry on: IOException, ResourceAccessException

### Circuit Breaker Configuration

**WebSocket Broadcast:**
- Failure Rate Threshold: 50%
- Slow Call Threshold: 3 seconds
- Wait in Open State: 10 seconds
- Sliding Window: 10 calls
- Minimum Calls: 5

**External API:**
- Failure Rate Threshold: 50%
- Wait in Open State: 30 seconds
- Sliding Window: 10 calls
- Minimum Calls: 5

## How It Works

### 1. Normal Flow (Success)
```
Message → broadcastInvoiceUpdate() → WebSocket → Clients
```

### 2. Transient Failure (Retry)
```
Message → broadcastInvoiceUpdate() → FAIL
       → Wait 2s → Retry 1 → FAIL
       → Wait 4s → Retry 2 → SUCCESS → Clients
```

### 3. Persistent Failure (Fallback)
```
Message → broadcastInvoiceUpdate() → FAIL
       → Retry 1 → FAIL
       → Retry 2 → FAIL
       → broadcastFallback() → Error Notification → /topic/invoice-errors
```

### 4. Circuit Breaker Open
```
Message → Circuit Breaker (OPEN) → Immediate Fallback → Error Notification
```

## Fallback Behavior

When all retries fail, the fallback method:
1. Logs the error with full stack trace
2. Creates error notification with:
   - Status: "error"
   - Error message
   - Timestamp
   - Original message
3. Sends to `/topic/invoice-errors`
4. Clients receive error notification in real-time

## Client Integration

### Subscribe to Both Topics

```javascript
// Success messages
stompClient.subscribe('/topic/invoice-updates', (message) => {
    const data = JSON.parse(message.body);
    // Handle success
});

// Error notifications
stompClient.subscribe('/topic/invoice-errors', (message) => {
    const error = JSON.parse(message.body);
    // Handle error: show notification, retry, etc.
});
```

### Error Response Format

```json
{
  "status": "error",
  "message": "Failed to deliver invoice update",
  "error": "Connection timeout",
  "timestamp": 1703520000000,
  "originalMessage": "{...}"
}
```

## Benefits

✅ **Automatic Retry** - Handles transient failures without manual intervention
✅ **Circuit Breaker** - Prevents system overload during outages
✅ **Fallback** - Ensures clients are notified even when delivery fails
✅ **Exponential Backoff** - Reduces load during recovery
✅ **Monitoring** - Comprehensive logging at each step
✅ **Graceful Degradation** - System continues operating despite failures

## Monitoring

### Logs to Watch

**Success:**
```
📡 Broadcasting invoice update to WebSocket clients
✅ Successfully broadcast message to /topic/invoice-updates
```

**Retry:**
```
📡 Broadcasting invoice update to WebSocket clients
❌ Failed to broadcast message
📡 Broadcasting invoice update to WebSocket clients (Retry 1)
✅ Successfully broadcast message to /topic/invoice-updates
```

**Fallback:**
```
❌ WebSocket broadcast failed after retries. Sending error notification.
⚠️ Error notification sent to /topic/invoice-errors
```

**Circuit Breaker:**
```
Circuit breaker 'websocketBroadcast' changed state from CLOSED to OPEN
```

## Testing

### Test Retry
Temporarily stop WebSocket clients, send message, restart clients - message should be retried.

### Test Fallback
Simulate persistent failure - error notification should appear on `/topic/invoice-errors`.

### Test Circuit Breaker
Send multiple failing messages - circuit should open and subsequent calls should fail fast.

## Best Practices

1. **Monitor Circuit Breaker State** - Alert when circuit opens
2. **Track Retry Metrics** - Monitor retry success/failure rates
3. **Handle Error Notifications** - Show user-friendly messages in UI
4. **Adjust Thresholds** - Tune based on production metrics
5. **Log Everything** - Comprehensive logging for debugging

## Comparison: Spring Retry vs Resilience4j

| Feature | Spring Retry | Resilience4j |
|---------|-------------|--------------|
| Retry | ✅ | ✅ |
| Circuit Breaker | ❌ | ✅ |
| Fallback | Limited | ✅ Full Support |
| Metrics | Basic | Advanced |
| Configuration | Annotations | Properties + Annotations |
| Monitoring | Limited | Actuator Integration |

## Next Steps

1. Enable Resilience4j Actuator endpoints for monitoring
2. Add custom metrics for business KPIs
3. Integrate with monitoring tools (Prometheus, Grafana)
4. Implement rate limiting if needed
5. Add bulkhead pattern for resource isolation

---

**Version:** 2.0
**Last Updated:** 2024-12-25
