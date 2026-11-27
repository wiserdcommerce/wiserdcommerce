import type { PublicUserProfile, User, WiserdDatabase } from "./types";

/**
 * Strictly projects a User record into a privacy-safe public profile.
 * Never exposes email, shipping addresses, OAuth tokens/sub, wallets, or private favorites.
 */
export function toPublicUserProfile(
  user: User,
  db: WiserdDatabase
): PublicUserProfile {
  const store = db.stores.find((s) => s.ownerId === user.id) || null;
  const publishedListingCount = store
    ? db.products.filter((p) => p.storeId === store.id && p.status === "published").length
    : 0;

  const postCount = db.posts.filter(
    (p) => p.authorId === user.id && p.status !== "removed"
  ).length;
  const commentCount = db.comments.filter((c) => c.authorId === user.id).length;
  const followerCount = db.users.filter(
    (u) => u.status === "active" && Array.isArray(u.followingUserIds) && u.followingUserIds.includes(user.id)
  ).length;
  const followingCount = Array.isArray(user.followingUserIds)
    ? user.followingUserIds.length
    : 0;

  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    avatarInitials: user.avatarInitials,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    website: user.website,
    roles: user.roles,
    // Genuine verification badge only when server-verified via Google Identity Services
    verifiedIdentity: Boolean(
      user.authMode === "google_verified" && user.googleIdentity?.verifiedByGoogleToken
    ),
    privacy: user.privacy || {
      showFollowing: true,
      showSavedPosts: false,
      allowDirectMessages: true,
    },
    store: store
      ? {
          id: store.id,
          slug: store.slug,
          name: store.name,
          tagline: store.tagline,
          initials: store.initials,
          accentColor: store.accentColor,
          verificationStatus: store.verificationStatus,
          listingCount: publishedListingCount,
        }
      : null,
    stats: {
      postCount,
      commentCount,
      followerCount,
      followingCount,
    },
    createdAt: user.createdAt,
  };
}

export function findActiveUserByHandle(
  db: WiserdDatabase,
  handle: string
): User | null {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return null;
  return (
    db.users.find(
      (u) => u.status === "active" && u.handle.toLowerCase() === normalized
    ) || null
  );
}
