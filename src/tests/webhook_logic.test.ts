import type { Request, Response } from 'express';

// Minimal unit test to verify logic from instantly.ts (Logic extraction for testing)
const InternalEventType = {
    SENT: 'email_sent',
    OPENED: 'email_opened',
    REPLIED: 'email_replied',
    BOUNCED: 'bounced',
    UNSUBSCRIBED: 'unsubscribed',
    UNKNOWN: 'unknown'
};

const EVENT_MAPPING: Record<string, string> = {
    'sent': InternalEventType.SENT,
    'email_sent': InternalEventType.SENT,
    'opened': InternalEventType.OPENED,
    'email_opened': InternalEventType.OPENED,
    'replied': InternalEventType.REPLIED,
    'email_replied': InternalEventType.REPLIED,
    'bounced': InternalEventType.BOUNCED,
    'unsubscribed': InternalEventType.UNSUBSCRIBED
};

function normalizeEvent(type: string): string {
    return EVENT_MAPPING[type] || InternalEventType.UNKNOWN;
}

function testNormalization() {
    console.log('Running Normalization Tests...');
    const tests = [
        { input: 'sent', expected: InternalEventType.SENT },
        { input: 'opened', expected: InternalEventType.OPENED },
        { input: 'replied', expected: InternalEventType.REPLIED },
        { input: 'email_sent', expected: InternalEventType.SENT },
        { input: 'random', expected: InternalEventType.UNKNOWN }
    ];

    tests.forEach(t => {
        const result = normalizeEvent(t.input);
        if (result === t.expected) {
            console.log(`✅ Success: ${t.input} -> ${t.expected}`);
        } else {
            console.error(`❌ Failure: ${t.input} -> Expected ${t.expected}, Got ${result}`);
            process.exit(1);
        }
    });
}

testNormalization();
