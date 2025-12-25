package com.anupam.mcp.server.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles OAuth callback flow to exchange authorization code for tokens.
 * <p>
 * Exchanges the authorization code for access and refresh tokens using Google's OAuth2 token endpoint.
 * </p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@RestController
@RequestMapping("/auth")
public class OAuthController {

    @Value("${google.client.id}")
    private String clientId;

    @Value("${google.client.secret}")
    private String clientSecret;

    @Value("${google.redirect.uri}")
    private String redirectUri;

    /**
     * Handles the OAuth redirect callback and exchanges the code for tokens.
     *
     * @param code the authorization code received from Google
     * @return a response containing access/refresh tokens or an error message
     */
    @GetMapping("/callback")
    public ResponseEntity<Map<String, String>> handleCallback(@RequestParam("code") String code) {
        RestTemplate restTemplate = new RestTemplate();
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        MultiValueMap<String, String> requestBody = new LinkedMultiValueMap<>();
        requestBody.add("code", code);
        requestBody.add("client_id", clientId);
        requestBody.add("client_secret", clientSecret);
        requestBody.add("redirect_uri", redirectUri);
        requestBody.add("grant_type", "authorization_code");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                "https://oauth2.googleapis.com/token",
                HttpMethod.POST,
                request,
                Map.class
            );

            Map<String, Object> body = response.getBody();
            Map<String, String> result = new HashMap<>();
            result.put("refresh_token", (String) body.get("refresh_token"));
            result.put("access_token", (String) body.get("access_token"));
            result.put("message", "Copy the refresh_token above to your .env file as GOOGLE_REFRESH_TOKEN");
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("instruction", "Make sure your app is running and ngrok URL matches the redirect URI");
            return ResponseEntity.badRequest().body(error);
        }
    }
}
