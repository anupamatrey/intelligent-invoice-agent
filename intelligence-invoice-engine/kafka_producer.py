import os
import json
import logging
import time
from datetime import datetime
from kafka import KafkaProducer
from kafka.errors import KafkaError, KafkaTimeoutError, NoBrokersAvailable
from dotenv import load_dotenv
from typing import Dict, Any, Optional
import threading

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class InvoiceKafkaProducer:
    """
    Production-ready Kafka producer for sending invoice processing results
    with comprehensive error handling, retries, and monitoring
    """
    
    def __init__(self):
        # Configuration from environment
        self.bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS')
        self.username = os.getenv('KAFKA_USERNAME')
        self.password = os.getenv('KAFKA_PASSWORD')
        self.topic = os.getenv('KAFKA_INVOICE_TOPIC')
        self.ssl_cafile = os.getenv('KAFKA_SSL_CAFILE', 'ca.pem')
        
        # Producer configuration
        self.producer = None
        self.is_connected = False
        self.connection_attempts = 0
        self.max_connection_attempts = 5
        self.retry_backoff_ms = 1000
        self.lock = threading.Lock()
        
        # Metrics
        self.messages_sent = 0
        self.messages_failed = 0
        
        # Validate configuration
        self._validate_config()
        
        # Create producer
        self._create_producer()
    
    def _validate_config(self):
        """Validate required configuration parameters"""
        required_configs = {
            'KAFKA_BOOTSTRAP_SERVERS': self.bootstrap_servers,
            'KAFKA_USERNAME': self.username,
            'KAFKA_PASSWORD': self.password,
            'KAFKA_INVOICE_TOPIC': self.topic
        }
        
        missing_configs = [key for key, value in required_configs.items() if not value]
        
        if missing_configs:
            error_msg = f"Missing required Kafka configuration: {', '.join(missing_configs)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info("Kafka configuration validated successfully")
    
    def _create_producer(self):
        """Create Kafka producer with comprehensive configuration and error handling"""
        try:
            producer_config = {
                'bootstrap_servers': self.bootstrap_servers,
                'sasl_mechanism': 'SCRAM-SHA-256',
                'sasl_plain_username': self.username,
                'sasl_plain_password': self.password,
                'security_protocol': 'SASL_SSL',
                'ssl_cafile': self.ssl_cafile,
                
                # Performance and reliability settings
                'request_timeout_ms': 30000,  # 30 seconds
                'delivery_timeout_ms': 120000,  # 2 minutes total
                'retries': 5,  # Retry failed sends
                'retry_backoff_ms': self.retry_backoff_ms,
                'max_in_flight_requests_per_connection': 1,  # Ensure ordering
                
                # Batching for performance
                'batch_size': 16384,  # 16KB
                'linger_ms': 10,  # Wait 10ms for batching
                'buffer_memory': 33554432,  # 32MB buffer
                
                # Compression
                'compression_type': 'gzip',
                
                # Serialization
                'value_serializer': lambda v: json.dumps(v, default=str).encode('utf-8'),
                'key_serializer': lambda k: k.encode('utf-8') if k else None,
                
                # Error handling
                'enable_idempotence': True,  # Prevent duplicates
                'acks': 'all',  # Wait for all replicas
            }
            
            self.producer = KafkaProducer(**producer_config)
            self.is_connected = True
            self.connection_attempts = 0
            logger.info("Kafka producer created successfully with enhanced configuration")
            
        except NoBrokersAvailable as e:
            logger.error(f"No Kafka brokers available: {str(e)}")
            self._handle_connection_failure()
        except Exception as e:
            logger.error(f"Failed to create Kafka producer: {str(e)}")
            self._handle_connection_failure()
    
    def _handle_connection_failure(self):
        """Handle connection failures with exponential backoff"""
        self.is_connected = False
        self.connection_attempts += 1
        
        if self.connection_attempts < self.max_connection_attempts:
            backoff_time = min(self.retry_backoff_ms * (2 ** self.connection_attempts) / 1000, 60)
            logger.warning(f"Connection attempt {self.connection_attempts} failed. Retrying in {backoff_time}s")
            time.sleep(backoff_time)
            self._create_producer()
        else:
            logger.error(f"Max connection attempts ({self.max_connection_attempts}) reached. Producer unavailable.")
    
    def _reconnect_if_needed(self):
        """Attempt to reconnect if producer is not available"""
        with self.lock:
            if not self.is_connected and self.connection_attempts < self.max_connection_attempts:
                logger.info("Attempting to reconnect Kafka producer...")
                self._create_producer()
    
    def send_invoice_result(self, invoice_result: Dict[str, Any], key: Optional[str] = None) -> bool:
        """
        Send invoice processing result to Kafka with comprehensive error handling
        
        Args:
            invoice_result: The invoice processing result to send
            key: Optional message key for partitioning
            
        Returns:
            bool: True if message sent successfully, False otherwise
        """
        if not self.is_connected:
            self._reconnect_if_needed()
            
        if not self.producer or not self.is_connected:
            logger.error("Kafka producer not available")
            self.messages_failed += 1
            return False
        
        try:
            # Prepare message with metadata
            message = {
                "timestamp": datetime.now().isoformat(),
                "message_id": f"{invoice_result.get('invoice', {}).get('invoice_number', 'unknown')}_{int(time.time())}",
                "source": "invoice-processing-agent",
                "version": "1.0",
                "invoice_data": invoice_result
            }
            
            # Use invoice number as key for consistent partitioning
            if not key:
                key = invoice_result.get('invoice', {}).get('invoice_number', 'default')
            
            # Send message asynchronously with callback
            future = self.producer.send(
                topic=self.topic,
                value=message,
                key=key
            )
            
            # Add callback for success/failure handling
            future.add_callback(self._on_send_success)
            future.add_errback(self._on_send_error)
            
            # Wait for send completion with timeout
            record_metadata = future.get(timeout=30)
            
            self.messages_sent += 1
            logger.info(
                f"Invoice result sent successfully - Topic: {record_metadata.topic}, "
                f"Partition: {record_metadata.partition}, Offset: {record_metadata.offset}"
            )
            return True
            
        except KafkaTimeoutError as e:
            logger.error(f"Kafka timeout error: {str(e)}")
            self.messages_failed += 1
            return False
            
        except KafkaError as e:
            logger.error(f"Kafka error: {str(e)}")
            self.messages_failed += 1
            self._handle_kafka_error(e)
            return False
            
        except Exception as e:
            logger.error(f"Unexpected error sending invoice result: {str(e)}")
            self.messages_failed += 1
            return False
    
    def _on_send_success(self, record_metadata):
        """Callback for successful message send"""
        logger.debug(f"Message sent successfully to {record_metadata.topic}:{record_metadata.partition}:{record_metadata.offset}")
    
    def _on_send_error(self, exception):
        """Callback for failed message send"""
        logger.error(f"Failed to send message: {str(exception)}")
        self.messages_failed += 1
    
    def _handle_kafka_error(self, error: KafkaError):
        """Handle specific Kafka errors"""
        if isinstance(error, NoBrokersAvailable):
            logger.error("No brokers available - attempting reconnection")
            self.is_connected = False
            self._reconnect_if_needed()
        else:
            logger.error(f"Kafka error: {type(error).__name__}: {str(error)}")
    
    def flush(self, timeout: int = 30) -> bool:
        """
        Flush any pending messages
        
        Args:
            timeout: Timeout in seconds
            
        Returns:
            bool: True if flush successful, False otherwise
        """
        if not self.producer:
            return False
            
        try:
            self.producer.flush(timeout=timeout)
            logger.info("Kafka producer flushed successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to flush Kafka producer: {str(e)}")
            return False
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get producer metrics"""
        return {
            "is_connected": self.is_connected,
            "messages_sent": self.messages_sent,
            "messages_failed": self.messages_failed,
            "connection_attempts": self.connection_attempts,
            "success_rate": (
                self.messages_sent / (self.messages_sent + self.messages_failed) * 100
                if (self.messages_sent + self.messages_failed) > 0 else 0
            )
        }
    
    def health_check(self) -> bool:
        """Perform health check on Kafka connection"""
        try:
            if not self.producer:
                return False
                
            # Try to get cluster metadata as health check
            metadata = self.producer.bootstrap_connected()
            return metadata and self.is_connected
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return False
    
    def close(self):
        """Close the Kafka producer gracefully"""
        if self.producer:
            try:
                # Flush any pending messages
                self.flush(timeout=10)
                
                # Close the producer
                self.producer.close(timeout=10)
                logger.info("Kafka producer closed gracefully")
                
            except Exception as e:
                logger.error(f"Error closing Kafka producer: {str(e)}")
            finally:
                self.producer = None
                self.is_connected = False
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()

# Global producer instance with lazy initialization
_kafka_producer_instance = None
_producer_lock = threading.Lock()

def get_kafka_producer() -> InvoiceKafkaProducer:
    """Get singleton Kafka producer instance"""
    global _kafka_producer_instance
    
    if _kafka_producer_instance is None:
        with _producer_lock:
            if _kafka_producer_instance is None:
                _kafka_producer_instance = InvoiceKafkaProducer()
    
    return _kafka_producer_instance

# For backward compatibility
kafka_producer = get_kafka_producer()