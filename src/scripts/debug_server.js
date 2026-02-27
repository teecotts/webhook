import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';
dotenv.config();
/**
 * MOCKED/INLINED GHL CLIENT FOR DEBUGGING
 */
const GHL_API_KEY = process.env.GHL_API_KEY;
const ghlClient = axios.create({
    baseURL: "https://services.leadconnectorhq.com",
    headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
    },
});
ghlClient.interceptors.request.use((config) => {
    console.log(`[GHL DEBUG] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data) {
        console.log(`[GHL DEBUG] Body Keys:`, Object.keys(config.data));
        if (config.data.locationId) {
            console.error(`[GHL DEBUG] ERROR: locationId found in body!`);
        }
    }
    return config;
});
// Re-implement upsertGhlOpportunity here to be 100% sure what's running
async function upsertGhlOpportunity({ locationId, contactId, pipelineId, pipelineStageId, name, }) {
    const searchResp = await ghlClient.get("/opportunities/search", {
        params: { location_id: locationId, pipeline_id: pipelineId, contact_id: contactId },
    });
    const existingOpp = searchResp.data?.opportunities?.[0];
    if (existingOpp?.id) {
        console.log(`[GHL DEBUG] Updating existing opportunity ${existingOpp.id}`);
        const updatePayload = { pipelineId, pipelineStageId, name, status: "open" };
        const updateResp = await ghlClient.put(`/opportunities/${existingOpp.id}`, updatePayload);
        return updateResp.data;
    }
    console.log(`[GHL DEBUG] Creating new opportunity`);
    const createPayload = { pipelineId, locationId, contactId, name, pipelineStageId, status: "open" };
    const createResp = await ghlClient.post("/opportunities", createPayload);
    return createResp.data;
}
const app = express();
app.use(express.json());
app.post('/api/webhooks/instantly', async (req, res) => {
    console.log(`[SERVER] Received ${req.body.event_type} for ${req.body.email}`);
    try {
        const payload = req.body;
        const locationId = process.env.GHL_LOCATION_ID;
        const pipelineId = process.env.GHL_PARTNER_PIPELINE_ID;
        const pipelineStageId = payload.event_type === 'email_sent'
            ? process.env.GHL_STAGE_CONTACTED_ID
            : process.env.GHL_STAGE_REPLIED_ID;
        if (['email_sent', 'replied'].includes(payload.event_type)) {
            await upsertGhlOpportunity({
                locationId,
                contactId: 'dummy_contact_id', // Simplify for debug
                pipelineId,
                pipelineStageId,
                name: 'Debug Test'
            });
        }
        res.json({ ok: true });
    }
    catch (error) {
        console.error('[SERVER] Handler Error:', error.response?.data || error.message);
        res.json({ ok: false, error: error.message, ghl: error.response?.data });
    }
});
app.listen(3001, () => {
    console.log(`🚀 Debug Server running at http://localhost:3001`);
});
//# sourceMappingURL=debug_server.js.map