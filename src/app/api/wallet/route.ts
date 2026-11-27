import crypto from "crypto";
import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import {
  checkRateLimit,
  getServerSession,
  parseJsonBody,
  requireActiveUser,
} from "@/lib/auth-session";
import { mutateDb, makeId, readDb } from "@/lib/db";

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_SIG_RE = /^0x[a-fA-F0-9]{130,}$/;

const KNOWN_NETWORKS: Record<string, string> = {
  "0x1": "Ethereum Mainnet",
  "0x2105": "Base Mainnet",
  "0x14a34": "Base Sepolia",
  "0xaa36a7": "Ethereum Sepolia",
  "0x89": "Polygon PoS",
  "0xa4b1": "Arbitrum One",
  "0xa": "OP Mainnet",
};

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ wallets: [] });
  }
  const db = readDb();
  const active = requireActiveUser(db, session);
  if ("error" in active) {
    return NextResponse.json({ error: active.error }, { status: active.status });
  }
  const wallets = db.wallets.filter(
    (w) => w.userId === session.userId && w.status === "connected"
  );
  return NextResponse.json({ wallets });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      {
        error:
          "Sign in to your WISERD account first before linking a blockchain wallet to your profile.",
      },
      { status: 401 }
    );
  }

  const limited = checkRateLimit(`wallet:${session.userId}`, 25, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonBody<{
    action: "nonce" | "verify";
    address?: string;
    walletName?: string;
    chainId?: string;
    signature?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const address = body.address?.trim();
  if (!address || !ETH_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: "A valid EVM public address (0x...) is required." },
      { status: 400 }
    );
  }

  const normalizedAddr = address.toLowerCase();

  if (body.action === "nonce") {
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const message = [
      "WISERD Wallet Ownership Verification",
      "",
      "Signing this message proves that you control this public wallet address and links it to your WISERD account.",
      "This signature does NOT authorize any payment, token transfer, or smart contract transaction.",
      "",
      `Address: ${address}`,
      `Nonce: ${nonce}`,
      `Issued: ${new Date().toISOString()}`,
    ].join("\n");

    const res = await mutateDb((db) => {
      const active = requireActiveUser(db, session);
      if ("error" in active) return active;
      db.walletNonces[`${session.userId}:${normalizedAddr}`] = {
        nonce,
        message,
        userId: session.userId,
        address: normalizedAddr,
        expiresAt,
      };
      return { ok: true as const };
    });

    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ nonce, message, expiresAt });
  }

  if (body.action === "verify") {
    const signature = body.signature?.trim();
    if (!signature || !HEX_SIG_RE.test(signature)) {
      return NextResponse.json(
        { error: "Valid EIP-191 wallet signature is required to verify address ownership." },
        { status: 400 }
      );
    }

    const dbSnap = readDb();
    const activeCheck = requireActiveUser(dbSnap, session);
    if ("error" in activeCheck) {
      return NextResponse.json({ error: activeCheck.error }, { status: activeCheck.status });
    }

    const key = `${session.userId}:${normalizedAddr}`;
    const challenge = dbSnap.walletNonces[key];
    if (!challenge || challenge.expiresAt < Date.now() || !challenge.message) {
      return NextResponse.json(
        { error: "Verification challenge expired. Please request a fresh signature." },
        { status: 400 }
      );
    }

    // Cryptographic EIP-191 ecrecover verification via viem
    let validSignature = false;
    try {
      validSignature = await verifyMessage({
        address: address as `0x${string}`,
        message: challenge.message,
        signature: signature as `0x${string}`,
      });
    } catch {
      validSignature = false;
    }

    if (!validSignature) {
      return NextResponse.json(
        { error: "Wallet signature did not match the claimed address." },
        { status: 400 }
      );
    }

    const chainId = (body.chainId || "0x1").toLowerCase();
    const networkName = KNOWN_NETWORKS[chainId] || `Network (${chainId})`;
    const walletName = body.walletName?.trim() || "Injected Web3 Wallet";

    const result = await mutateDb((db) => {
      const active = requireActiveUser(db, session);
      if ("error" in active) return active;

      const record = db.walletNonces[key];
      if (!record || record.nonce !== challenge.nonce || record.expiresAt < Date.now()) {
        return {
          error: "Verification challenge was already used or expired.",
          status: 400 as const,
        };
      }
      delete db.walletNonces[key];

      const now = new Date().toISOString();
      const existing = db.wallets.find(
        (w) => w.userId === session.userId && w.address.toLowerCase() === normalizedAddr
      );

      if (existing) {
        existing.walletName = walletName;
        existing.chainId = chainId;
        existing.networkName = networkName;
        existing.ownershipVerified = true;
        existing.signaturePreview = `${signature.slice(0, 12)}...${signature.slice(-6)}`;
        existing.status = "connected";
        existing.connectedAt = now;
        return { wallet: existing };
      }

      const wallet = {
        id: makeId("wal"),
        userId: session.userId,
        address,
        walletName,
        chainId,
        networkName,
        ownershipVerified: true,
        signaturePreview: `${signature.slice(0, 12)}...${signature.slice(-6)}`,
        status: "connected" as const,
        connectedAt: now,
      };
      db.wallets.push(wallet);
      db.auditLogs.unshift({
        id: makeId("audit"),
        actorId: session.userId,
        actorName: active.user.displayName,
        action: "wallet.linked",
        targetType: "wallet",
        targetId: wallet.id,
        details: `Verified and linked ${walletName} (${address.slice(0, 6)}...${address.slice(-4)}) on ${networkName}.`,
        createdAt: now,
      });
      return { wallet };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ wallet: result.wallet });
  }

  return NextResponse.json({ error: "Unsupported wallet action." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = await parseJsonBody<{
    action: "set_active" | "update_network";
    walletId?: string;
    address?: string;
    chainId?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;

    const userWallets = db.wallets.filter(
      (w) => w.userId === session.userId && w.status === "connected"
    );

    if (body.action === "set_active" && body.walletId) {
      const idx = db.wallets.findIndex(
        (w) => w.id === body.walletId && w.userId === session.userId && w.status === "connected"
      );
      if (idx === -1) return { error: "Wallet record not found.", status: 404 as const };
      const [chosen] = db.wallets.splice(idx, 1);
      db.wallets.unshift(chosen);
      return { wallet: chosen };
    }

    if (body.action === "update_network" && body.chainId) {
      const normalizedChain = body.chainId.toLowerCase();
      const networkName = KNOWN_NETWORKS[normalizedChain] || `Network (${normalizedChain})`;
      const target = body.address
        ? userWallets.find((w) => w.address.toLowerCase() === body.address?.toLowerCase())
        : userWallets[0];
      if (!target) return { error: "Wallet record not found.", status: 404 as const };
      target.chainId = normalizedChain;
      target.networkName = networkName;
      return { wallet: target };
    }

    return { error: "Wallet record not found.", status: 404 as const };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ wallet: result.wallet });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get("id");

  const result = await mutateDb((db) => {
    const active = requireActiveUser(db, session);
    if ("error" in active) return active;
    db.wallets.forEach((w) => {
      if (w.userId === session.userId && (!walletId || w.id === walletId)) {
        w.status = "disconnected";
      }
    });
    return { ok: true };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
