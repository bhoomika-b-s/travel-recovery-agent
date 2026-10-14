import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by Supabase inside Edge Functions. You do not set them.

// Admin client: uses the service role key and bypasses Row Level Security.
// It lives only on the server. Because it can read everything, every function
// MUST check that the caller owns the booking before using it.
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type AuthResult =
  | { ok: true; user: User; userClient: SupabaseClient }
  | { ok: false; error: string }

// Checks the caller's JWT. The returned userClient acts AS the passenger
// (auth.uid() works inside the database), which accept_alternative needs.
export async function authenticate(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing Authorization header. Please sign in again.' }
  }

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, error: 'Your session is invalid or expired. Please sign in again.' }
  }
  return { ok: true, user: data.user, userClient }
}

// Unwraps a Supabase response: throws on error, otherwise returns the data (maybe null).
export function must<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message)
  return res.data
}