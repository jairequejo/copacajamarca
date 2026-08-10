import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

export const supabaseUrl = 'https://uzyqpruqiqubwnqttnwf.supabase.co'
export const supabaseKey = 'sb_publishable_Li44BS4jk6I75zEFc05B1Q_NbBcuoPB'
export const supabase = createClient(supabaseUrl, supabaseKey)
