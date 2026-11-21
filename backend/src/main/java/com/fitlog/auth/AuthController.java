package com.fitlog.auth;

import com.fitlog.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contextRepository;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final CookieCsrfTokenRepository csrfRepository;
    private final LoginAttemptService attempts;

    public AuthController(AuthService authService, AuthenticationManager authenticationManager,
                          SecurityContextRepository contextRepository, SessionAuthenticationStrategy sessionStrategy,
                          CookieCsrfTokenRepository csrfRepository, LoginAttemptService attempts) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.contextRepository = contextRepository;
        this.sessionStrategy = sessionStrategy;
        this.csrfRepository = csrfRepository;
        this.attempts = attempts;
    }

    /** XSRF-TOKEN 쿠키를 받기 위한 호출(필터가 쿠키를 내려준다). */
    @GetMapping("/csrf")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void csrf() {
    }

    @GetMapping("/me")
    public AuthRequests.UserResponse me(@AuthenticationPrincipal AuthUser user) {
        return AuthRequests.UserResponse.from(user);
    }

    /** 가입 후 바로 로그인 상태가 된다. */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthRequests.UserResponse signup(@Valid @RequestBody AuthRequests.SignupRequest request,
                                            HttpServletRequest req, HttpServletResponse res) {
        AuthUser user = authService.signup(request);
        startSession(UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities()), req, res);
        return AuthRequests.UserResponse.from(user);
    }

    @PostMapping("/login")
    public AuthRequests.UserResponse login(@Valid @RequestBody AuthRequests.LoginRequest request,
                                           HttpServletRequest req, HttpServletResponse res) {
        String username = request.username().strip();
        if (attempts.isLocked(username)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "로그인 실패가 반복되어 잠시 막았어요. 5분 뒤 다시 시도해 주세요.");
        }
        Authentication auth;
        try {
            auth = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(username, request.password()));
        } catch (AuthenticationException e) {
            attempts.failed(username);
            // 아이디가 없는지 비밀번호가 틀렸는지 구분하지 않는다
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                    "아이디 또는 비밀번호가 올바르지 않아요.");
        }
        attempts.succeeded(username);
        startSession(auth, req, res);
        return AuthRequests.UserResponse.from((AuthUser) auth.getPrincipal());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest req, HttpServletResponse res, Authentication auth) {
        new SecurityContextLogoutHandler().logout(req, res, auth);
        csrfRepository.saveToken(null, req, res);
    }

    private void startSession(Authentication auth, HttpServletRequest req, HttpServletResponse res) {
        sessionStrategy.onAuthentication(auth, req, res);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, req, res);
    }
}
