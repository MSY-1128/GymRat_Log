package com.fitlog.foodsafety;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(FoodSafetyProperties.class)
class FoodSafetyConfig {
}
