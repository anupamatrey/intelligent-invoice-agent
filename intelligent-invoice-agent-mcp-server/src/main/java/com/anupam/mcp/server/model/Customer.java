package com.anupam.mcp.server.model;

/**
 * Represents a customer entity used in streaming/demo data.
 *
 * <p>Contains basic customer attributes such as name, email, city, and balance.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
public class Customer {

    private String id;
    private String name;
    private String email;
    private String city;
    private double balance;

    /**
     * Creates an empty customer instance.
     */
    public Customer() {}

    /**
     * Creates a populated customer instance.
     *
     * @param id      unique identifier
     * @param name    full name
     * @param email   email address
     * @param city    city of residence
     * @param balance current account balance
     */
    public Customer(String id, String name, String email, String city, double balance) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.city = city;
        this.balance = balance;
    }

    // getters & setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public double getBalance() { return balance; }
    public void setBalance(double balance) { this.balance = balance; }
}

