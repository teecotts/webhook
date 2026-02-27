import { supabase } from './src/lib/supabase.js';
async function checkDeadLetters() {
    const { data, error } = await supabase
        .from('dead_letters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    if (error) {
        console.error('Error reading dead_letters:', error);
        return;
    }
    console.log('--- Last 5 Dead Letters ---');
    console.log(JSON.stringify(data, null, 2));
}
checkDeadLetters();
//# sourceMappingURL=debug_errors.js.map