import "server-only";

import { cookies, headers } from "next/headers";
import { COOKIE_DOMAIN, sharesCookie } from "@/lib/hosts";

export type Session = { email: string; name: string; plan: string; token?: string };

const SESSION_COOKIE = "kaikei_session";

// TODO(Antonio): replace with the real identity provider; this cookie only carries the pipeline between screens.
export async function setSession(session: Session) {
  // On kaikei.io / app.kaikei.io the cookie is shared across *.kaikei.io so login carries into the platform.
  const domain = sharesCookie((await headers()).get("host")) ? COOKIE_DOMAIN : undefined;
  (await cookies()).set(SESSION_COOKIE, Buffer.from(JSON.stringify(session)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    domain,
  });
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof parsed?.email === "string" ? (parsed as Session) : null;
  } catch {
    return null;
  }
}