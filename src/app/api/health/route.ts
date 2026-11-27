import { NextResponse } from "next/server";
import { ensureSupabaseHydrated, getStorageBackend, readDb } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/integrations";

export async function GET() {
  try {
    const supabaseConnected = await ensureSupabaseHydrated();
    const db = readDb();
    const integrations = getIntegrationStatus();

    return NextResponse.json({
      ok: true,
      schemaVersion: "20",
      dbReadable: true,
      storageBackend: getStorageBackend(),
      supabaseConnected,
      counts: {
        activeUsers: db.users.filter((u) => u.status === "active").length,
        stores: db.stores.length,
        publishedProducts: db.products.filter((p) => p.status === "published").length,
        activePosts: db.posts.filter((p) => p.status !== "removed").length,
      },
      integrations: {
        googleIdentityServices: integrations.googleIdentityServices.configured,
        supabase: integrations.supabase.configured,
        fiatPaymentProvider: integrations.fiatPaymentProvider.configured,
        onchainEscrow: integrations.onchainEscrow.configured,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, schemaVersion: "20", dbReadable: false },
      { status: 503 }
    );
  }
}
