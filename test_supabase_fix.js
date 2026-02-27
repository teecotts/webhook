import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const url = 'https://pxearrkhjfuoctwicmvh.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function testConnection() {
    if (!key)
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('instantly_events').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('Connection failed with inferred URL:', error.message);
    }
    else {
        console.log('✅ Connection successful with URL:', url);
    }
}
testConnection();
//# sourceMappingURL=test_supabase_fix.js.map