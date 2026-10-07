import {createMesaHandler} from './handler.mjs';
const origins=Deno.env.get('ADMIN_ALLOWED_ORIGINS')?.split(',').map(value=>value.trim()).filter(Boolean);
Deno.serve(createMesaHandler({url:Deno.env.get('SUPABASE_URL'),key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY'),...(origins?.length?{origins}:{})}));
