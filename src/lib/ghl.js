import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
/**
 * GHL v2 API notes:
 * - Base: https://services.leadconnectorhq.com
 * - Requires headers:
 *    Authorization: Bearer <token>
 *    Version: 2021-07-28
 *    Content-Type: application/json
 *
 * IMPORTANT FIX:
 * - Opportunities API uses `pipelineStageId`, NOT `stageId`.
 */
const GHL_API_KEY = process.env.GHL_API_KEY;
if (!GHL_API_KEY) {
    throw new Error("Missing env: GHL_API_KEY. Create a Private Integration token in GHL and set GHL_API_KEY.");
}
export const ghlClient = axios.create({
    baseURL: "https://services.leadconnectorhq.com",
    headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
    },
    timeout: 30000, // Increase timeout
});
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
/**
 * Search contacts by email.
 * GHL `/contacts` search behavior varies by account. We'll keep it defensive.
 */
async function findContactByEmail(locationId, email) {
    const q = normalizeEmail(email);
    // Many accounts support query=...
    // Some require "email" search, so we attempt query first.
    const resp = await ghlClient.get("/contacts", {
        params: { locationId, query: q },
    });
    const contacts = resp.data?.contacts || [];
    return contacts.find((c) => normalizeEmail(c.email || "") === q) || contacts[0] || null;
}
export async function upsertGhlContact({ locationId, email, firstName, lastName, phone, customFields, tags, }) {
    try {
        const existing = await findContactByEmail(locationId, email);
        const payload = {
            locationId,
            email: normalizeEmail(email),
            firstName,
            lastName,
            phone,
            tags,
        };
        // Convert customFields map -> array [{id,value}]
        if (customFields && Object.keys(customFields).length > 0) {
            payload.customFields = Object.entries(customFields).map(([id, value]) => ({
                id,
                value,
            }));
        }
        if (existing?.id) {
            // When updating contact, many accounts do NOT want locationId in body.
            const { locationId: _omit, ...updatePayload } = payload;
            const updateResp = await ghlClient.put(`/contacts/${existing.id}`, updatePayload);
            return updateResp.data?.contact?.id || existing.id;
        }
        const createResp = await ghlClient.post("/contacts", payload);
        return createResp.data?.contact?.id;
    }
    catch (error) {
        if (error.response) {
            console.error("GHL Contact Error Response:", JSON.stringify(error.response.data, null, 2));
        }
        console.error("GHL Upsert Contact Error:", error.message);
        throw error;
    }
}
/**
 * Upsert Opportunity for a contact in a pipeline.
 * FIX: use pipelineStageId (NOT stageId).
 *
 * Search:
 * GET /opportunities/search with snake_case query params:
 * - location_id
 * - pipeline_id
 * - contact_id
 */
export async function upsertGhlOpportunity({ locationId, contactId, pipelineId, pipelineStageId, name, }) {
    try {
        const searchResp = await ghlClient.get("/opportunities/search", {
            params: {
                location_id: locationId,
                pipeline_id: pipelineId,
                contact_id: contactId,
            },
        });
        const existingOpp = searchResp.data?.opportunities?.[0];
        if (existingOpp?.id) {
            // Update existing opportunity
            // GHL v2: DO NOT send locationId in PUT body for opportunities
            const finalUpdatePayload = {
                pipelineId,
                pipelineStageId,
                name,
                status: "open",
            };
            const updateResp = await ghlClient.put(`/opportunities/${existingOpp.id}`, finalUpdatePayload);
            return updateResp.data?.opportunity?.id || existingOpp.id;
        }
        // Create new opportunity
        const createPayload = {
            pipelineId,
            locationId,
            contactId,
            name,
            pipelineStageId,
            status: "open",
        };
        const createResp = await ghlClient.post("/opportunities", createPayload);
        return createResp.data?.opportunity?.id;
    }
    catch (error) {
        console.error("GHL Opportunity Error Response:", error.response?.data || error.message);
        throw error;
    }
}
/**
 * Move opportunity stage.
 * FIX: use pipelineStageId (NOT stageId).
 */
export async function moveOpportunityStage({ opportunityId, pipelineStageId, }) {
    try {
        const resp = await ghlClient.put(`/opportunities/${opportunityId}`, {
            pipelineStageId,
        });
        return resp.data?.opportunity?.id || opportunityId;
    }
    catch (error) {
        console.error("GHL Move Stage Error:", error.response?.data || error.message);
        throw error;
    }
}
/**
 * Create conversation message on reply.
 * Note: Some accounts require a conversationId/thread.
 * If this endpoint fails, you may need to:
 * - create a conversation first, then post a message
 * depending on your account settings.
 */
export async function upsertConversationOnReply({ locationId, contactId, message, direction = "inbound", channel = "email", }) {
    try {
        const payload = {
            locationId,
            contactId,
            type: channel === "email" ? "Email" : "SMS",
            body: (message || "New reply received").trim(),
            direction: direction === "inbound" ? "inbound" : "outbound",
        };
        const resp = await ghlClient.post("/conversations/messages", payload);
        return resp.data;
        return resp.data;
    }
    catch (error) {
        console.error("GHL Conversation Error:", error.response?.data || error.message);
        throw error;
    }
}
//# sourceMappingURL=ghl.js.map