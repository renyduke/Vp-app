import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tnvojlftcaoxxkafrzvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudm9qbGZ0Y2FveHhrYWZyenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjMxNTgsImV4cCI6MjA4MTUzOTE1OH0.43RjKjWlyWMplRJge7e6hAhyaPq3s_urOXT7D7EFL1Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
