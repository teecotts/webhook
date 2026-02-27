import crypto from "crypto";
import { upsertGhlContact, upsertGhlOpportunity, upsertConversationOnReply, } from "../../src/lib/ghl.js";
import { supabase } from "../../src/lib/supabase.js";
function normalizeEventType(raw) {
    const v = (raw || "").trim().toLowerCase();
    // Map common variants to internal types
    if (["email_sent", "sent"].includes(v))
        return "email_sent";
    if (["opened", "email_opened"].includes(v))
        return "opened";
    if (["replied", "email_replied"].includes(v))
        return "replied";
    if (["bounced", "email_bounced"].includes(v))
        return "bounced";
    if (["unsubscribed", "unsubscribe"].includes(v))
        return "unsubscribed";
    return v || "unknown";
}
function computeProviderEventId(payload) {
    // ✅ Fix: use payload.id first (prevents “Already processed” collisions)
    if (typeof payload?.id === "string" && payload.id.trim().length > 0) {
        return payload.id.trim();
    }
    return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
async function alreadyProcessed(providerEventId) {
    const { data, error } = await supabase
        .from("instantly_events")
        .select("id, status")
        .eq("provider_event_id", providerEventId)
        .limit(1);
    if (error)
        throw error;
    return data && data.length > 0;
}
async function logInstantlyEvent(params) {
    const { error } = await supabase.from("instantly_events").insert({
        provider: "instantly",
        provider_event_id: params.provider_event_id,
        event_type: params.event_type,
        email: params.email || null,
        campaign_id: params.campaign_id || null,
        payload: params.payload,
        status: params.status || "received",
        received_at: new Date().toISOString(),
    });
    if (error)
        throw error;
}
async function markProcessed(providerEventId, extra) {
    const { error } = await supabase
        .from("instantly_events")
        .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        ...(extra || {}),
    })
        .eq("provider_event_id", providerEventId);
    if (error)
        throw error;
}
async function markFailed(providerEventId, errorObj) {
    const { error } = await supabase
        .from("instantly_events")
        .update({
        status: "failed",
        processed_at: new Date().toISOString(),
        error: errorObj,
    })
        .eq("provider_event_id", providerEventId);
    if (error)
        throw error;
}
async function deadLetter(source, providerEventId, payload, errorObj) {
    const { error } = await supabase.from("dead_letters").insert({
        source,
        provider: "instantly",
        provider_event_id: providerEventId,
        payload,
        error: errorObj,
        created_at: new Date().toISOString(),
    });
    if (error)
        throw error;
}
function assertAuth(req) {
    // If you haven’t upgraded Instantly yet, you can still test locally:
    // set INSTANTLY_WEBHOOK_SECRET in .env and pass x-instantly-signature in the test script.
    const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
    // If no secret is set, skip auth (dev mode). In prod, always set it.
    if (!secret)
        return;
    const signature = req.headers["x-instantly-signature"];
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!sig || sig !== secret) {
        const err = new Error("Unauthorized");
        err.statusCode = 401;
        throw err;
    }
}
function requireEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env: ${name}`);
    return v;
}
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ ok: false, error: "Method Not Allowed" });
        }
        assertAuth(req);
        const payload = (req.body || {});
        const eventType = normalizeEventType(payload.event_type);
        const email = (payload.email || "").trim().toLowerCase();
        const providerEventId = computeProviderEventId(payload);
        if (!email) {
            // Still log it
            await logInstantlyEvent({
                provider_event_id: providerEventId,
                event_type: eventType,
                payload,
                status: "ignored",
            });
            return res.status(200).json({ ok: true, message: "Ignored (missing email)" });
        }
        // Idempotency check BEFORE doing anything heavy
        if (await alreadyProcessed(providerEventId)) {
            return res.status(200).json({ ok: true, message: "Already processed" });
        }
        // Log received event
        await logInstantlyEvent({
            provider_event_id: providerEventId,
            event_type: eventType,
            email,
            campaign_id: payload.campaign_id ?? undefined,
            payload,
            status: "received",
        });
        // Required GHL env
        const locationId = requireEnv("GHL_LOCATION_ID");
        const pipelineId = requireEnv("GHL_PARTNER_PIPELINE_ID");
        const stageContacted = requireEnv("GHL_STAGE_CONTACTED_ID");
        const stageReplied = requireEnv("GHL_STAGE_REPLIED_ID");
        const stageCallBooked = process.env.GHL_STAGE_CALL_BOOKED_ID;
        // Fast-path: opened/unsubscribed/bounced can just update contact + mark processed
        // but still okay to create/upsert contact for completeness.
        const firstName = payload.first_name;
        const lastName = payload.last_name;
        // Always ensure contact exists
        const contactId = await upsertGhlContact({
            locationId,
            email,
            firstName,
            lastName,
            customFields: {
            // NOTE: these keys must be custom field IDs, not names.
            // If you're passing names currently, remove this block or map names->IDs.
            },
            tags: eventType === "bounced"
                ? ["instantly_bounced"]
                : eventType === "unsubscribed"
                    ? ["instantly_unsubscribed"]
                    : undefined,
        });
        // Decide stage based on event
        if (eventType === "email_sent") {
            await upsertGhlOpportunity({
                locationId,
                contactId,
                pipelineId,
                pipelineStageId: stageContacted,
                name: `${firstName || ""} ${lastName || ""}`.trim() || email,
            });
            await markProcessed(providerEventId, { contact_id: contactId, location_id: locationId });
            return res.status(200).json({ ok: true });
        }
        if (eventType === "replied") {
            const oppId = await upsertGhlOpportunity({
                locationId,
                contactId,
                pipelineId,
                pipelineStageId: stageReplied,
                name: `${firstName || ""} ${lastName || ""}`.trim() || email,
            });
            // Add reply into conversations inbox
            if (payload.message && payload.message.trim().length > 0) {
                await upsertConversationOnReply({
                    locationId,
                    contactId,
                    message: payload.message.trim(),
                    direction: "inbound",
                    channel: "email",
                });
            }
            await markProcessed(providerEventId, {
                contact_id: contactId,
                opportunity_id: oppId,
                location_id: locationId,
            });
            return res.status(200).json({ ok: true });
        }
        if (eventType === "opened") {
            // No stage move; just mark processed
            await markProcessed(providerEventId, { contact_id: contactId, location_id: locationId });
            return res.status(200).json({ ok: true });
        }
        if (eventType === "bounced" || eventType === "unsubscribed") {
            await markProcessed(providerEventId, { contact_id: contactId, location_id: locationId });
            return res.status(200).json({ ok: true });
        }
        // Optional: meeting booked stage
        if (eventType === "meeting_booked" && stageCallBooked) {
            const oppId = await upsertGhlOpportunity({
                locationId,
                contactId,
                pipelineId,
                pipelineStageId: stageCallBooked,
                name: `${firstName || ""} ${lastName || ""}`.trim() || email,
            });
            await markProcessed(providerEventId, {
                contact_id: contactId,
                opportunity_id: oppId,
                location_id: locationId,
            });
            return res.status(200).json({ ok: true });
        }
        // Unknown event type: just mark processed to avoid retries
        await markProcessed(providerEventId, { contact_id: contactId, location_id: locationId });
        return res.status(200).json({ ok: true, message: `Unhandled event_type=${eventType}` });
    }
    catch (err) {
        const statusCode = err?.statusCode || 500;
        // Try to record in dead_letters if possible
        try {
            const payload = (typeof err?.payload !== "undefined" ? err.payload : null) || null;
            // We may not have providerEventId here; fallback:
            const providerEventId = "unknown";
            await deadLetter("instantly_webhook", providerEventId, payload, {
                message: err?.message,
                stack: err?.stack,
                response: err?.response?.data,
            });
        }
        catch {
            // ignore dead letter failures
        }
        return res.status(200).json({
            ok: false,
            message: "Error recorded in dead-letters (or failed to log)",
            error: err?.message || "Unknown error",
            ghl_response: err?.response?.data,
            stack: err?.stack,
        });
    }
}
//# sourceMappingURL=instantly.js.map