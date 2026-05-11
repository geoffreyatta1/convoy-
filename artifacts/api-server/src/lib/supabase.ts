import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"];
const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

/** Admin client — bypasses RLS. Use only for server-side verification. */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/**
 * Create a user-scoped Supabase client from the caller's access token.
 * RLS and auth.uid() reflect that user's identity.
 */
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl!, process.env["SUPABASE_ANON_KEY"]!, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
