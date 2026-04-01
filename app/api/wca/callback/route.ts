import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForToken, fetchWcaProfile } from "@/lib/wca";
import { PrismaClientKnownRequestError } from "@prisma/client-runtime-utils";

const WCA_STATE_COOKIE = "wca_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Authenticate the current user via Supabase cookies.
  const supabase = await createServerSupabaseClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
    select: { id: true, username: true },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Validate CSRF state.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(WCA_STATE_COOKIE)?.value;

  // Check if we should redirect back to onboarding instead of the profile page.
  const wcaRedirect = cookieStore.get("wca_redirect")?.value;
  const redirectPath = wcaRedirect ?? `/profile/${user.username}`;
  const profileUrl = new URL(redirectPath, url.origin);

  if (!code || !state || state !== expectedState) {
    profileUrl.searchParams.set("wca", "error");
    profileUrl.searchParams.set("reason", "invalid_state");
    const response = NextResponse.redirect(profileUrl);
    response.cookies.delete(WCA_STATE_COOKIE);
    return response;
  }

  try {
    // Build the redirect URI (must match what was sent in the authorize request).
    const redirectUri = new URL("/api/wca/callback", url.origin).toString();

    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const wcaProfile = await fetchWcaProfile(accessToken);

    // Store the verified WCA ID on the user.
    await prisma.user.update({
      where: { id: user.id },
      data: { wcaId: wcaProfile.wcaId },
    });

    profileUrl.searchParams.set("wca", "linked");
    const response = NextResponse.redirect(profileUrl);
    response.cookies.delete(WCA_STATE_COOKIE);
    response.cookies.delete("wca_redirect");
    return response;
  } catch (e) {
    console.error("WCA OAuth callback error:", e);

    let reason = "unknown";
    const prismaCode = (e as { code?: string })?.code;
    if (prismaCode === "P2002") {
      reason = "already_linked";
    } else if (e instanceof Error) {
      if (e.message.includes("does not have an assigned WCA ID")) {
        reason = "no_wca_id";
      }
    }

    profileUrl.searchParams.set("wca", "error");
    profileUrl.searchParams.set("reason", reason);
    const response = NextResponse.redirect(profileUrl);
    response.cookies.delete(WCA_STATE_COOKIE);
    return response;
  }
}
