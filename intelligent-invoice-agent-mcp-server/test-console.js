// PASTE THIS IN YOUR BROWSER CONSOLE TO TEST

const SockJS = window.SockJS || require('sockjs-client');
const Stomp = window.Stomp || require('stompjs');

const socket = new SockJS('http://localhost:8081/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, function(frame) {
    console.log('✅ Connected:', frame);
    
    // Subscribe to rejected invoices
    stompClient.subscribe('/topic/invoices/rejected', function(message) {
        console.log('🚫 Rejected Invoice:', JSON.parse(message.body));
    });
    
    console.log('📡 Subscribed to /topic/invoices/rejected');
}, function(error) {
    console.error('❌ Connection error:', error);
});

// To test, run this after connecting:
// fetch('http://localhost:8081/api/v1/test/broadcast-rejected', {method: 'POST'})
