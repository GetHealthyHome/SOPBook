import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://omxxjasmsjjuydaishcn.supabase.co';
const supabaseKey = 'sb_publishable_HzpD0csDtECm2wEGvKGYBA_8mMLGcQW';

export const supabase = createClient(supabaseUrl, supabaseKey);
