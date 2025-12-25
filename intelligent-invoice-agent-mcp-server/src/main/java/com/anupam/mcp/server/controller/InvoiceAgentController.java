package com.anupam.mcp.server.controller;


import com.anupam.mcp.server.service.ExtractInvoiceService;
import com.anupam.mcp.server.service.RandomDataGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

/**
 * REST API controller for invoice-related operations and streaming demo data.
 *
 * <p>Provides endpoints to test connectivity, stream random customer data via SSE,
 * and upload invoices for processing.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
public class InvoiceAgentController {
    private static final Logger LOG = LoggerFactory.getLogger(InvoiceAgentController.class);

    private final ExtractInvoiceService extractInvoiceService;
    private final RandomDataGenerator randomDataGenerator;
    private final ObjectMapper objectMapper;

    /**
     * Creates a new controller instance.
     *
     * @param extractInvoiceService service that delegates invoice extraction to Python API
     * @param randomDataGenerator   generator for streaming demo customer data
     * @param objectMapper          JSON mapper
     */
    public InvoiceAgentController(ExtractInvoiceService extractInvoiceService, RandomDataGenerator randomDataGenerator, ObjectMapper objectMapper) {
        this.extractInvoiceService = extractInvoiceService;
        this.randomDataGenerator = randomDataGenerator;
        this.objectMapper = objectMapper;
    }

    /**
     * Liveness probe endpoint.
     *
     * @return basic status information
     */
    @GetMapping("/test")
    public Map<String, Object> test() {
        LOG.info("Test endpoint called");
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Invoice Agent API is running");
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }

    /**
     * Streams random customer data using Server-Sent Events (SSE).
     *
     * @return a Flux of SSE events containing JSON strings
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"}, allowedHeaders = "*")
    public Flux<ServerSentEvent<String>> streamData() {
        LOG.info("SSE stream endpoint called - using RandomDataGenerator");
        return randomDataGenerator.stream()
                .doOnNext(data -> LOG.info("Streaming data to client: {}", data))
                .map(customerJson -> ServerSentEvent.<String>builder()
                        .data(customerJson)
                        .build())
                .doOnSubscribe(subscription -> LOG.info("Client subscribed to stream"))
                .doOnCancel(() -> LOG.info("Client cancelled stream subscription"));
    }

    /**
     * Uploads an invoice file and forwards it to the Python extractor service.
     *
     * @param file the invoice Excel file to process
     * @return a structured map suitable for JSON serialization
     */
    @PostMapping("/invoice-agent/upload")
    public Map<String, Object> processInvoice(@RequestParam("file") MultipartFile file) {
        LOG.info("Processing invoice XLSX: {}", file.getOriginalFilename());
        String response = extractInvoiceService.extractInvoiceData(file);
        LOG.info("Python API Response: {}", response);
        try {
            Map<String, Object> result = objectMapper.readValue(response, Map.class);
            Map<String, Object> serializableResult = createSerializableResult(result);
            LOG.info("Structured Response: {}", objectMapper.writeValueAsString(serializableResult));
            return serializableResult;
        } catch (Exception e) {
            LOG.error("Error parsing response", e);
            Map<String, Object> errorResult = createSerializableResult(new HashMap<>());
            LOG.info("Error Response: {}", errorResult);
            return errorResult;
        }
    }
    
    /**
     * Normalizes the raw extractor response into a predictable, serializable structure.
     *
     * @param result raw result map
     * @return normalized result map
     */
    private Map<String, Object> createSerializableResult(Map<String, Object> result) {
        Map<String, Object> serializableResult = new HashMap<>();
        serializableResult.put("invoice", result.getOrDefault("invoice", new HashMap<>()));
        serializableResult.put("validation", result.getOrDefault("validation", new HashMap<>()));
        serializableResult.put("persisted_chunks", result.getOrDefault("persisted_chunks", 0));
        serializableResult.put("vector_doc_id", result.getOrDefault("vector_doc_id", ""));
        serializableResult.put("similar_invoices", result.getOrDefault("similar_invoices", List.of()));
        serializableResult.put("is_duplicate", result.getOrDefault("is_duplicate", false));
        serializableResult.put("duplicate_details", result.get("duplicate_details"));
        serializableResult.put("synthesis", result.getOrDefault("synthesis", ""));
        return serializableResult;
    }
}
