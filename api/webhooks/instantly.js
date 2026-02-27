import crypto from 'crypto';
import { checkIdempotency, logInstantlyEvent, markEventProcessed, logToDeadLetters } from '../../src/lib/supabase.js';
import { upsertGhlContact, upsertGhlOpportunity, moveOpportunityStage, upsertConversationOnReply, ghlClient // Debug
 } from '../../src/lib/ghl.js';
// Types for normalization
var InternalEventType;
(function (InternalEventType) {
    InternalEventType["SENT"] = "email_sent";
    InternalEventType["OPENED"] = "email_opened";
    InternalEventType["REPLIED"] = "email_replied";
    InternalEventType["BOUNCED"] = "bounced";
    InternalEventType["UNSUBSCRIBED"] = "unsubscribed";
    InternalEventType["UNKNOWN"] = "unknown";
})(InternalEventType || (InternalEventType = {}));
const EVENT_MAPPING = {
    'sent': InternalEventType.SENT,
    'email_sent': InternalEventType.SENT,
    'opened': InternalEventType.OPENED,
    'email_opened': InternalEventType.OPENED,
    'replied': InternalEventType.REPLIED,
    'email_replied': InternalEventType.REPLIED,
    'bounced': InternalEventType.BOUNCED,
    'unsubscribed': InternalEventType.UNSUBSCRIBED
};
// Basic in-memory rate limiting (best-effort for serverless)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
function checkRateLimit(ip) {
    const now = Date.now();
    const limit = rateLimitMap.get(ip);
    if (!limit || now > limit.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }
    if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }
    limit.count++;
    return true;
}
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    // 0. Rate Limiting
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too Many Requests' });
    }
    // 1. Basic Security
    const payload = req.body;
    const signature = req.headers['x-instantly-signature'] || req.headers['authorization'];
    const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;
    if (webhookSecret && signature !== webhookSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // 2. Parse & Validate
    const { event_type, email, campaign_id, id: provider_id } = payload;
    if (!event_type || !email) {
        return res.status(400).json({ error: 'Missing required fields: event_type, email' });
    }
    // Ensure environment is ready
    const locationId = process.env.GHL_LOCATION_ID;
    if (!locationId || !process.env.GHL_API_KEY) {
        console.error('Missing critical environment variables: GHL_LOCATION_ID or GHL_API_KEY');
        return res.status(500).json({ error: 'Server Configuration Error' });
    }
    const internalEvent = EVENT_MAPPING[event_type] || InternalEventType.UNKNOWN;
    const providerEventId = provider_id || crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    try {
        // 3. Idempotency Check
        const existing = await checkIdempotency(providerEventId);
        if (existing && existing.processed_at) {
            return res.status(200).json({ ok: true, message: 'Already processed' });
        }
        // 4. Log to Supabase (Initial)
        let dbEventId = existing?.id;
        if (!dbEventId) {
            const dbEvent = await logInstantlyEvent({
                provider: 'instantly',
                provider_event_id: providerEventId,
                event_type: internalEvent,
                email: email,
                campaign_id: campaign_id,
                payload: payload
            });
            dbEventId = dbEvent.id;
        }
        // 5. Fast path for "opened" (Minimal latency)
        if (internalEvent === InternalEventType.OPENED) {
            await markEventProcessed(dbEventId);
            return res.status(200).json({ ok: true, message: 'Logged' });
        }
        // 6. GHL Integration logic
        const locationId = process.env.GHL_LOCATION_ID || '';
        const pipelineId = process.env.GHL_PARTNER_PIPELINE_ID || '';
        // Upsert Contact
        const contactId = await upsertGhlContact({
            locationId,
            email,
            firstName: payload.first_name,
            lastName: payload.last_name,
            customFields: {
                'instantly_campaign_id': campaign_id,
                'last_event_type': internalEvent,
                'last_event_date': new Date().toISOString(),
                'source_channel': 'instantly'
            },
            tags: internalEvent === InternalEventType.BOUNCED ? ['bounced'] : internalEvent === InternalEventType.UNSUBSCRIBED ? ['unsubscribed'] : []
        });
        // Handle Pipeline Stages
        if ([InternalEventType.SENT, InternalEventType.REPLIED].includes(internalEvent)) {
            const pipelineStageId = internalEvent === InternalEventType.SENT
                ? process.env.GHL_STAGE_CONTACTED_ID
                : process.env.GHL_STAGE_REPLIED_ID;
            if (pipelineStageId) {
                await upsertGhlOpportunity({
                    locationId,
                    contactId,
                    pipelineId,
                    pipelineStageId,
                    name: `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || email
                });
            }
        }
        // Handle Replies
        if (internalEvent === InternalEventType.REPLIED && payload.message) {
            await upsertConversationOnReply({
                locationId,
                contactId,
                message: payload.message,
                direction: 'inbound',
                channel: 'email'
            });
        }
        // 7. Mark as Processed
        await markEventProcessed(dbEventId);
        return res.status(200).json({ ok: true });
    }
    catch (error) {
        console.error('Webhook Error:', error);
        // Reliability: Log to dead letters
        await logToDeadLetters({
            source: 'instantly_webhook',
            provider_event_id: providerEventId,
            payload: payload,
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            }
        });
        // Return 200 with error details for debugging
        return res.status(200).json({
            ok: false,
            message: 'Error recorded in dead-letters (or failed to log)',
            error: error.message,
            ghl_response: error.response?.data,
            stack: error.stack
        });
    }
}
//# sourceMappingURL=instantly.js.map