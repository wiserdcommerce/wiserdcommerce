"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Send,
  Flag,
  Ban,
  Package,
  ReceiptText,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";
import { useWiserd } from "@/components/providers/wiserd-provider";
import { getBrowserSupabase } from "@/lib/supabase";
import type { Conversation, Message } from "@/lib/types";

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("conversation") || "";
  const { user, openGoogleAuthModal } = useWiserd();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState(initialConvId);
  const [searchQ, setSearchQ] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getBrowserSupabase>>["channel"]> | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const convs = (data.conversations || []) as Conversation[];
        setConversations(convs);
        setMessages(data.messages || []);
        setSelectedId((prev) => prev || initialConvId || convs[0]?.id || "");
      }
    } finally {
      setLoading(false);
    }
  }, [initialConvId]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!user) {
        setConversations([]);
        setMessages([]);
        setLoading(false);
        return;
      }
      loadMessages();
    });
    if (!user) {
      return () => {
        active = false;
      };
    }
    // Use Supabase Realtime broadcast when configured, with lightweight polling fallback
    const supabase = getBrowserSupabase();
    if (supabase) {
      const channel = supabase
        .channel("wiserd:messages")
        .on("broadcast", { event: "message_update" }, () => {
          if (active) loadMessages();
        })
        .subscribe();
      realtimeChannelRef.current = channel;
    }

    const interval = window.setInterval(() => {
      if (active && document.visibilityState === "visible") {
        loadMessages();
      }
    }, supabase ? 20000 : 6000);
    const onVisible = () => {
      if (active && document.visibilityState === "visible") loadMessages();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (supabase && realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [loadMessages, user]);

  const activeConv = conversations.find((c) => c.id === selectedId) || null;
  const threadMessages = messages.filter((m) => m.conversationId === selectedId);
  const canToggleBlock = Boolean(
    activeConv &&
      user &&
      (activeConv.status !== "blocked" ||
        !activeConv.blockedBy ||
        activeConv.blockedBy === user.id ||
        user.roles.includes("admin"))
  );

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedId, threadMessages.length]);

  const filteredConversations = conversations.filter((c) => {
    if (!searchQ.trim()) return true;
    const names = Object.values(c.participantNames).join(" ");
    return `${names} ${c.storeName || ""} ${c.productTitle || ""} ${c.orderReference || ""}`
      .toLowerCase()
      .includes(searchQ.toLowerCase());
  });

  const handleSelectConversation = async (id: string) => {
    setSelectedId(id);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", conversationId: id }),
    });
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id && user
          ? { ...c, unreadBy: c.unreadBy.filter((uid) => uid !== user.id) }
          : c
      )
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !draft.trim()) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          conversationId: activeConv.id,
          text: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Could not send message.");
      } else {
        setDraft("");
        realtimeChannelRef.current?.send({
          type: "broadcast",
          event: "message_update",
          payload: { conversationId: activeConv.id },
        });
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!activeConv) return;
    setNotice(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "block", conversationId: activeConv.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Could not update conversation block status.");
      return;
    }
    await loadMessages();
  };

  const handleReport = async () => {
    if (!activeConv) return;
    setNotice(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report",
        conversationId: activeConv.id,
        reportReason: "User reported conversation from WISERD Messages",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Could not submit report.");
      return;
    }
    setNotice("Conversation reported to WISERD moderation.");
    await loadMessages();
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-[960px] px-4 pt-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] text-[#6B6B6B]">
            <MessageSquare className="h-5 w-5" />
          </span>
          <h1 className="mt-3 text-2xl font-medium text-[#171717]">
            Sign in to access WISERD Messages
          </h1>
          <p className="mt-1.5 text-sm text-[#6B6B6B]">
            Message sellers directly from listings or manage order conversations
            without leaving WISERD.
          </p>
          <button
            type="button"
            onClick={openGoogleAuthModal}
            className="mt-5 h-10 cursor-pointer rounded-lg bg-[#315FC8] px-6 text-sm font-semibold text-white"
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-4">
        <p className="type-meta text-[#315FC8]">
          Direct Communication
        </p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#171717]">
          Messages
        </h1>
      </div>

      <div className="mt-6 mb-6 grid min-h-[420px] grid-cols-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white lg:mb-0 lg:min-h-[560px] lg:grid-cols-12">
        {/* Conversation List */}
        <aside className="border-b border-[#E5E7EB] p-4 lg:col-span-4 lg:border-r lg:border-b-0">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
            <label htmlFor="conv-search" className="sr-only">
              Search conversations
            </label>
            <input
              id="conv-search"
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search conversations..."
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] pr-3 pl-9 text-xs"
            />
          </div>

          <div className="mt-3 space-y-1.5">
            {loading ? (
              <div aria-hidden="true" className="space-y-2 p-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-[#F0F1F2]" />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="p-4 text-xs text-[#6B6B6B]">
                No conversations yet. Click &ldquo;Contact Seller&rdquo; on any
                listing or order to start chatting.
              </p>
            ) : (
              filteredConversations.map((conv) => {
                const otherName =
                  conv.storeName ||
                  Object.entries(conv.participantNames).find(
                    ([id]) => id !== user.id
                  )?.[1] ||
                  "WISERD Member";
                const unread = conv.unreadBy.includes(user.id);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full cursor-pointer rounded-xl p-3 text-left transition ${
                      conv.id === selectedId
                        ? "bg-[#315FC8]/10 text-[#171717]"
                        : "hover:bg-[#F7F7F5]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[#171717]">
                        {otherName}
                      </span>
                      {unread && (
                        <span
                          aria-label="Unread conversation"
                          className="h-2 w-2 shrink-0 rounded-full bg-[#315FC8]"
                        />
                      )}
                    </div>
                    {conv.productTitle && (
                      <p className="mt-0.5 truncate text-xs text-[#315FC8]">
                        Product: {conv.productTitle}
                      </p>
                    )}
                    {conv.orderReference && (
                      <p className="font-mono-light mt-0.5 truncate text-xs text-[#167A67]">
                        Order {conv.orderReference}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Active Conversation Thread */}
        <section className="flex flex-col lg:col-span-8">
          {!activeConv ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-sm text-[#6B6B6B]">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
                <div>
                  <h2 className="text-base text-[#171717]">
                    {activeConv.storeName ||
                      Object.entries(activeConv.participantNames).find(
                        ([id]) => id !== user.id
                      )?.[1] ||
                      "Conversation"}
                  </h2>
                  <p className="text-xs text-[#6B6B6B]">
                    Status: <span className="capitalize">{activeConv.status}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canToggleBlock}
                    onClick={handleBlock}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-xs font-medium text-[#6B6B6B] hover:text-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                    {activeConv.status === "blocked"
                      ? canToggleBlock
                        ? "Unblock"
                        : "Blocked"
                      : "Block"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReport}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-xs font-medium text-[#6B6B6B] hover:text-[#C81E1E]"
                  >
                    <Flag aria-hidden="true" className="h-3.5 w-3.5" />
                    Report
                  </button>
                </div>
              </div>

              {/* Linked Product or Order Reference Banner */}
              {(activeConv.productSlug || activeConv.orderId) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] bg-[#F7F7F5] px-5 py-2.5 text-xs">
                  <span className="inline-flex items-center gap-2 font-medium text-[#171717]">
                    {activeConv.orderReference ? (
                      <ReceiptText aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                    ) : (
                      <Package aria-hidden="true" className="h-3.5 w-3.5 text-[#6B6B6B]" />
                    )}
                    {activeConv.orderReference
                      ? `Linked Order: ${activeConv.orderReference}`
                      : `Linked Product: ${activeConv.productTitle}`}
                  </span>
                  <Link
                    href={
                      activeConv.orderId
                        ? `/orders/${activeConv.orderId}`
                        : `/products/${activeConv.productSlug}`
                    }
                    className="inline-flex items-center gap-1 font-medium text-[#315FC8] hover:underline"
                  >
                    Open details <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* Message History */}
              <div
                ref={messagesScrollRef}
                className="max-h-[460px] flex-1 space-y-3 overflow-y-auto p-5"
              >
                {threadMessages.length === 0 ? (
                  <p className="text-center text-xs text-[#6B6B6B]">
                    Send the first message below to start this conversation.
                  </p>
                ) : (
                  threadMessages.map((msg) => {
                    const mine = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm ${
                            mine
                              ? "bg-[#315FC8] text-white"
                              : "border border-[#E5E7EB] bg-[#F7F7F5] text-[#171717]"
                          }`}
                        >
                          <p>{msg.body}</p>
                        </div>
                        <span className="font-mono-light mt-1 text-xs text-[#6B6B6B]">
                          {msg.senderName} ·{" "}
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" · "}
                          {msg.deliveryState}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {notice && (
                <p
                  role="status"
                  className="px-5 pb-2 text-xs font-medium text-[#315FC8]"
                >
                  {notice}
                </p>
              )}

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 border-t border-[#E5E7EB] p-4"
              >
                <label htmlFor="message-composer" className="sr-only">
                  Write a message
                </label>
                <input
                  id="message-composer"
                  disabled={activeConv.status === "blocked"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    activeConv.status === "blocked"
                      ? "Conversation is blocked"
                      : "Type your message..."
                  }
                  className="h-11 flex-1 rounded-xl border border-[#E5E7EB] bg-[#F7F7F5] px-4 text-sm text-[#171717]"
                />
                <button
                  type="submit"
                  disabled={sending || activeConv.status === "blocked"}
                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-[#315FC8] px-5 text-sm font-semibold text-white hover:bg-[#274EA6] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1320px] px-4 py-12 text-sm text-[#6B6B6B]">
          Loading WISERD Messages...
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
