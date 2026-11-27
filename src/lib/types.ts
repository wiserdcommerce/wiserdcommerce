export type ProductCategory = "physical" | "digital" | "gaming" | "services";

export type UserRole = "buyer" | "seller" | "admin";

export type EscrowStatus =
  | "Pending Payment"
  | "Payment Processing"
  | "Payment Confirmed"
  | "Escrow Active"
  | "Seller Processing"
  | "Shipped or Delivered"
  | "Awaiting Buyer Confirmation"
  | "Disputed"
  | "Refund Processing"
  | "Refund Completed"
  | "Release Processing"
  | "Released"
  | "Payout Processing"
  | "Paid Out"
  | "Cancelled"
  | "Payment Failed";

export interface ConnectedIdentity {
  provider: "google";
  sub: string;
  email: string;
  emailVerified: boolean;
  verifiedByGoogleToken: boolean;
  connectedAt: string;
}

export interface WalletLink {
  id: string;
  userId: string;
  address: string;
  walletName: string;
  chainId: string;
  networkName: string;
  ownershipVerified: boolean;
  signaturePreview?: string;
  status: "connected" | "disconnected";
  connectedAt: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipient: string;
  line1: string;
  city: string;
  country: string;
  postalCode: string;
}

export interface UserPrivacySettings {
  showFollowing: boolean;
  showSavedPosts: boolean;
  allowDirectMessages: boolean;
}

export interface User {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  avatarInitials: string;
  avatarUrl?: string;
  bio: string;
  location?: string;
  website?: string;
  roles: UserRole[];
  status: "active" | "suspended";
  authMode: "google_verified" | "local_sandbox";
  googleIdentity?: ConnectedIdentity;
  favoriteProductIds: string[];
  followedStoreIds: string[];
  followingUserIds: string[];
  savedPostIds: string[];
  addresses: SavedAddress[];
  privacy: UserPrivacySettings;
  createdAt: string;
}

export interface PublicUserProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarInitials: string;
  avatarUrl?: string;
  bio: string;
  location?: string;
  website?: string;
  roles: UserRole[];
  verifiedIdentity: boolean;
  privacy: UserPrivacySettings;
  store?: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    initials: string;
    accentColor: string;
    verificationStatus: "pending" | "verified" | "action_required";
    listingCount: number;
  } | null;
  stats: {
    postCount: number;
    commentCount: number;
    followerCount: number;
    followingCount: number;
  };
  createdAt: string;
}

export type PayoutProvider =
  | "paypal"
  | "wise"
  | "stripe_connect"
  | "payoneer"
  | "crypto_wallet";

export interface StorePayoutDestination {
  provider: PayoutProvider;
  accountHolder: string;
  destination: string;
  networkName?: string;
  walletVerified?: boolean;
  updatedAt: string;
}

export interface Store {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  initials: string;
  verificationStatus: "pending" | "verified" | "action_required";
  shippingPolicy: string;
  refundPolicy: string;
  payoutStatus: "unconfigured" | "pending" | "active";
  payoutDestination?: StorePayoutDestination;
  storageUsedMb: number;
  storageLimitMb: number;
  monthlyListingLimit: number;
  responseTimeLabel: string;
  followerCount: number;
  createdAt: string;
}

export interface ProductVariation {
  id: string;
  label: string;
  priceDeltaCents: number;
  stock: number;
}

export interface Product {
  id: string;
  storeId: string;
  slug: string;
  category: ProductCategory;
  productType: string;
  title: string;
  summary: string;
  description: string;
  priceCents: number;
  currency: "USD";
  stock: number;
  availability: "in_stock" | "limited" | "made_to_order" | "out_of_stock";
  escrowEligible: boolean;
  escrowConditions: string;
  deliveryInfo: string;
  refundConditions: string;
  specs: Record<string, string>;
  imageUrl: string;
  gallery: string[];
  variations: ProductVariation[];
  status: "draft" | "published" | "paused" | "moderated";
  featured?: boolean;
  popularScore: number;
  views: number;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

export interface OrderItemSnapshot {
  productId: string;
  productSlug: string;
  productTitle: string;
  category: ProductCategory;
  variationId?: string;
  variationLabel?: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  imageUrl: string;
}

export interface EscrowEvent {
  id: string;
  status: EscrowStatus;
  actor: string;
  note: string;
  timestamp: string;
}

export interface Order {
  id: string;
  referenceCode: string;
  buyerId: string;
  buyerName: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  items: OrderItemSnapshot[];
  requiresShipping: boolean;
  shippingAddress?: {
    recipient: string;
    line1: string;
    city: string;
    country: string;
    postalCode: string;
  };
  subtotalCents: number;
  shippingCents: number;
  platformFeeCents: number;
  paymentFeeCents: number;
  totalCents: number;
  currency: "USD";
  paymentMethod: "fiat_escrow" | "wallet_escrow";
  paymentVerification: "unconfigured_preview" | "pending" | "verified" | "failed";
  escrowMode: "unconfigured_preview" | "fiat_provider" | "onchain_contract";
  walletAddressUsed?: string;
  escrowStatus: EscrowStatus;
  escrowConditions: string;
  fulfillmentNote?: string;
  trackingNumber?: string;
  digitalDeliveryNote?: string;
  escrowEvents: EscrowEvent[];
  disputeId?: string;
  payoutStatus: "pending_provider" | "processing" | "paid_out" | "held";
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  storeId: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
  sellerReply?: string;
  sellerReplyAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  deliveryState: "sending" | "delivered" | "failed";
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  storeId?: string;
  storeName?: string;
  productId?: string;
  productTitle?: string;
  productSlug?: string;
  orderId?: string;
  orderReference?: string;
  status: "open" | "blocked" | "reported";
  blockedBy?: string;
  unreadBy: string[];
  updatedAt: string;
}

export interface DiscussionRoom {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  memberCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  parentCommentId?: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRoleLabel: string;
  roomId?: string;
  postType: "discussion" | "product_share" | "question" | "recommendation";
  title: string;
  body: string;
  tags?: string[];
  attachedProductId?: string;
  likedBy: string[];
  status: "active" | "flagged" | "removed";
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  eventType:
    | "message"
    | "order"
    | "payment"
    | "escrow"
    | "delivery"
    | "dispute"
    | "refund"
    | "payout"
    | "seller_verification"
    | "moderation"
    | "community";
  title: string;
  body: string;
  href: string;
  importantTransaction: boolean;
  read: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  entityType: "product" | "store" | "user" | "post" | "message";
  entityId: string;
  entityLabel: string;
  reason: string;
  evidence: string;
  reviewStatus: "open" | "reviewed" | "action_taken" | "dismissed";
  createdAt: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  orderReference: string;
  buyerId: string;
  buyerName: string;
  storeId: string;
  storeName: string;
  reason: string;
  buyerStatement: string;
  sellerResponse?: string;
  evidenceNotes: string;
  status: "open" | "under_review" | "resolved_refund" | "resolved_release";
  resolutionNote?: string;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface IntegrationStatus {
  googleIdentityServices: {
    configured: boolean;
    clientId: string | null;
    note: string;
  };
  supabase: {
    configured: boolean;
    note: string;
  };
  fiatPaymentProvider: {
    configured: boolean;
    providerName: string | null;
    note: string;
  };
  onchainEscrow: {
    configured: boolean;
    chainId: string | null;
    chainName: string | null;
    contractAddress: string | null;
    tokenSymbol: string | null;
    note: string;
  };
  localSandboxEnabled?: boolean;
}

export interface WiserdDatabase {
  users: User[];
  wallets: WalletLink[];
  stores: Store[];
  products: Product[];
  orders: Order[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  discussionRooms: DiscussionRoom[];
  posts: CommunityPost[];
  comments: Comment[];
  notifications: NotificationItem[];
  reports: Report[];
  disputes: Dispute[];
  auditLogs: AuditLog[];
  walletNonces: Record<
    string,
    { nonce: string; message: string; userId: string; address: string; expiresAt: number }
  >;
}
