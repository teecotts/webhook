import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/instantly'; // Update if running locally or deployed
const WEBHOOK_SECRET = process.env.INSTANTLY_WEBHOOK_SECRET || 'test_secret';

const samplePayloads = [
    {
        name: 'Email Sent',
        payload: {
            event_type: 'email_sent',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            campaign_id: 'campaign_123',
            id: 'evt_sent_1'
        }
    },
    {
        name: 'Email Opened',
        payload: {
            event_type: 'opened',
            email: 'test@example.com',
            campaign_id: 'campaign_123',
            id: 'evt_open_1'
        }
    },
    {
        name: 'Email Replied',
        payload: {
            event_type: 'replied',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            campaign_id: 'campaign_123',
            id: 'evt_reply_1',
            message: 'I am interested in more details!'
        }
    },
    {
        name: 'Email Bounced',
        payload: {
            event_type: 'bounced',
            email: 'bounced@example.com',
            id: 'evt_bounce_1'
        }
    }
];

async function runTests() {
    console.log('Starting Instantly Webhook Integration Tests...');
    const runId = Date.now();

    const testPayloads = samplePayloads.map(item => ({
        ...item,
        payload: {
            ...item.payload,
            id: `${item.payload.id}_${runId}`
        }
    }));

    for (const item of testPayloads) {
        console.log(`\n--- Testing: ${item.name} ---`);
        try {
            const response = await axios.post(WEBHOOK_URL, item.payload, {
                headers: {
                    'x-instantly-signature': WEBHOOK_SECRET,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Status:', response.status);
            console.log('Response:', response.data);
        } catch (error: any) {
            console.error('Error:', error.response?.data || error.message);
        }
    }

    // Idempotency Test
    console.log('\n--- Testing: Idempotency (Repeat Sent Event) ---');
    try {
        // Reuse the first payload from THIS run
        const response = await axios.post(WEBHOOK_URL, testPayloads[0].payload, {
            headers: {
                'x-instantly-signature': WEBHOOK_SECRET,
                'Content-Type': 'application/json'
            }
        });
        console.log('Status:', response.status);
        console.log('Response:', response.data);
    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

runTests();
