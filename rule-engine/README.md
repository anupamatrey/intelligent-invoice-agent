# Rule Engine - PostgreSQL & Redis Integration

## Setup Instructions

### 1. Environment Configuration
Update the `.env` file with your actual database and Redis credentials:

```env
# Database Configuration
DB_HOST=your_postgres_host
DB_PORT=5432
DB_NAME=your_database_name
DB_USERNAME=your_username
DB_PASSWORD=your_password

# Redis Configuration
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Application Configuration
CACHE_TTL=3600
```

### 2. Database Setup
Create the PostgreSQL database and run this table creation script:

```sql
CREATE TABLE vendor_service_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_code VARCHAR(50) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    pricing_type VARCHAR(20) DEFAULT 'FIXED',
    fixed_amount NUMERIC(12,2),
    min_amount NUMERIC(12,2),
    max_amount NUMERIC(12,2),
    currency VARCHAR(10) DEFAULT 'USD',
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (vendor_code, service_name)
);
```

### 3. Running the Application
```bash
./gradlew bootRun
```
Application runs on port **8082**

## API Endpoints

### Get Specific Vendor Rule (Cache-First)
```
GET /api/vendor-rules/{vendorCode}/{serviceName}
```

### Get All Rules for Vendor
```
GET /api/vendor-rules/{vendorCode}
```

### Create Vendor Rule
```
POST /api/vendor-rules
Content-Type: application/json

{
    "vendorCode": "VENDOR001",
    "serviceName": "Invoice Processing",
    "pricingType": "FIXED",
    "fixedAmount": 25.50,
    "currency": "USD",
    "isActive": true
}
```

### Delete Vendor Rule
```
DELETE /api/vendor-rules/{vendorCode}/{serviceName}
```

## Cache Strategy
- Cache key format: `vendor_rule:{vendorCode}:{serviceName}`
- Cache-first approach: Check Redis → Database → Cache result
- Automatic cache eviction on updates/deletes
- Configurable TTL via `CACHE_TTL` environment variable

## Features
- Composite unique key (vendor_code + service_name)
- Pricing rules with fixed/min/max amounts
- Effective date range support
- Active/inactive status filtering
- Comprehensive error handling and logging