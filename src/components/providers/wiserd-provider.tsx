"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CartItem,
  IntegrationStatus,
  NotificationItem,
  User,
  WalletLink,
} from "@/lib/types";

interface WiserdContextValue {
  user: User | null;
  wallets: WalletLink[];
  notifications: NotificationItem[];
  integrations: IntegrationStatus | null;
  loadingSession: boolean;
  cart: CartItem[];
  cartCount: number;
  recentlyViewedIds: string[];
  recentSearches: string[];
  googleModalOpen: boolean;
  walletModalOpen: boolean;
  cartDrawerOpen: boolean;
  openGoogleAuthModal: () => void;
  closeGoogleAuthModal: () => void;
  openWalletModal: () => void;
  closeWalletModal: () => void;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  addToCart: (item: CartItem) => void;
  updateCartQuantity: (productId: string, variationId: string | undefined, qty: number) => void;
  removeFromCart: (productId: string, variationId: string | undefined) => void;
  pruneCartToValidIds: (validProductIds: Set<string>) => void;
  clearCart: () => void;
  recordProductView: (productId: string) => void;
  recordSearch: (query: string) => void;
  clearRecentSearches: () => void;
  toggleFavorite: (productId: string) => Promise<void>;
  toggleFollowStore: (storeId: string) => Promise<void>;
  markNotificationRead: (notificationId?: string) => Promise<void>;
}

const WiserdContext = createContext<WiserdContextValue | null>(null);
const CART_STORAGE_KEY = "wiserd_cart_v1";
const RECENT_STORAGE_KEY = "wiserd_recent_v1";
const SEARCH_STORAGE_KEY = "wiserd_searches_v1";

export function WiserdProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<WalletLink[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUser(data.user || null);
      setWallets(data.wallets || []);
      setNotifications(data.notifications || []);
      setIntegrations(data.integrations || null);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession();
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CartItem[];
          if (Array.isArray(parsed)) setCart(parsed);
        }
        const recentRaw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        if (recentRaw) {
          const parsedRecent = JSON.parse(recentRaw) as string[];
          if (Array.isArray(parsedRecent)) setRecentlyViewedIds(parsedRecent.slice(0, 8));
        }
        const searchRaw = window.localStorage.getItem(SEARCH_STORAGE_KEY);
        if (searchRaw) {
          const parsedSearches = JSON.parse(searchRaw) as string[];
          if (Array.isArray(parsedSearches)) setRecentSearches(parsedSearches.slice(0, 5));
        }
      } catch {
        // Ignore invalid localStorage
      }
    });
    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === CART_STORAGE_KEY) {
          const parsed = e.newValue ? (JSON.parse(e.newValue) as CartItem[]) : [];
          if (Array.isArray(parsed)) setCart(parsed);
        } else if (e.key === RECENT_STORAGE_KEY) {
          const parsed = e.newValue ? (JSON.parse(e.newValue) as string[]) : [];
          if (Array.isArray(parsed)) setRecentlyViewedIds(parsed.slice(0, 8));
        } else if (e.key === SEARCH_STORAGE_KEY) {
          const parsed = e.newValue ? (JSON.parse(e.newValue) as string[]) : [];
          if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 5));
        }
      } catch {
        // Ignore malformed cross-tab storage payloads
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshSession]);

  const persistCart = useCallback((next: CartItem[]) => {
    setCart(next);
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const addToCart = useCallback(
    (item: CartItem) => {
      setCart((prev) => {
        const idx = prev.findIndex(
          (i) => i.productId === item.productId && i.variationId === item.variationId
        );
        const next =
          idx >= 0
            ? prev.map((entry, i) =>
                i === idx
                  ? { ...entry, quantity: Math.min(20, entry.quantity + item.quantity) }
                  : entry
              )
            : [...prev, item];
        try {
          window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const updateCartQuantity = useCallback(
    (productId: string, variationId: string | undefined, qty: number) => {
      setCart((prev) => {
        const next =
          qty <= 0
            ? prev.filter(
                (i) => !(i.productId === productId && i.variationId === variationId)
              )
            : prev.map((i) =>
                i.productId === productId && i.variationId === variationId
                  ? { ...i, quantity: Math.min(20, qty) }
                  : i
              );
        try {
          window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const removeFromCart = useCallback(
    (productId: string, variationId: string | undefined) => {
      updateCartQuantity(productId, variationId, 0);
    },
    [updateCartQuantity]
  );

  const pruneCartToValidIds = useCallback((validProductIds: Set<string>) => {
    setCart((prev) => {
      const next = prev.filter((item) => validProductIds.has(item.productId));
      if (next.length === prev.length) return prev;
      try {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => persistCart([]), [persistCart]);

  const recordProductView = useCallback((productId: string) => {
    if (!productId) return;
    setRecentlyViewedIds((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, 8);
      try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  const recordSearch = useCallback((query: string) => {
    const clean = query.trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [
        clean,
        ...prev.filter((q) => q.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 5);
      try {
        window.localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      window.localStorage.removeItem(SEARCH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // Clear client state even if request fails
    }
    setUser(null);
    setWallets([]);
    setNotifications([]);
  }, []);

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (!user) {
        setGoogleModalOpen(true);
        return;
      }
      try {
        const res = await fetch("/api/auth/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle_favorite", productId }),
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Network error — keep existing UI state
      }
    },
    [user]
  );

  const toggleFollowStore = useCallback(
    async (storeId: string) => {
      if (!user) {
        setGoogleModalOpen(true);
        return;
      }
      try {
        const res = await fetch("/api/auth/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle_follow_store", storeId }),
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Network error — keep existing UI state
      }
    },
    [user]
  );

  const markNotificationRead = useCallback(
    async (notificationId?: string) => {
      if (!user) return;
      try {
        await fetch("/api/auth/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_notification_read", notificationId }),
        });
        await refreshSession();
      } catch {
        // Ignore transient failure
      }
    },
    [user, refreshSession]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const value = useMemo<WiserdContextValue>(
    () => ({
      user,
      wallets,
      notifications,
      integrations,
      loadingSession,
      cart,
      cartCount,
      recentlyViewedIds,
      recentSearches,
      googleModalOpen,
      walletModalOpen,
      cartDrawerOpen,
      openGoogleAuthModal: () => setGoogleModalOpen(true),
      closeGoogleAuthModal: () => setGoogleModalOpen(false),
      openWalletModal: () => setWalletModalOpen(true),
      closeWalletModal: () => setWalletModalOpen(false),
      openCartDrawer: () => setCartDrawerOpen(true),
      closeCartDrawer: () => setCartDrawerOpen(false),
      refreshSession,
      signOut,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      pruneCartToValidIds,
      clearCart,
      recordProductView,
      recordSearch,
      clearRecentSearches,
      toggleFavorite,
      toggleFollowStore,
      markNotificationRead,
    }),
    [
      user,
      wallets,
      notifications,
      integrations,
      loadingSession,
      cart,
      cartCount,
      recentlyViewedIds,
      recentSearches,
      googleModalOpen,
      walletModalOpen,
      cartDrawerOpen,
      refreshSession,
      signOut,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      pruneCartToValidIds,
      clearCart,
      recordProductView,
      recordSearch,
      clearRecentSearches,
      toggleFavorite,
      toggleFollowStore,
      markNotificationRead,
    ]
  );

  return <WiserdContext.Provider value={value}>{children}</WiserdContext.Provider>;
}

export function useWiserd() {
  const ctx = useContext(WiserdContext);
  if (!ctx) throw new Error("useWiserd must be used within WiserdProvider");
  return ctx;
}
