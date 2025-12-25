package com.anupam.mcp.server.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

/**
 * Service for delegating invoice data extraction to an external Python API with Resilience4j.
 * <p>
 * Sends a multipart/form-data POST request containing the uploaded invoice file and
 * returns the raw response from the Python service. Includes retry logic, circuit breaker,
 * and fallback mechanisms for reliability.
 * </p>
 *
 * @author Anupam Sharma
 * @version 2.0
 * @since 1.0
 */
@Service
public class ExtractInvoiceService {
    private static final Logger LOG = LoggerFactory.getLogger(ExtractInvoiceService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${python.api.url:http://localhost:8000/process-invoice}")
    private String pythonApiUrl;

    @Value("${python.api.process-invoice-data-url:http://localhost:8000/process-invoice-data}")
    private String pythonProcessInvoiceDataUrl;

    /**
     * Calls the configured Python API with the provided invoice file for extraction.
     * <p>
     * Resilience4j Configuration:
     * - Retry: 3 attempts with exponential backoff (1s, 1.5s, 2.25s)
     * - Circuit Breaker: Opens after 50% failure rate
     * - Fallback: Returns structured error response
     * </p>
     *
     * @param file the uploaded invoice file to process
     * @return the response payload from the Python API as a JSON string; on error, fallback response
     */
    @Retry(name = "externalApi", fallbackMethod = "extractInvoiceFallback")
    @CircuitBreaker(name = "externalApi", fallbackMethod = "extractInvoiceFallback")
    public String extractInvoiceData(MultipartFile file) {
        try {
            LOG.info("🚀 Calling Python API: {}", pythonApiUrl);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            String response = restTemplate.postForObject(pythonApiUrl, requestEntity, String.class);
            LOG.info("✅ Received response from Python API");
            return response;
        } catch (Exception e) {
            LOG.error("❌ Error calling Python API: {}", e.getMessage());
            throw new RuntimeException("Python API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Fallback method when Python API call fails after all retries.
     *
     * @param file the original file
     * @param throwable the exception
     * @return JSON error response
     */
    public String extractInvoiceFallback(MultipartFile file, Throwable throwable) {
        LOG.error("❌ Python API call failed after retries. Returning fallback response.", throwable);
        
        Map<String, Object> fallbackResult = new HashMap<>();
        fallbackResult.put("invoice", new HashMap<>());
        fallbackResult.put("validation", Map.of("is_valid", false, "error", "API unavailable"));
        fallbackResult.put("persisted_chunks", 0);
        fallbackResult.put("vector_doc_id", "");
        fallbackResult.put("similar_invoices", new java.util.ArrayList<>());
        fallbackResult.put("is_duplicate", false);
        fallbackResult.put("duplicate_details", null);
        fallbackResult.put("synthesis", "❌ Failed to process invoice: " + throwable.getMessage());
        
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(fallbackResult);
        } catch (Exception e) {
            return "{\"error\": \"Failed to process invoice\"}";
        }
    }

    /**
     * Sends Invoice object to Python API for processing.
     *
     * @param invoice the invoice object to process
     * @return the response payload from the Python API as a JSON string; on error, fallback response
     */
    @Retry(name = "externalApi", fallbackMethod = "processInvoiceDataFallback")
    @CircuitBreaker(name = "externalApi", fallbackMethod = "processInvoiceDataFallback")
    public String processInvoiceData(Object invoice) {
        try {
            LOG.info("🚀 Calling Python API: {}", pythonProcessInvoiceDataUrl);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Object> requestEntity = new HttpEntity<>(invoice, headers);
            String response = restTemplate.postForObject(pythonProcessInvoiceDataUrl, requestEntity, String.class);
            LOG.info("✅ Received response from Python API");
            return response;
        } catch (Exception e) {
            LOG.error("❌ Error calling Python API /process-invoice-data: {}", e.getMessage());
            throw new RuntimeException("Python API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Fallback method for processInvoiceData.
     *
     * @param invoice the original invoice
     * @param throwable the exception
     * @return JSON error response
     */
    public String processInvoiceDataFallback(Object invoice, Throwable throwable) {
        LOG.error("❌ Python API /process-invoice-data failed after retries.", throwable);
        return "{\"error\": \"Failed to process invoice data\", \"message\": \"" + throwable.getMessage() + "\"}";
    }
}
