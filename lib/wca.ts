import { env } from "@/lib/env";

const WCA_BASE = "https://www.worldcubeassociation.org";
export const WCA_AUTHORIZE_URL = `${WCA_BASE}/oauth/authorize`;
const WCA_TOKEN_URL = `${WCA_BASE}/oauth/token`;
const WCA_ME_URL = `${WCA_BASE}/api/v0/me`;

export type WcaProfile = {
  wcaId: string;
  name: string;
  countryIso2: string;
};

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env().NEXT_PUBLIC_WCA_CLIENT_ID,
    client_secret: env().WCA_CLIENT_SECRET,
    redirect_uri: redirectUri,
  });

  const res = await fetch(WCA_TOKEN_URL, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WCA token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function fetchWcaProfile(
  accessToken: string,
): Promise<WcaProfile> {
  const res = await fetch(WCA_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`WCA /me request failed (${res.status})`);
  }

  const data = await res.json();
  const me = data.me;

  if (!me.wca_id) {
    throw new Error("WCA account does not have an assigned WCA ID");
  }

  return {
    wcaId: me.wca_id as string,
    name: me.name as string,
    countryIso2: me.country_iso2 as string,
  };
}
