import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.WISERD_TEST_URL || "http://localhost:3000";

async function main() {
  console.log(`Running WISERD end-to-end & security verification against ${BASE}...`);

  // 1. Homepage, security headers, and dynamic SEO files
  const homeRes = await fetch(`${BASE}/`);
  assert.equal(homeRes.status, 200, "Homepage should return HTTP 200");
  assert.equal(homeRes.headers.get("x-frame-options"), "DENY", "Must emit X-Frame-Options: DENY");
  assert.equal(
    homeRes.headers.get("x-content-type-options"),
    "nosniff",
    "Must emit X-Content-Type-Options: nosniff"
  );
  assert.ok(homeRes.headers.get("content-security-policy"), "Must emit Content-Security-Policy");
  assert.equal(homeRes.headers.get("x-powered-by"), null, "Must hide X-Powered-By header");

  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes("WISERD"), "Homepage must include WISERD brand");
  const cssMatch = homeHtml.match(/href="(\/_next\/static\/chunks\/[^"]+\.css)"/);
  assert.ok(cssMatch, "Homepage must link compiled Next.js stylesheet");
  const cssText = await (await fetch(`${BASE}${cssMatch[1]}`)).text();
  assert.ok(
    cssText.includes("--font-bricolage") && cssText.includes("--font-barlow"),
    "Compiled stylesheet must define --font-bricolage and --font-barlow"
  );

  // 1b. Phase 20 Foundation: /api/health & privacy-safe /api/profiles
  const healthRes = await fetch(`${BASE}/api/health`);
  assert.equal(healthRes.status, 200, "/api/health must return HTTP 200");
  const healthData = await healthRes.json();
  assert.equal(healthData.ok, true, "/api/health must report ok: true");
  assert.equal(healthData.schemaVersion, "20", "/api/health must report schemaVersion 20");
  assert.equal(healthData.dbReadable, true, "/api/health must report dbReadable: true");
  assert.ok(healthData.counts.activeUsers >= 1, "/api/health must count active users");

  const profilesRes = await fetch(`${BASE}/api/profiles`);
  assert.equal(profilesRes.status, 200, "/api/profiles must return HTTP 200");
  const profilesData = await profilesRes.json();
  assert.ok(
    Array.isArray(profilesData.profiles) && profilesData.profiles.length >= 1,
    "/api/profiles must list active public profiles"
  );

  const alexRes = await fetch(`${BASE}/api/profiles?handle=alex-rivera`);
  assert.equal(alexRes.status, 200, "/api/profiles?handle=alex-rivera must return 200");
  const alexData = await alexRes.json();
  assert.equal(alexData.profile.handle, "alex-rivera");
  assert.equal(alexData.profile.email, undefined, "Public profile must NEVER expose email");
  assert.equal(alexData.profile.addresses, undefined, "Public profile must NEVER expose addresses");
  assert.equal(
    alexData.profile.googleIdentity,
    undefined,
    "Public profile must NEVER expose googleIdentity"
  );
  assert.equal(alexData.profile.wallets, undefined, "Public profile must NEVER expose wallets");
  assert.equal(
    alexData.profile.verifiedIdentity,
    false,
    "Local sandbox user must NOT show verifiedIdentity badge"
  );

  const missingProfileRes = await fetch(`${BASE}/api/profiles?handle=nonexistent-member-xyz`);
  assert.equal(missingProfileRes.status, 404, "Unknown profile handle must return HTTP 404");

  const robotsRes = await fetch(`${BASE}/robots.txt`);
  assert.equal(robotsRes.status, 200, "/robots.txt must return 200");
  const sitemapRes = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200, "/sitemap.xml must return 200");

  // 2. Real HTTP 404 on invalid product/store slugs & unique page titles
  const badProd = await fetch(`${BASE}/products/nonexistent-slug-check`);
  assert.equal(badProd.status, 404, "Invalid product slug must return HTTP 404");
  const badStore = await fetch(`${BASE}/stores/nonexistent-store-check`);
  assert.equal(badStore.status, 404, "Invalid store slug must return HTTP 404");

  const mktHtml = await (await fetch(`${BASE}/marketplace`)).text();
  assert.ok(mktHtml.includes("<title>Marketplace | WISERD</title>"), "Unique marketplace title required");

  // 3. Integration status, private cache headers, store privacy & unauthenticated includeAll=true protection
  const sessRes = await fetch(`${BASE}/api/auth/session`);
  assert.equal(sessRes.status, 200);
  assert.ok(
    (sessRes.headers.get("cache-control") || "").includes("no-store"),
    "/api/auth/session must emit Cache-Control: no-store"
  );
  const sessData = await sessRes.json();
  assert.equal(sessData.authenticated, false);
  assert.equal(sessData.integrations.fiatPaymentProvider.configured, false);
  assert.equal(sessData.integrations.onchainEscrow.configured, false);

  const pubStores = await (await fetch(`${BASE}/api/stores`)).json();
  assert.ok(Array.isArray(pubStores.stores) && pubStores.stores.length >= 1);
  assert.equal(
    pubStores.stores[0].totalSalesCents,
    undefined,
    "Public /api/stores must NEVER expose private seller totalSalesCents"
  );
  assert.equal(
    pubStores.stores[0].storageUsedMb,
    undefined,
    "Public /api/stores must NEVER expose internal storageUsedMb"
  );

  const rainbowIconRes = await fetch(`${BASE}/brand/rainbow.svg`);
  assert.equal(rainbowIconRes.status, 200, "/brand/rainbow.svg must be served");
  const webpCatalogRes = await fetch(`${BASE}/catalog/brand-service.webp`);
  assert.equal(webpCatalogRes.status, 200, "/catalog/brand-service.webp must be served");
  const kbWebpRes = await fetch(`${BASE}/catalog/keyboard.webp`);
  assert.equal(kbWebpRes.status, 200, "/catalog/keyboard.webp must be served");

  const pubAll = await (await fetch(`${BASE}/api/products?includeAll=true`)).json();
  assert.ok(
    pubAll.products.every((p) => p.status === "published"),
    "Unauthenticated includeAll=true must only return published products"
  );

  // 4. Malformed JSON returns 400 (never 500) + per-IP rate limit isolation + honest Supabase status
  assert.equal(
    healthData.integrations.supabase,
    healthData.storageBackend === "supabase_postgres",
    "/api/health supabase flag must match active storageBackend"
  );

  const badJsonAuth = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.10" },
    body: "{bad-json",
  });
  assert.equal(badJsonAuth.status, 400, "Malformed JSON on auth must return 400");

  // Exhaust rate limit for one synthetic IP and verify another IP is NOT locked out
  const floodIp = `203.0.113.${100 + Math.floor(Math.random() * 100)}`;
  let got429 = false;
  for (let i = 0; i < 31; i++) {
    const r = await fetch(`${BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": floodIp },
      body: "{bad-json",
    });
    if (r.status === 429) {
      got429 = true;
      break;
    }
  }
  assert.equal(got429, true, "Single IP exceeding 30 auth requests/min must receive HTTP 429");

  const otherIpRes = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.77" },
    body: "{bad-json",
  });
  assert.equal(
    otherIpRes.status,
    400,
    "Rate limiting one IP must NOT lock out other IPs from /api/auth/google"
  );

  // Verify smart contract hardening invariants (two-step rotation, SafeERC20, ReentrancyGuard)
  const tokenSol = fs.readFileSync(
    path.resolve("contracts/WiserdEnterpriseCurrency.sol"),
    "utf8"
  );
  const routerSol = fs.readFileSync(
    path.resolve("contracts/WiserdCommerceRouter.sol"),
    "utf8"
  );
  assert.ok(
    tokenSol.includes("proposeTreasuryAdmin") && tokenSol.includes("acceptTreasuryAdmin"),
    "WiserdEnterpriseCurrency must implement two-step treasury admin rotation"
  );
  assert.ok(
    routerSol.includes("nonReentrant") &&
      routerSol.includes("_safeTransferFrom") &&
      routerSol.includes("token.code.length > 0") &&
      routerSol.includes("acceptOwnership") &&
      routerSol.includes("setProtocolTreasury") &&
      routerSol.includes("setProtocolFeeBps"),
    "WiserdCommerceRouter must enforce ReentrancyGuard, safe ERC-20 transferFrom, and admin rotation"
  );

  // 5. Local sandbox login (requires WISERD_ENABLE_LOCAL_SANDBOX=true when running next start)
  const loginRes = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local_sandbox", sandboxUserId: "usr_demo_member" }),
  });
  if (loginRes.status === 403) {
    console.log("Local sandbox properly locked (HTTP 403); skipping authenticated sandbox tests.");
    console.log("ALL PUBLIC SECURITY & ROUTE CHECKS PASSED.");
    return;
  }
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get("set-cookie") || "";
  assert.ok(setCookie.includes("wiserd_session="), "Must set wiserd_session cookie");
  assert.ok(setCookie.toLowerCase().includes("httponly"), "Cookie must be HttpOnly");
  const cookie = setCookie.split(";")[0];

  // Malformed JSON on authenticated orders route must return 400 (not 500)
  const badJsonOrders = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: "{malformed",
  });
  assert.equal(badJsonOrders.status, 400, "Malformed JSON on /api/orders must return 400");

  // 6. Cryptographic EIP-191 ecrecover wallet verification (forged rejected, real signed accepted)
  const account = privateKeyToAccount(generatePrivateKey());
  const nonceRes = await fetch(`${BASE}/api/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "nonce", address: account.address }),
  });
  assert.equal(nonceRes.status, 200);
  const { message } = await nonceRes.json();

  const forgedRes = await fetch(`${BASE}/api/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "verify",
      address: account.address,
      signature: `0x${"a".repeat(130)}`,
    }),
  });
  assert.equal(forgedRes.status, 400, "Forged wallet signature must be rejected by ecrecover");

  const realSig = await account.signMessage({ message });
  const verifyRes = await fetch(`${BASE}/api/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "verify",
      address: account.address,
      walletName: "Test EIP-1193 Signer",
      chainId: "0x1",
      signature: realSig,
    }),
  });
  assert.equal(verifyRes.status, 200, "Real EIP-191 signed challenge must succeed");
  const { wallet: linkedWallet } = await verifyRes.json();
  // Clean up test wallet
  await fetch(`${BASE}/api/wallet?id=${encodeURIComponent(linkedWallet.id)}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });

  // 7. Multi-store shipping consistency + cancellation stock restoration
  const beforeMat = (
    await (await fetch(`${BASE}/api/products?slug=merino-felt-architectural-desk-mat`)).json()
  ).product;
  const multiRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items: [
        { productId: "prod_desk_pad", quantity: 1 },
        { productId: "prod_game_controller", quantity: 1 },
      ],
      paymentMethod: "fiat_escrow",
      shippingAddress: {
        recipient: "Alex Rivera",
        line1: "420 Market St",
        city: "San Francisco",
        country: "United States",
        postalCode: "94105",
      },
    }),
  });
  assert.equal(multiRes.status, 201, "Multi-store checkout should create 2 orders");
  const multiData = await multiRes.json();
  assert.equal(multiData.orders.length, 2, "Cart spanning 2 stores must create 2 orders");
  const padOrder = multiData.orders.find((o) => o.storeId === "store_atelier_nord");
  const ctrlOrder = multiData.orders.find((o) => o.storeId === "store_arcadia_guild");
  assert.equal(padOrder.shippingCents, 1200, "Store < $100 physical must charge $12 even when combined cart > $100");
  assert.equal(ctrlOrder.shippingCents, 0, "Store >= $100 physical qualifies for free tracked shipping");

  // Illegal state jump (completing unpaid order) must be rejected
  const illegalRelease = await fetch(`${BASE}/api/orders`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      orderId: multiData.orders[0].id,
      action: "buyer_confirm_completion",
    }),
  });
  assert.equal(illegalRelease.status, 400, "Cannot release unpaid order");

  // Cancel both orders & confirm inventory was restored
  for (const ord of multiData.orders) {
    const cancelRes = await fetch(`${BASE}/api/orders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ orderId: ord.id, action: "cancel_order" }),
    });
    assert.equal(cancelRes.status, 200);
  }
  const afterMat = (
    await (await fetch(`${BASE}/api/products?slug=merino-felt-architectural-desk-mat`)).json()
  ).product;
  assert.equal(afterMat.stock, beforeMat.stock, "Cancelling unpaid order must restore product stock");

  // 8. Digital order + full legal escrow lifecycle + review uniqueness
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items: [{ productId: "prod_ui_kit", variationId: "var_ui_solo", quantity: 1 }],
      paymentMethod: "fiat_escrow",
    }),
  });
  assert.equal(orderRes.status, 201);
  const createdOrder = (await orderRes.json()).orders[0];

  for (const step of [
    { action: "confirm_preview_payment", expected: "Escrow Active" },
    { action: "submit_fulfillment", fulfillmentNote: "Unlocked.", expected: "Awaiting Buyer Confirmation" },
    { action: "buyer_confirm_completion", expected: "Released" },
  ]) {
    const r = await fetch(`${BASE}/api/orders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ orderId: createdOrder.id, ...step }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).order.escrowStatus, step.expected);
  }

  const rev1 = await fetch(`${BASE}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      productId: "prod_ui_kit",
      orderId: createdOrder.id,
      rating: 5,
      comment: "Clean Figma variables and accessible React components.",
    }),
  });
  assert.equal(rev1.status, 201);

  const revDup = await fetch(`${BASE}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      productId: "prod_ui_kit",
      orderId: createdOrder.id,
      rating: 5,
      comment: "Duplicate review attempt.",
    }),
  });
  assert.equal(revDup.status, 400);

  // 8b. Server hardening: Messages cache/self-DM guard, Admin RBAC, Dispute double-resolve guard, & Report enforcement
  const msgGetRes = await fetch(`${BASE}/api/messages`, { headers: { Cookie: cookie } });
  assert.equal(msgGetRes.status, 200);
  assert.ok(
    (msgGetRes.headers.get("cache-control") || "").includes("no-store"),
    "/api/messages must emit Cache-Control: no-store"
  );
  const selfDmRes = await fetch(`${BASE}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "start_or_send", recipientUserId: "usr_demo_member", text: "hi" }),
  });
  assert.equal(selfDmRes.status, 400, "Self-DM must be rejected with HTTP 400");

  // Non-admin seller cannot access /api/admin
  const sellerLogin = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local_sandbox", sandboxUserId: "usr_seller_atelier" }),
  });
  const sellerCookie = (sellerLogin.headers.get("set-cookie") || "").split(";")[0];
  const nonAdminGet = await fetch(`${BASE}/api/admin`, { headers: { Cookie: sellerCookie } });
  assert.equal(nonAdminGet.status, 403, "Non-admin GET /api/admin must return 403");
  const nonAdminPost = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({ action: "verify_store", targetId: "store_meridian_craft", value: "verified" }),
  });
  assert.equal(nonAdminPost.status, 403, "Non-admin POST /api/admin must return 403");

  // International seller payout setup + strict public privacy protection
  const badCryptoPayout = await fetch(`${BASE}/api/stores`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({
      action: "update_payout",
      provider: "crypto_wallet",
      accountHolder: "Nadia Vance",
      destination: "not-a-valid-address",
    }),
  });
  assert.equal(badCryptoPayout.status, 400, "Invalid EVM payout address must return 400");

  const savePaypalPayout = await fetch(`${BASE}/api/stores`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({
      action: "update_payout",
      provider: "paypal",
      accountHolder: "Nadia Vance",
      destination: "payouts@atelier-nord.example",
    }),
  });
  assert.equal(savePaypalPayout.status, 200, "Valid PayPal payout destination must save");
  const savedMine = await (
    await fetch(`${BASE}/api/stores?mine=true`, { headers: { Cookie: sellerCookie } })
  ).json();
  assert.equal(savedMine.store.payoutStatus, "pending");
  assert.equal(savedMine.store.payoutDestination.provider, "paypal");

  const pubStoreAfterPayout = await (
    await fetch(`${BASE}/api/stores?slug=atelier-nord`)
  ).json();
  assert.equal(
    pubStoreAfterPayout.store.payoutDestination,
    undefined,
    "Public /api/stores?slug=... must NEVER expose seller payoutDestination"
  );

  // Dispute double-resolve must be rejected (no double stock restoration)
  const stockBeforeDispute = (
    await (await fetch(`${BASE}/api/products?slug=merino-felt-architectural-desk-mat`)).json()
  ).product.stock;
  const dispOrderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      items: [{ productId: "prod_desk_pad", quantity: 1 }],
      paymentMethod: "fiat_escrow",
      shippingAddress: {
        recipient: "Alex Rivera",
        line1: "420 Market St",
        city: "San Francisco",
        country: "United States",
        postalCode: "94105",
      },
    }),
  });
  assert.equal(dispOrderRes.status, 201);
  const dispOrder = (await dispOrderRes.json()).orders[0];
  for (const step of [
    { action: "confirm_preview_payment" },
    { action: "submit_fulfillment", trackingNumber: "TRK-TEST-1" },
    { action: "open_dispute", disputeReason: "Item not as described", buyerStatement: "Test dispute" },
  ]) {
    const r = await fetch(`${BASE}/api/orders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ orderId: dispOrder.id, ...step }),
    });
    assert.equal(r.status, 200);
  }
  const adminSnap = await (await fetch(`${BASE}/api/admin`, { headers: { Cookie: cookie } })).json();
  const activeDispute = adminSnap.disputes.find((d) => d.orderId === dispOrder.id);
  assert.ok(activeDispute, "Dispute record must exist in /api/admin");
  const badResolve = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "resolve_dispute", targetId: activeDispute.id, value: "invalid" }),
  });
  assert.equal(badResolve.status, 400, "Invalid dispute outcome must return 400");
  const firstResolve = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "resolve_dispute", targetId: activeDispute.id, value: "refund" }),
  });
  assert.equal(firstResolve.status, 200);
  const secondResolve = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "resolve_dispute", targetId: activeDispute.id, value: "refund" }),
  });
  assert.equal(secondResolve.status, 400, "Double-resolving dispute must be rejected with 400");
  const stockAfterDispute = (
    await (await fetch(`${BASE}/api/products?slug=merino-felt-architectural-desk-mat`)).json()
  ).product.stock;
  assert.equal(stockAfterDispute, stockBeforeDispute, "Refunded dispute must restore stock exactly once");

  // Moderation report action_taken actually removes reported community post & rejects re-resolution
  const tmpPostRes = await fetch(`${BASE}/api/community`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "create_post",
      title: "Temporary moderation test post",
      body: "Testing server-side moderation enforcement.",
      roomId: "room_general",
    }),
  });
  assert.equal(tmpPostRes.status, 200);
  const tmpPost = (await tmpPostRes.json()).post;
  await fetch(`${BASE}/api/community`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sellerCookie },
    body: JSON.stringify({ action: "report_post", postId: tmpPost.id, reportReason: "Test spam" }),
  });
  const snapWithRep = await (await fetch(`${BASE}/api/admin`, { headers: { Cookie: cookie } })).json();
  const postReport = snapWithRep.reports.find((r) => r.entityId === tmpPost.id);
  assert.ok(postReport, "Reported post must appear in /api/admin reports");
  const enforceRep = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "update_report", targetId: postReport.id, value: "action_taken" }),
  });
  assert.equal(enforceRep.status, 200);
  const reEnforceRep = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "update_report", targetId: postReport.id, value: "dismissed" }),
  });
  assert.equal(reEnforceRep.status, 400, "Already-resolved report must reject re-resolution");
  const commAfter = await (await fetch(`${BASE}/api/community`)).json();
  assert.ok(
    !commAfter.posts.some((p) => p.id === tmpPost.id),
    "action_taken on reported post must actually remove post from public /api/community"
  );

  // 9. Verify all primary routes return HTTP 200
  for (const route of [
    "/marketplace",
    "/products/nord-65-anodized-mechanical-keyboard",
    "/stores/atelier-nord",
    "/sell",
    "/cart",
    "/checkout",
    "/orders",
    "/community",
    "/messages",
    "/account",
    "/wallet",
    "/admin",
  ]) {
    const r = await fetch(`${BASE}${route}`);
    assert.equal(r.status, 200, `Route ${route} should return HTTP 200`);
  }

  console.log("ALL WISERD VERIFICATION & SECURITY CHECKS PASSED.");
}

main().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
