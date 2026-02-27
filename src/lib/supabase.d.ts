export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export interface InstantlyEvent {
    id?: string;
    provider: string;
    provider_event_id: string;
    event_type: string;
    email: string;
    campaign_id?: string;
    payload: any;
    processed_at?: string;
    created_at?: string;
}
export interface DeadLetter {
    id?: string;
    source: string;
    provider_event_id?: string;
    payload: any;
    error: any;
    created_at?: string;
}
export declare function logInstantlyEvent(event: any): Promise<any>;
export declare function checkIdempotency(providerEventId: string): Promise<{
    id: any;
    processed_at: any;
} | null>;
export declare function markEventProcessed(id: string): Promise<void>;
export declare function logToDeadLetters(deadLetter: DeadLetter): Promise<void>;
//# sourceMappingURL=supabase.d.ts.map