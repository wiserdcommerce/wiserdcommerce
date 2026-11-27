import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDb } from "@/lib/db";
import StorefrontClient from "@/components/stores/storefront-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = readDb();
  const store = db.stores.find((s) => s.slug === slug || s.id === slug);
  if (!store) {
    return { title: "Store Not Found" };
  }
  return {
    title: store.name,
    description: store.tagline,
  };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = readDb();
  const exists = db.stores.some((s) => s.slug === slug || s.id === slug);
  if (!exists) {
    notFound();
  }
  return <StorefrontClient />;
}
