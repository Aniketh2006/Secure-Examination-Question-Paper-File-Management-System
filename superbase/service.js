// supabase/service.js - Updated for your tables
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function logActivity(userId, action, targetId = null) {
    const { error } = await supabase
        .from('activity_logs')
        .insert([{ user_id: userId, action, target_id: targetId, timestamp: new Date().toISOString() }]);
    if (error) console.error('Log error:', error);
}

export async function createQuestionFolder(ownerId, year, semester, branch, subject, title) {
    const { data, error } = await supabase
        .from('question_folders')
        .insert([{ 
            owner_user_id: ownerId, 
            year, semester, branch, subject, title 
        }])
        .select()
        .single();
    return { data, error };
}

export async function getUserFolders(userId) {
    return await supabase
        .from('question_folders')
        .select('*')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false });
}

