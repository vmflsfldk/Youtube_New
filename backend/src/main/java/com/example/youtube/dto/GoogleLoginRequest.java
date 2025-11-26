package com.example.youtube.dto;

import jakarta.validation.constraints.NotBlank;

public record GoogleLoginRequest(
        @NotBlank String token,
        String email,
        String displayName) {
}
