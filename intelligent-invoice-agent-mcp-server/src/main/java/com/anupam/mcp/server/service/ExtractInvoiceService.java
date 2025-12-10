package com.anupam.mcp.server.service;

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

@Service
public class ExtractInvoiceService {
    private static final Logger LOG = LoggerFactory.getLogger(ExtractInvoiceService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${python.api.url:http://localhost:8000/process-invoice}")
    private String pythonApiUrl;

    public String extractInvoiceData(MultipartFile file) {
        try {
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
            LOG.info("Received response from Python API: {}", response);
            return response;
        } catch (Exception e) {
            LOG.error("Error calling Python API", e);
            return "{\"error\": \"Failed to extract invoice data\"}";
        }
    }
}
