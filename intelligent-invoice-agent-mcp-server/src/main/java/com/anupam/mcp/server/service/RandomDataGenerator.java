package com.anupam.mcp.server.service;

import com.anupam.mcp.server.model.Customer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
public class RandomDataGenerator {
    private static final Logger LOG = LoggerFactory.getLogger(RandomDataGenerator.class);

    private final Sinks.Many<String> sink =
            Sinks.many().multicast().onBackpressureBuffer();

    private final ObjectMapper mapper = new ObjectMapper();

    private final List<String> names = List.of("Anupam", "Ravi", "Kriti", "Neha", "Aman");
    private final List<String> cities = List.of("New York", "Delhi", "Toronto", "London", "Sydney");

    public RandomDataGenerator() {
        LOG.info("RandomDataGenerator initialized - starting data generation every 10 seconds");
        // Generate initial data immediately
        generate();
        // 🔥 Generate data every 10 seconds
        Flux.interval(Duration.ofSeconds(10))
                .subscribe(tick -> {
                    LOG.info("Generating random data - tick: {}", tick);
                    generate();
                });
    }

    private void generate() {
        Customer c = new Customer(
                UUID.randomUUID().toString(),
                randomName(),
                randomEmail(),
                randomCity(),
                Math.round((Math.random() * 5000) * 100.0) / 100.0
        );

        try {
            String json = mapper.writeValueAsString(c);
            LOG.info("Generated customer data: {}", json);
            Sinks.EmitResult result = sink.tryEmitNext(json);
            LOG.info("Emit result: {}", result);
        } catch (Exception e) {
            LOG.error("Error generating customer data", e);
        }
    }

    private String randomName() {
        return names.get((int) (Math.random() * names.size()));
    }

    private String randomCity() {
        return cities.get((int) (Math.random() * cities.size()));
    }

    private String randomEmail() {
        return "user" + ((int) (Math.random() * 1000)) + "@example.com";
    }

    public Flux<String> stream() {
        return sink.asFlux();
    }
}
