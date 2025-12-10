package com.anupam.mcp.server.controller;


import com.anupam.mcp.server.service.ExtractInvoiceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class InvoiceAgentController {
    private static final Logger LOG = LoggerFactory.getLogger(InvoiceAgentController.class);

    private final ExtractInvoiceService extractInvoiceService;
    private final ObjectMapper objectMapper;

    public InvoiceAgentController(ExtractInvoiceService extractInvoiceService, ObjectMapper objectMapper) {
        this.extractInvoiceService = extractInvoiceService;
        this.objectMapper = objectMapper;
    }

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
