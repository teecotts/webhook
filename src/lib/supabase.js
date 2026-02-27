import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase URL or Service Key is missing. Webhook logging will fail.');
}
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
export async function logInstantlyEvent(event) {
    // Map internal fields to DB columns if they differ
    const dbPayload = {
        ...event,
        // Add status if requested (using 'pending' or 'received' as default)
        status: event.status || 'received',
        // 'received_at' might be used if desired, but schema has 'created_at' and 'processed_at'
    };
    const { data, error } = await supabase
        .from('instantly_events')
        .insert([dbPayload])
        .select()
        .single();
    if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
    }
    return data;
}
export async function checkIdempotency(providerEventId) {
    const { data, error } = await supabase
        .from('instantly_events')
        .select('id, processed_at')
        .eq('provider_event_id', providerEventId)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
export async function markEventProcessed(id) {
    const { error } = await supabase
        .from('instantly_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', id);
    if (error)
        throw error;
}
export async function logToDeadLetters(deadLetter) {
    const { error } = await supabase
        .from('dead_letters')
        .insert([deadLetter]);
    if (error) {
        console.error('Failed to log to dead letters:', error);
    }
}
//# sourceMappingURL=supabase.js.map