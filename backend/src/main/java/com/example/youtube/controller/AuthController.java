package com.example.youtube.controller;

import com.example.youtube.dto.AuthTokenResponse;
import com.example.youtube.dto.GoogleLoginRequest;
import com.example.youtube.model.UserAccount;
import com.example.youtube.service.TokenService;
import com.example.youtube.service.UserService;
import jakarta.validation.Valid;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final TokenService tokenService;
    private final UserService userService;

    public AuthController(TokenService tokenService, UserService userService) {
        this.tokenService = tokenService;
        this.userService = userService;
    }

    @PostMapping("/google")
    public AuthTokenResponse loginWithGoogle(@Valid @RequestBody GoogleLoginRequest request) {
        TokenService.TokenPayload googlePayload = tokenService.parseGoogleIdToken(request.token());
        String email = firstNonBlank(request.email(), googlePayload == null ? null : googlePayload.email());
        if (!StringUtils.hasText(email)) {
            throw new IllegalArgumentException("Google 로그인에 이메일이 필요합니다.");
        }
        String displayName = firstNonBlank(request.displayName(),
                googlePayload == null ? null : googlePayload.displayName());
        UserAccount user = userService.getOrCreateUser(email, displayName);
        String token = tokenService.issueToken(user.getEmail(), user.getDisplayName());
        return new AuthTokenResponse(token, user.getEmail(), user.getDisplayName());
    }

    private String firstNonBlank(String first, String second) {
        if (StringUtils.hasText(first)) {
            return first;
        }
        return StringUtils.hasText(second) ? second : null;
    }
}
