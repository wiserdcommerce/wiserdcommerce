import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, readDb, makeId } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/integrations";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in as an administrator." }, { status: 401 });
  }
  const db = readDb();
  const active = requireActiveUser(db, session);
  if ("error" in active) {
    return NextResponse.json({ error: active.error }, { status: active.status });
  }
  const actor = active.user;
  if (!actor.roles.includes("admin")) {
    return NextResponse.json(
      { error: "Administrator permission is required to access this workspace." },
      { status: 403 }
    );
  }

  return NextResponse.json(
    {
      users: db.users.map((u) => ({ ...u, addresses: [] })),
      stores: db.stores,
      products: db.products,
      orders: db.orders,
      disputes: db.disputes,
      reports: db.reports,
      auditLogs: db.auditLogs.slice(0, 60),
      integrations: getIntegrationStatus(),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const limited = checkRateLimit(`admin:${session.userId}`, 60, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action:
      | "verify_store"
      | "moderate_product"
      | "resolve_dispute"
      | "update_report"
      | "toggle_user_status";
    targetId: string;
    value?: string;
    note?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    const admin = active.user;
    if (!admin.roles.includes("admin")) {
      return { error: "Administrator permission required.", status: 403 as const };
    }
    const now = new Date().toISOString();

    if (body.action === "verify_store") {
      const store = db.stores.find((s) => s.id === body.targetId);
      if (!store) return { error: "Store not found.", status: 404 as const };
      if (
        body.value !== undefined &&
        body.value !== "verified" &&
        body.value !== "pending" &&
        body.value !== "action_required"
      ) {
        return { error: "Invalid store verification status.", status: 400 as const };
      }
      const next = body.value || "verified";
      store.verificationStatus = next;
      db.notifications.unshift({
        id: makeId("notif"),
        recipientId: store.ownerId,
        eventType: "seller_verification",
        title: `Store verification updated: ${next.replace("_", " ")}`,
        body:
          body.note?.trim() ||
          `Administrator updated ${store.name} verification status to ${next.replace("_", " ")}.`,
        href: "/sell",
        importantTransaction: false,
        read: false,
        createdAt: now,
      });
      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: admin.id,
        actorName: admin.displayName,
        action: `store.verification_${next}`,
        targetType: "store",
        targetId: store.id,
        details: `Set ${store.name} verification status to ${next}. ${body.note || ""}`.trim(),
        createdAt: now,
      });
      return { store };
    }

    if (body.action === "moderate_product") {
      const prod = db.products.find((p) => p.id === body.targetId);
      if (!prod) return { error: "Listing not found.", status: 404 as const };
      if (
        body.value !== undefined &&
        body.value !== "published" &&
        body.value !== "paused" &&
        body.value !== "moderated"
      ) {
        return { error: "Invalid product moderation status.", status: 400 as const };
      }
      const next = body.value || "moderated";
      prod.status = next;
      const store = db.stores.find((s) => s.id === prod.storeId);
      if (store && next === "moderated") {
        db.notifications.unshift({
          id: makeId("notif"),
          recipientId: store.ownerId,
          eventType: "moderation",
          title: `Listing placed on hold: ${prod.title}`,
          body: body.note?.trim() || "An administrator placed this listing under moderation review.",
          href: "/sell",
          importantTransaction: false,
          read: false,
          createdAt: now,
        });
      }
      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: admin.id,
        actorName: admin.displayName,
        action: `listing.status_${next}`,
        targetType: "product",
        targetId: prod.id,
        details: `Updated listing "${prod.title}" status to ${next}. ${body.note || ""}`.trim(),
        createdAt: now,
      });
      return { product: prod };
    }

    if (body.action === "resolve_dispute") {
      const dispute = db.disputes.find((d) => d.id === body.targetId);
      if (!dispute) return { error: "Dispute not found.", status: 404 as const };
      if (dispute.status !== "open" && dispute.status !== "under_review") {
        return { error: "Dispute has already been resolved.", status: 400 as const };
      }
      if (body.value !== "refund" && body.value !== "release") {
        return { error: "Dispute resolution must specify 'refund' or 'release'.", status: 400 as const };
      }
      const order = db.orders.find((o) => o.id === dispute.orderId);
      const outcome =
        body.value === "refund" ? "resolved_refund" : "resolved_release";
      dispute.status = outcome;
      dispute.resolutionNote =
        body.note?.trim() ||
        (outcome === "resolved_refund"
          ? "Administrator resolved dispute in favor of buyer refund."
          : "Administrator resolved dispute and authorized seller release.");
      dispute.resolvedBy = admin.displayName;
      dispute.resolvedAt = now;

      if (order) {
        order.escrowStatus =
          outcome === "resolved_refund" ? "Refund Completed" : "Released";
        order.payoutStatus =
          outcome === "resolved_refund" ? "held" : "pending_provider";
        if (outcome === "resolved_refund") {
          for (const item of order.items) {
            const prod = db.products.find((p) => p.id === item.productId);
            if (prod && prod.stock < 999) {
              prod.stock += item.quantity;
              const v = item.variationId
                ? prod.variations.find((vr) => vr.id === item.variationId)
                : undefined;
              if (v && v.stock < 999) v.stock += item.quantity;
              if (prod.availability === "out_of_stock") {
                prod.availability = prod.stock <= 5 ? "limited" : "in_stock";
              }
            }
          }
        }
        order.escrowEvents.push({
          id: makeId("evt"),
          status: order.escrowStatus,
          actor: `Admin (${admin.displayName})`,
          note: dispute.resolutionNote,
          timestamp: now,
        });
        order.updatedAt = now;

        const store = db.stores.find((s) => s.id === order.storeId);
        const notifyTitle =
          outcome === "resolved_refund"
            ? `Dispute resolved (Refund): ${order.referenceCode}`
            : `Dispute resolved (Released): ${order.referenceCode}`;
        const recipientIds = Array.from(
          new Set([order.buyerId, store?.ownerId].filter((id): id is string => Boolean(id)))
        );
        for (const recipientId of recipientIds) {
          db.notifications.unshift({
            id: makeId("notif"),
            recipientId,
            eventType: outcome === "resolved_refund" ? "refund" : "dispute",
            title: notifyTitle,
            body: dispute.resolutionNote.slice(0, 140),
            href: `/orders/${order.id}`,
            importantTransaction: true,
            read: false,
            createdAt: now,
          });
        }
      }

      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: admin.id,
        actorName: admin.displayName,
        action: `dispute.${outcome}`,
        targetType: "dispute",
        targetId: dispute.id,
        details: `${dispute.orderReference}: ${dispute.resolutionNote}`,
        createdAt: now,
      });
      return { dispute, order };
    }

    if (body.action === "update_report") {
      const report = db.reports.find((r) => r.id === body.targetId);
      if (!report) return { error: "Report not found.", status: 404 as const };
      if (report.reviewStatus === "action_taken" || report.reviewStatus === "dismissed") {
        return { error: "Report has already been resolved.", status: 400 as const };
      }
      if (
        body.value !== undefined &&
        body.value !== "action_taken" &&
        body.value !== "dismissed" &&
        body.value !== "reviewed"
      ) {
        return { error: "Invalid report review status.", status: 400 as const };
      }
      report.reviewStatus = body.value || "reviewed";

      let enforcedSummary = "";
      if (report.reviewStatus === "action_taken") {
        if (report.entityType === "post") {
          const post = db.posts.find((p) => p.id === report.entityId);
          if (post && post.status !== "removed") {
            post.status = "removed";
            post.updatedAt = now;
            enforcedSummary = " Removed reported community post.";
            db.notifications.unshift({
              id: makeId("notif"),
              recipientId: post.authorId,
              eventType: "moderation",
              title: "Community post removed by moderation",
              body: body.note?.trim() || `Your post "${post.title}" was removed following review.`,
              href: "/community",
              importantTransaction: false,
              read: false,
              createdAt: now,
            });
          }
        } else if (report.entityType === "message") {
          const conv = db.conversations.find((c) => c.id === report.entityId);
          if (conv && conv.status !== "blocked") {
            conv.status = "blocked";
            conv.blockedBy = admin.id;
            enforcedSummary = " Blocked reported conversation.";
          }
        } else if (report.entityType === "product") {
          const prod = db.products.find((p) => p.id === report.entityId);
          if (prod && prod.status !== "moderated") {
            prod.status = "moderated";
            enforcedSummary = " Held reported listing for moderation.";
          }
        } else if (report.entityType === "store") {
          const store = db.stores.find((s) => s.id === report.entityId);
          if (store) {
            store.verificationStatus = "action_required";
            enforcedSummary = " Marked reported store as action required.";
          }
        } else if (report.entityType === "user") {
          const reportedUser = db.users.find((u) => u.id === report.entityId);
          if (
            reportedUser &&
            reportedUser.id !== admin.id &&
            !reportedUser.roles.includes("admin")
          ) {
            reportedUser.status = "suspended";
            enforcedSummary = " Suspended reported account.";
          }
        }
      }

      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: admin.id,
        actorName: admin.displayName,
        action: `report.${report.reviewStatus}`,
        targetType: "report",
        targetId: report.id,
        details: `Marked report on ${report.entityLabel} as ${report.reviewStatus}.${enforcedSummary}`.trim(),
        createdAt: now,
      });
      return { report };
    }

    if (body.action === "toggle_user_status") {
      const target = db.users.find((u) => u.id === body.targetId);
      if (!target) return { error: "User not found.", status: 404 as const };
      if (target.id === admin.id) {
        return { error: "Cannot suspend your own administrator account.", status: 400 as const };
      }
      target.status = target.status === "active" ? "suspended" : "active";
      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: admin.id,
        actorName: admin.displayName,
        action: `user.status_${target.status}`,
        targetType: "user",
        targetId: target.id,
        details: `Changed ${target.displayName} account status to ${target.status}.`,
        createdAt: now,
      });
      return { user: target };
    }

    return { error: "Unsupported administrative action.", status: 400 as const };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }
  return NextResponse.json(result);
}
