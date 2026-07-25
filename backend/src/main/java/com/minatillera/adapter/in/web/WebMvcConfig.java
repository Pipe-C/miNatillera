package com.minatillera.adapter.in.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final InviteCodeInterceptor inviteCodeInterceptor;

    public WebMvcConfig(InviteCodeInterceptor inviteCodeInterceptor) {
        this.inviteCodeInterceptor = inviteCodeInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(inviteCodeInterceptor)
                .addPathPatterns("/v1/**")
                .excludePathPatterns(
                        "/v1/health",
                        "/v1/groups",  // POST /v1/groups doesn't need invite code
                        "/v1/groups/*/managers/accept",  // Accept invite — no prior auth needed
                        "/v1/groups/*/managers/verify",  // Verify uses X-Manager-Token
                        "/v1/uploads/**"  // Upload uses X-Manager-Token, not invite code
                );
    }
}
