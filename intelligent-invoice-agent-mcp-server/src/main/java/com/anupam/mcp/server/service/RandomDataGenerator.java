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

/**
 * Generates random customer records and streams them to subscribers.
 *
 * <p>Emits JSON-serialized {@link com.anupam.mcp.server.model.Customer} objects at
 * fixed intervals via a Reactor {@link reactor.core.publisher.Sinks.Many}.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Service
public class RandomDataGenerator {
    private static final Logger LOG = LoggerFactory.getLogger(RandomDataGenerator.class);

    private final Sinks.Many<String> sink =
            Sinks.many().multicast().onBackpressureBuffer();

    private final ObjectMapper mapper = new ObjectMapper();

    private final List<String> names = List.of("Anupam", "Ravi", "Kriti", "Neha", "Aman");
    private final List<String> cities = List.of("New York", "Delhi", "Toronto", "London", "Sydney");

    /**
     * Initializes the generator and starts periodic emission every 10 seconds.
     */
    public RandomDataGenerator() {
        LOG.info("RandomDataGenerator initialized - data generation DISABLED");
        // Generate initial data immediately
        // generate();
        // 🔥 Generate data every 10 seconds
        // Flux.interval(Duration.ofSeconds(10))
        //         .subscribe(tick -> {
        //             LOG.info("Generating random data - tick: {}", tick);
        //             generate();
        //         });
    }

    /**
     * Generates a single random customer and emits it to the sink.
     */
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

    /**
     * Picks a random name.
     */
    private String randomName() {
        return names.get((int) (Math.random() * names.size()));
    }

    /**
     * Picks a random city.
     */
    private String randomCity() {
        return cities.get((int) (Math.random() * cities.size()));
    }

    /**
     * Generates a random email.
     */
    private String randomEmail() {
        return "user" + ((int) (Math.random() * 1000)) + "@example.com";
    }

    /**
     * Returns a stream of JSON-encoded customer records.
     *
     * @return hot flux emitting customer JSON strings
     */
    public Flux<String> stream() {
        return sink.asFlux();
    }
}
