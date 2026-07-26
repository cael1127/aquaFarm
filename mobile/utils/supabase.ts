import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yiwxwqoqjhjwjtfsbone.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpd3h3cW9xamhqd2p0ZnNib25lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjgwMjgsImV4cCI6MjA2ODYwNDAyOH0.f-W3FljQEImFNr3TmyUoBlnMFzzKcf2zW0ZxqJg7Fo4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 