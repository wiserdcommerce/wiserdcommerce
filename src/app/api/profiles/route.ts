import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, getServerSession } from "@/lib/auth-session";
import { readDb } from "@/lib/db";
import { findActiveUserByHandle, toPublicUserProfile } from "@/lib/profiles";

export async function GET(request: Request) {
  const limited = checkRateLimit(`profiles:get:${getClientIp(request)}`, 90, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle") || "";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const role = searchParams.get("role") || "";

  const db = readDb();
  const session = await getServerSession();
  const viewer = session
    ? db.users.find((u) => u.id === session.userId && u.status === "active") || null
    : null;

  if (handle) {
    const target = findActiveUserByHandle(db, handle);
    if (!target) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
    const profile = toPublicUserProfile(target, db);
    const posts = db.posts
      .filter((p) => p.authorId === target.id && p.status !== "removed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({
        ...p,
        commentCount: db.comments.filter((c) => c.postId === p.id).length,
      }));
    const viewerFollows = Boolean(
      viewer && viewer.followingUserIds.includes(target.id)
    );
    return NextResponse.json({ profile, posts, viewerFollows });
  }

  let profiles = db.users
    .filter((u) => u.status === "active")
    .map((u) => toPublicUserProfile(u, db));

  if (role === "seller" || role === "buyer") {
    profiles = profiles.filter((p) => p.roles.includes(role));
  }
  if (q) {
    profiles = profiles.filter((p) =>
      `${p.displayName} ${p.handle} ${p.bio} ${p.store?.name || ""}`
        .toLowerCase()
        .includes(q)
    );
  }

  return NextResponse.json({ profiles, total: profiles.length });
}
