import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  checkRateLimit,
  getClientIp,
  getSessionCookieOptions,
  isLocalSandboxAllowed,
  parseJsonBody,
  signSessionToken,
  verifyGoogleIdToken,
} from "@/lib/auth-session";
import { mutateDb, makeId, slugify } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/integrations";
import type { UserRole } from "@/lib/types";

function isConfiguredAdminEmail(email: string): boolean {
  const raw = process.env.WISERD_ADMIN_EMAILS || "";
  if (!raw.trim()) return false;
  const target = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}

export async function POST(request: Request) {
  const limited = checkRateLimit(`auth:google:${getClientIp(request)}`, 30, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    credential?: string;
    mode?: "google" | "local_sandbox";
    sandboxUserId?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    if (body.mode === "local_sandbox") {
      if (!isLocalSandboxAllowed()) {
        return NextResponse.json(
          {
            error:
              "Local sandbox sign-in is disabled in this environment. Configure Google Identity Services or enable WISERD_ENABLE_LOCAL_SANDBOX=true locally.",
          },
          { status: 403 }
        );
      }

      const integrations = getIntegrationStatus();
      const result = await mutateDb((db) => {
        const target =
          db.users.find((u) => u.id === (body.sandboxUserId || "usr_demo_member")) ||
          db.users.find((u) => u.id === "usr_demo_member");
        if (!target) return { error: "Sandbox account not found.", status: 404 as const };
        if (target.status === "suspended") {
          return { error: "This WISERD account is currently suspended.", status: 403 as const };
        }
        db.auditLogs.unshift({
          id: makeId("audit"),
          actorId: target.id,
          actorName: target.displayName,
          action: "auth.local_sandbox_session",
          targetType: "user",
          targetId: target.id,
          details: integrations.googleIdentityServices.configured
            ? "Signed into local sandbox account for testing."
            : "Signed into local sandbox account (Google Identity Services not configured).",
          createdAt: new Date().toISOString(),
        });
        return { user: target };
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      const token = signSessionToken({
        userId: result.user.id,
        authMode: "local_sandbox",
        issuedAt: Date.now(),
      });

      const response = NextResponse.json({
        authenticated: true,
        user: result.user,
        authMode: "local_sandbox",
      });
      response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
      return response;
    }

    if (!body.credential) {
      return NextResponse.json(
        { error: "Missing Google Identity Services ID token." },
        { status: 400 }
      );
    }

    const claims = await verifyGoogleIdToken(body.credential);
    const now = new Date().toISOString();

    const result = await mutateDb((db) => {
      let existing = db.users.find(
        (u) => u.googleIdentity?.provider === "google" && u.googleIdentity.sub === claims.sub
      );

      if (!existing && claims.emailVerified) {
        const emailMatch = db.users.find(
          (u) => u.email.toLowerCase() === claims.email.toLowerCase()
        );
        if (emailMatch) {
          // Refuse rebinding an account already linked to a different Google subject
          if (
            emailMatch.googleIdentity?.provider === "google" &&
            emailMatch.googleIdentity.sub !== claims.sub
          ) {
            return {
              error: "This email is already linked to a different Google account.",
              status: 409 as const,
            };
          }
          existing = emailMatch;
        }
      }

      if (existing) {
        if (existing.status === "suspended") {
          return { error: "This WISERD account is currently suspended.", status: 403 as const };
        }
        existing.authMode = "google_verified";
        existing.displayName = existing.displayName || claims.name;
        existing.avatarUrl = claims.picture || existing.avatarUrl;
        existing.googleIdentity = {
          provider: "google",
          sub: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          verifiedByGoogleToken: true,
          connectedAt: existing.googleIdentity?.connectedAt || now,
        };
        if (
          claims.emailVerified &&
          isConfiguredAdminEmail(claims.email) &&
          !existing.roles.includes("admin")
        ) {
          existing.roles = [...existing.roles, "admin"];
          db.auditLogs.unshift({
            id: makeId("audit"),
            actorId: "system",
            actorName: "WISERD Platform",
            action: "auth.admin_bootstrap",
            targetType: "user",
            targetId: existing.id,
            details: `Granted administrator role to configured founder email (${claims.email}).`,
            createdAt: now,
          });
        }
        return { user: existing };
      }

      const parts = claims.name.split(/\s+/);
      const initials = (
        (parts[0]?.[0] || "W") + (parts[1]?.[0] || parts[0]?.[1] || "U")
      ).toUpperCase();

      const baseHandle = slugify(claims.name || claims.email.split("@")[0]) || "member";
      const handle = db.users.some((u) => u.handle === baseHandle)
        ? `${baseHandle}-${makeId("u").slice(-4)}`
        : baseHandle;
      const bootstrapAdmin =
        claims.emailVerified && isConfiguredAdminEmail(claims.email);
      const initialRoles: UserRole[] = bootstrapAdmin
        ? ["buyer", "admin"]
        : ["buyer"];

      const created = {
        id: makeId("usr"),
        handle,
        displayName: claims.name,
        email: claims.email,
        avatarInitials: initials,
        avatarUrl: claims.picture,
        bio: "",
        roles: initialRoles,
        status: "active" as const,
        authMode: "google_verified" as const,
        googleIdentity: {
          provider: "google" as const,
          sub: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          verifiedByGoogleToken: true,
          connectedAt: now,
        },
        favoriteProductIds: [],
        followedStoreIds: [],
        followingUserIds: [],
        savedPostIds: [],
        addresses: [],
        privacy: {
          showFollowing: true,
          showSavedPosts: false,
          allowDirectMessages: true,
        },
        createdAt: now,
      };
      db.users.push(created);
      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: created.id,
        actorName: created.displayName,
        action: "auth.google_verified_signup",
        targetType: "user",
        targetId: created.id,
        details: `Verified Google Identity Services login via sub ${claims.sub.slice(0, 8)}...`,
        createdAt: now,
      });
      return { user: created };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const token = signSessionToken({
      userId: result.user.id,
      authMode: "google_verified",
      issuedAt: Date.now(),
    });

    const response = NextResponse.json({
      authenticated: true,
      user: result.user,
      authMode: "google_verified",
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
