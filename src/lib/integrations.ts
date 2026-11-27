import type { IntegrationStatus } from "./types";
import { isLocalSandboxAllowed } from "./auth-session";

export function getIntegrationStatus(): IntegrationStatus {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;
  const supabaseEnvPresent = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
  const paymentProvider = process.env.WISERD_PAYMENT_PROVIDER?.trim() || null;
  const paymentKey = process.env.WISERD_PAYMENT_API_KEY?.trim() || null;
  const fiatConfigured = Boolean(paymentProvider && paymentKey);

  const chainId = process.env.NEXT_PUBLIC_WALLET_CHAIN_ID?.trim() || null;
  const chainName = process.env.NEXT_PUBLIC_WALLET_CHAIN_NAME?.trim() || null;
  const contractAddress =
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS?.trim() || null;
  const tokenSymbol = process.env.NEXT_PUBLIC_ESCROW_TOKEN_SYMBOL?.trim() || null;
  const onchainConfigured = Boolean(chainId && contractAddress && tokenSymbol);

  return {
    googleIdentityServices: {
      configured: Boolean(googleClientId),
      clientId: googleClientId,
      note: googleClientId
        ? "Google Identity Services is configured with server-side ID token verification."
        : "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local to activate official Google Identity Services sign-in.",
    },
    supabase: {
      configured: Boolean(supabaseEnvPresent && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      note:
        supabaseEnvPresent && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
          ? "Connected to Supabase Postgres & Realtime."
          : "Using local server-side JSON persistence (.wiserd-data/db.json). Configure Supabase env vars in .env.local to activate Postgres & Realtime.",
    },
    fiatPaymentProvider: {
      configured: fiatConfigured,
      providerName: paymentProvider,
      note: fiatConfigured
        ? `Connected to ${paymentProvider} for verified fiat escrow settlement.`
        : "No fiat payment or licensed escrow partner is configured yet. Orders run in transparent Escrow Workflow Preview mode without live fund custody.",
    },
    onchainEscrow: {
      configured: onchainConfigured,
      chainId,
      chainName,
      contractAddress,
      tokenSymbol,
      note: onchainConfigured
        ? `Onchain escrow contract configured on ${chainName || chainId}.`
        : "Blockchain network, token, and audited escrow smart contract have not been configured yet. Wallet connection verifies address ownership only and does not lock funds onchain.",
    },
    localSandboxEnabled: isLocalSandboxAllowed(),
  };
}
