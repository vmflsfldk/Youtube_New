package com.example.youtube.config;

import com.example.youtube.model.UserAccount;
import com.example.youtube.service.TokenService;
import com.example.youtube.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class UserRequestInterceptor implements HandlerInterceptor {

    public static final String CURRENT_USER_ATTR = "currentUser";

    private final UserService userService;
    private final TokenService tokenService;

    public UserRequestInterceptor(UserService userService, TokenService tokenService) {
        this.userService = userService;
        this.tokenService = tokenService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String email = null;
        String displayName = null;

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            TokenService.TokenPayload payload = tokenService.parseToken(token);
            if (payload != null) {
                email = payload.email();
                displayName = payload.displayName();
            }
        }

        if (email == null || email.isBlank()) {
            email = request.getHeader("X-User-Email");
        }
        if (displayName == null || displayName.isBlank()) {
            displayName = request.getHeader("X-User-Name");
        }
        if (email == null || email.isBlank()) {
            email = "guest@example.com";
        }
        if (displayName != null && displayName.isBlank()) {
            displayName = null;
        }
        UserAccount user = userService.getOrCreateUser(email, displayName);
        request.setAttribute(CURRENT_USER_ATTR, user);
        return true;
    }
}
