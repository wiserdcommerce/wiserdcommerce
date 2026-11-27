import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User, WiserdDatabase } from "./types";

export const SESSION_COOKIE_NAME = "wiserd_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export interface SessionPayload {
  userId: string;
  authMode: "google_verified" | "local_sandbox";
  issuedAt: number;
}

// Ephemeral per-boot CSPRNG fallback prevents offline cookie forgery when WISERD_SESSION_SECRET is unset.
// shortcut: single-process ephemeral secret if env var is omitted; set a 32+ byte WISERD_SESSION_SECRET before multi-instance deployment.
const EPHEMERAL_BOOT_SECRET = crypto.randomBytes(32).toString("hex");
let warnedMissingSecret = false;

function getSecret(): string {
  const configured = process.env.WISERD_SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) {
    return configured;
  }
  if (!warnedMissingSecret && process.env.NODE_ENV === "production") {
    warnedMissingSecret = true;
    console.warn(
      "[WISERD] WISERD_SESSION_SECRET is unset or shorter than 32 chars; using an ephemeral per-boot secret."
    );
  }
  return EPHEMERAL_BOOT_SECRET;
}

export function isLocalSandboxAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.WISERD_ENABLE_LOCAL_SANDBOX === "true"
  );
}

export function getSessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!parsed.userId || !parsed.authMode || typeof parsed.issuedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.issuedAt > SESSION_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(raw);
}

export function requireActiveUser(
  db: WiserdDatabase,
  session: SessionPayload
): { user: User } | { error: string; status: 403 | 404 } {
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return { error: "Account not found.", status: 404 };
  if (user.status === "suspended") {
    return {
      error: "This WISERD account is currently suspended.",
      status: 403,
    };
  }
  return { user };
}

export async function parseJsonBody<T>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Request body must be a valid JSON object." },
          { status: 400 }
        ),
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Malformed JSON request body." },
        { status: 400 }
      ),
    };
  }
}

// shortcut: in-memory per-process rate limiter; upgrade to Redis/Upstash for multi-instance production hosting.
const rateWindows = new Map<string, { count: number; resetAt: number }>();

// shortcut: trusts first proxy IP header; lock down to your reverse proxy's verified IP header in production.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const direct =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  if (direct) return direct.slice(0, 64);
  return "unknown";
}

export function checkRateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): NextResponse | null {
  const now = Date.now();
  // Prevent unbounded Map growth in long-lived Node processes
  if (rateWindows.size > 1000) {
    for (const [k, entry] of rateWindows) {
      if (entry.resetAt <= now) rateWindows.delete(k);
    }
    if (rateWindows.size > 5000) {
      const dropCount = rateWindows.size - 4000;
      let dropped = 0;
      for (const k of rateWindows.keys()) {
        rateWindows.delete(k);
        if (++dropped >= dropCount) break;
      }
    }
  }
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  current.count += 1;
  return null;
}

export interface VerifiedGoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Verifies a Google Identity Services ID token server-side via Google's tokeninfo endpoint.
 * Never trusts profile fields submitted directly by the browser.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedGoogleClaims> {
  const expectedClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!expectedClientId) {
    throw new Error(
      "Google Identity Services is not configured on this server (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID)."
    );
  }
  if (!idToken || idToken.split(".").length !== 3) {
    throw new Error("Invalid Google ID token format.");
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Google ID token verification failed.");
  }
  const data = (await res.json()) as {
    iss?: string;
    sub?: string;
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    exp?: string;
  };

  if (
    data.iss &&
    data.iss !== "https://accounts.google.com" &&
    data.iss !== "accounts.google.com"
  ) {
    throw new Error("Google ID token issuer is invalid.");
  }
  if (!data.sub || !data.email) {
    throw new Error("Google ID token is missing required sub or email claims.");
  }
  if (data.aud !== expectedClientId) {
    throw new Error("Google ID token audience does not match this WISERD application.");
  }
  const expSeconds = Number(data.exp);
  if (!Number.isFinite(expSeconds) || expSeconds * 1000 <= Date.now()) {
    throw new Error("Google ID token has expired.");
  }
  const emailVerified = data.email_verified === true || data.email_verified === "true";
  if (!emailVerified) {
    throw new Error("Google account email must be verified before signing in.");
  }

  return {
    sub: data.sub,
    email: data.email.toLowerCase(),
    emailVerified,
    name: data.name?.trim() || data.email.split("@")[0],
    picture: data.picture,
  };
}
