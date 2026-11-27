import { readDbAsync } from "@/lib/db";
import { HomeClient } from "@/components/home/home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await readDbAsync();
  const storeMap = new Map(db.stores.map((s) => [s.id, s]));

  const products = db.products
    .filter((p) => p.status === "published")
    .map((p) => {
      const store = storeMap.get(p.storeId);
      const pReviews = db.reviews.filter((r) => r.productId === p.id);
      const rating = pReviews.length
        ? Number(
            (pReviews.reduce((a, b) => a + b.rating, 0) / pReviews.length).toFixed(1)
          )
        : null;
      return {
        ...p,
        rating,
        reviewCount: pReviews.length,
        store: store
          ? {
              id: store.id,
              slug: store.slug,
              name: store.name,
              initials: store.initials,
              accentColor: store.accentColor,
              verificationStatus: store.verificationStatus,
              responseTimeLabel: store.responseTimeLabel,
            }
          : null,
      };
    });

  const stores = db.stores.map((s) => {
    const sReviews = db.reviews.filter((r) => r.storeId === s.id);
    return {
      ...s,
      listingCount: db.products.filter(
        (p) => p.storeId === s.id && p.status === "published"
      ).length,
      rating: sReviews.length
        ? Number(
            (sReviews.reduce((a, b) => a + b.rating, 0) / sReviews.length).toFixed(1)
          )
        : null,
      reviewCount: sReviews.length,
    };
  });

  const productMap = new Map(db.products.map((p) => [p.id, p]));
  const posts = db.posts
    .filter((p) => p.status === "active")
    .slice(0, 3)
    .map((post) => {
      const attached = post.attachedProductId
        ? productMap.get(post.attachedProductId) || null
        : null;
      return {
        ...post,
        attachedProduct: attached
          ? {
              id: attached.id,
              slug: attached.slug,
              title: attached.title,
              priceCents: attached.priceCents,
            }
          : null,
        commentCount: db.comments.filter((c) => c.postId === post.id).length,
      };
    });

  return (
    <HomeClient
      products={products}
      stores={stores}
      posts={posts}
      rooms={db.discussionRooms}
    />
  );
}
