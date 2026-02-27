export declare const ghlClient: import("axios").AxiosInstance;
export interface GhlContactUpsert {
    locationId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    /**
     * IMPORTANT:
     * GHL customFields expect an array of {id,value}. The "id" must be the
     * *custom field ID* (not the field name). If you're using field names here,
     * you must map names -> IDs somewhere else before calling this.
     */
    customFields?: Record<string, any>;
    tags?: string[];
}
export interface GhlOpportunityUpsert {
    locationId: string;
    contactId: string;
    pipelineId: string;
    pipelineStageId: string;
    name: string;
}
export declare function upsertGhlContact({ locationId, email, firstName, lastName, phone, customFields, tags, }: GhlContactUpsert): Promise<string>;
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
export declare function upsertGhlOpportunity({ locationId, contactId, pipelineId, pipelineStageId, name, }: GhlOpportunityUpsert): Promise<string>;
/**
 * Move opportunity stage.
 * FIX: use pipelineStageId (NOT stageId).
 */
export declare function moveOpportunityStage({ opportunityId, pipelineStageId, }: {
    opportunityId: string;
    pipelineStageId: string;
}): Promise<string>;
/**
 * Create conversation message on reply.
 * Note: Some accounts require a conversationId/thread.
 * If this endpoint fails, you may need to:
 * - create a conversation first, then post a message
 * depending on your account settings.
 */
export declare function upsertConversationOnReply({ locationId, contactId, message, direction, channel, }: {
    locationId: string;
    contactId: string;
    message: string;
    direction?: "inbound" | "outbound";
    channel?: "email" | "sms";
}): Promise<any>;
//# sourceMappingURL=ghl.d.ts.map