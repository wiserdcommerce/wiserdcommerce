import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDb } from "@/lib/db";
import ProductDetailClient from "@/components/products/product-detail-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = readDb();
  const product = db.products.find(
    (p) => (p.slug === slug || p.id === slug) && p.status === "published"
  );
  if (!product) {
    return { title: "Listing Not Found" };
  }
  return {
    title: product.title,
    description: product.summary,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = readDb();
  const exists = db.products.some(
    (p) => (p.slug === slug || p.id === slug) && p.status === "published"
  );
  if (!exists) {
    notFound();
  }
  return <ProductDetailClient />;
}
