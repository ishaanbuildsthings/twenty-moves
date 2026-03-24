import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

// Creates a Supabase client for server-side code (tRPC context, server
// components, API routes). Used ONLY for auth operations (reading the
// current user from cookies) — never for data fetching. All data access
// goes through Prisma.
//
// "server-only" import prevents client components from importing this.
// Client components use lib/supabase/browser.ts instead.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // @supabase/ssr requires you to tell it how to read/write cookies,
      // since every framework does it differently. In Next.js, we use the
      // cookies() API from next/headers.
      cookies: {
        // Supabase calls this to read the JWT + refresh token from the
        // incoming request cookies — this is how it knows who the user is.
        getAll() {
          return cookieStore.getAll();
        },
        // Supabase calls this when it refreshes a token and needs to
        // write the updated token back. But in server components, cookies
        // are read-only (can't modify the response), so this silently
        // fails. The proxy (proxy.ts) handles the actual cookie writing.
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll is called from Server Components where cookies are
            // read-only. This is safe to ignore — the proxy handles
            // token refresh and sets updated cookies on the response.
          }
        },
      },
    }
  );
}
