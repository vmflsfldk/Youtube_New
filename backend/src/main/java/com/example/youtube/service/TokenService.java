package com.example.youtube.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TokenService {

    private final ObjectMapper objectMapper;
    private final byte[] secretKey;
    private final long tokenTtlSeconds;

    public TokenService(@Value("${app.auth.secret:change-me}") String secret,
                        @Value("${app.auth.token-ttl-seconds:86400}") long tokenTtlSeconds,
                        ObjectMapper objectMapper) {
        this.secretKey = secret.getBytes(StandardCharsets.UTF_8);
        this.tokenTtlSeconds = tokenTtlSeconds;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void validateSecret() {
        if (secretKey.length == 0) {
            throw new IllegalStateException("Token secret must not be empty");
        }
    }

    public String issueToken(String email, String displayName) {
        long expiresAt = Instant.now().getEpochSecond() + tokenTtlSeconds;
        String safeDisplayName = displayName == null ? "" : displayName;
        String payload = email + "|" + safeDisplayName + "|" + expiresAt;
        String signature = sign(payload);
        String encodedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encodedPayload + "." + signature;
    }

    public TokenPayload parseToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            return null;
        }
        String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        String expectedSignature = sign(payload);
        if (!MessageDigest.isEqual(expectedSignature.getBytes(StandardCharsets.UTF_8),
                parts[1].getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        String[] payloadParts = payload.split("\\|", 3);
        if (payloadParts.length != 3) {
            return null;
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(payloadParts[2]);
        } catch (NumberFormatException e) {
            return null;
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            return null;
        }
        String email = payloadParts[0];
        String displayName = payloadParts[1].isBlank() ? null : payloadParts[1];
        return new TokenPayload(email, displayName);
    }

    public TokenPayload parseGoogleIdToken(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            return null;
        }
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) {
            return null;
        }
        try {
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            Map<?, ?> payload = objectMapper.readValue(payloadJson, Map.class);
            Object email = payload.get("email");
            Object name = payload.get("name");
            if (email == null) {
                return null;
            }
            String displayName = name instanceof String ? (String) name : null;
            return new TokenPayload(email.toString(), displayName);
        } catch (Exception e) {
            return null;
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
            byte[] signatureBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signatureBytes);
        } catch (NoSuchAlgorithmException | java.security.InvalidKeyException e) {
            throw new IllegalStateException("Failed to sign token", e);
        }
    }

    public record TokenPayload(String email, String displayName) { }
}
