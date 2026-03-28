import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, ChatUser, Channel } from "../types/chat";
import { io } from "socket.io-client";

const API = "https://adaptable-patience-production-45da.up.railway.app";

type SocketInstance = ReturnType<typeof io>;

export const getDMChannelId = (idA: string, idB: string) =>
  "dm_" + [idA, idB].sort().join("__");

export const SEED_USERS: ChatUser[] = [];

const DEFAULT_CHANNELS: Channel[] = [
  { id: "general",       name: "general",       type: "public", description: "General discussion",    unread: 0 },
  { id: "announcements", name: "announcements", type: "public", description: "Company announcements", unread: 0 },
  { id: "sales",         name: "sales",         type: "public", description: "Sales team",            unread: 0 },
  { id: "marketing",     name: "marketing",     type: "public", description: "Marketing team",        unread: 0 },
  { id: "support",       name: "support",       type: "public", description: "Customer support",      unread: 0 },
  { id: "random",        name: "random",        type: "public", description: "Off-topic fun",         unread: 0 },
];

interface ChatContextValue {
  messages:         Record<string, ChatMessage[]>;
  channels:         Channel[];
  activeChannel:    string;
  typingUser:       string | null;
  unreadDMs:        Record<string, number>;
  setActiveChannel: (id: string) => void;
  sendMessage:      (msg: Omit<ChatMessage, "id" | "createdAt">) => Promise<void>;
  toggleReaction:   (msgId: string, emoji: string, userId: string) => void;
  clearDMUnread:    (channelId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);
export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
  return ctx;
};

interface ProviderProps {
  children:    React.ReactNode;
  currentUser: ChatUser;
  teamMembers: ChatUser[];
}

export const ChatProvider: React.FC<ProviderProps> = ({ children, currentUser, teamMembers }) => {
  const [messages,      setMessages]      = useState<Record<string, ChatMessage[]>>({});
  const [channels,      setChannels]      = useState<Channel[]>(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannelState] = useState("general");
  const [typingUser,    setTypingUser]    = useState<string | null>(null);
  const [unreadDMs,     setUnreadDMs]     = useState<Record<string, number>>({});

  const socketRef   = useRef<SocketInstance | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Load messages for a channel from MongoDB ─────────────────────────────
  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`${API}/api/chat/messages/${channelId}?limit=100`);
      if (!res.ok) return;
      const data: ChatMessage[] = await res.json();
      setMessages(prev => ({
        ...prev,
        [channelId]: data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }));
    } catch (e) {
      console.warn("[Chat] loadMessages failed for", channelId, e);
    }
  }, []);

  // ── Load ALL channel histories immediately on mount ───────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    DEFAULT_CHANNELS.forEach(ch => loadMessages(ch.id));
  }, [currentUser.id, loadMessages]);

  // ── Load DM histories when teamMembers becomes available ─────────────────
  useEffect(() => {
    if (!currentUser?.id || !teamMembers.length) return;
    teamMembers
      .filter(m => m?.id)
      .forEach(member => {
        const dmCh = getDMChannelId(currentUser.id, member.id);
        loadMessages(dmCh);
      });
  }, [currentUser.id, teamMembers, loadMessages]);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;

    const socket = io(API, {
      // polling first — Railway's proxy requires the HTTP handshake before
      // upgrading to WebSocket. Starting with "websocket" directly causes the
      // "WebSocket closed before connection established" error on Railway.
      transports:           ["polling", "websocket"],
      upgrade:              true,
      withCredentials:      true,
      autoConnect:          true,
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1500,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Chat] Socket connected:", socket.id);

      // Join all public channels
      DEFAULT_CHANNELS.forEach(ch => socket.emit("join_channel", ch.id));

      // Join personal DM rooms
      socket.emit("join_channel", `dm_personal_${currentUser.id}`);
      socket.emit("join_channel", `dm_personal_${currentUser.email}`);

      // Join all DM rooms with team members
      teamMembers.filter(m => m?.id).forEach(member => {
        socket.emit("join_channel", getDMChannelId(currentUser.id, member.id));
      });

      // Re-fetch all histories on reconnect so nothing is missed
      DEFAULT_CHANNELS.forEach(ch => loadMessages(ch.id));
      teamMembers.filter(m => m?.id).forEach(member => {
        loadMessages(getDMChannelId(currentUser.id, member.id));
      });
    });

    socket.on("disconnect", (reason: string) => {
      console.log("[Chat] Socket disconnected:", reason);
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("[Chat] Socket connect error:", err.message);
    });

    socket.on("new_message", (data: ChatMessage) => {
      if (!data?.channelId || !data?.id) return;

      setMessages(prev => {
        const existing = prev[data.channelId] || [];
        const withoutOptimistic = existing.filter(m => !m.id.startsWith("opt_") || m.id === data.id);
        if (withoutOptimistic.some(m => m.id === data.id)) return prev;
        return { ...prev, [data.channelId]: [...withoutOptimistic, data] };
      });

      const isFromMe = data.author?.id === currentUser.id || data.author?.email === currentUser.email;

      // Desktop notification
      if (!isFromMe && Notification.permission === "granted") {
        const isDM = data.channelId.startsWith("dm_");
        new Notification(`${data.author?.name || "Someone"} ${isDM ? "(DM)" : `· #${data.channelId}`}`, {
          body: data.text?.slice(0, 80) || "Sent an attachment",
          icon: data.author?.avatar,
          tag:  `chat-${data.id}`,
        });
      }

      // Track DM unreads
      if (data.channelId.startsWith("dm_") && !isFromMe) {
        setUnreadDMs(prev => ({ ...prev, [data.channelId]: (prev[data.channelId] || 0) + 1 }));
      }

      // Update channel unread badges
      if (!data.channelId.startsWith("dm_") && !isFromMe) {
        setChannels(prev => prev.map(ch =>
          ch.id === data.channelId ? { ...ch, unread: (ch.unread || 0) + 1 } : ch
        ));
      }
    });

    socket.on("reaction_update", (data: { messageId: string; channelId: string; reactions: Record<string, string[]> }) => {
      if (!data?.messageId || !data?.channelId) return;
      setMessages(prev => {
        const msgs = prev[data.channelId] || [];
        return { ...prev, [data.channelId]: msgs.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m) };
      });
    });

    socket.on("user_typing", (data: { name: string; channelId: string }) => {
      setTypingUser(data.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(null), 2500);
    });

    if (Notification.permission === "default") Notification.requestPermission();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, currentUser.email]);

  // Re-join DM rooms when teamMembers loads after socket is already connected
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !teamMembers.length) return;
    teamMembers.filter(m => m?.id).forEach(member => {
      socket.emit("join_channel", getDMChannelId(currentUser.id, member.id));
    });
  }, [teamMembers, currentUser.id]);

  // ── Set active channel — always reload from DB ───────────────────────────
  const setActiveChannel = useCallback((id: string) => {
    setActiveChannelState(id);
    loadMessages(id);
    if (!id.startsWith("dm_")) {
      setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, unread: 0 } : ch));
    }
  }, [loadMessages]);

  // ── Send message — save to MongoDB FIRST, then socket broadcast ──────────
  const sendMessage = useCallback(async (partial: Omit<ChatMessage, "id" | "createdAt">) => {
    const optimisticId = `opt_${Date.now()}_${Math.random()}`;
    const optimistic: ChatMessage = {
      ...partial,
      id:        optimisticId,
      createdAt: new Date().toISOString(),
    };

    // 1. Optimistic local update
    setMessages(prev => {
      const existing = prev[partial.channelId] || [];
      return { ...prev, [partial.channelId]: [...existing, optimistic] };
    });

    // 2. Save to MongoDB
    let saved: ChatMessage | null = null;
    try {
      const res = await fetch(`${API}/api/chat/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId:    partial.channelId,
          authorId:     partial.author.id,
          authorName:   partial.author.name,
          authorRole:   partial.author.role || "staff",
          authorEmail:  partial.author.email,
          authorAvatar: partial.author.avatar,
          author: {
            id:     partial.author.id,
            name:   partial.author.name,
            email:  partial.author.email,
            role:   partial.author.role || "staff",
            avatar: partial.author.avatar || "",
          },
          type:      partial.type || "text",
          text:      partial.text || "",
          gif:       partial.gif,
          meeting:   partial.meeting,
          reactions: partial.reactions || {},
        }),
      });

      if (res.ok) {
        saved = await res.json();
        console.log("[Chat] Saved to MongoDB:", saved?.id);
        if (saved) {
          setMessages(prev => {
            const msgs = prev[partial.channelId] || [];
            return {
              ...prev,
              [partial.channelId]: msgs.map(m => m.id === optimisticId ? saved! : m),
            };
          });
        }
      } else {
        const errText = await res.text();
        console.error("[Chat] MongoDB save failed:", res.status, errText);
      }
    } catch (e) {
      console.error("[Chat] MongoDB save error:", e);
    }

    // 3. Broadcast via socket
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("send_message", {
        ...(saved || optimistic),
        channelId: partial.channelId,
        authorId:  partial.author.id,
      });
      console.log("[Chat] Socket emit send_message to", partial.channelId);
    } else {
      console.warn("[Chat] Socket not connected — message saved to DB but not broadcast live");
    }
  }, []);

  // ── Toggle reaction ───────────────────────────────────────────────────────
  const toggleReaction = useCallback((msgId: string, emoji: string, userId: string) => {
    setMessages(prev => {
      for (const [channelId, msgs] of Object.entries(prev)) {
        const msg = msgs.find(m => m.id === msgId);
        if (!msg) continue;
        const users: string[] = (msg.reactions[emoji] as string[]) || [];
        const updated = users.includes(userId) ? users.filter(u => u !== userId) : [...users, userId];
        const newReactions = { ...msg.reactions, [emoji]: updated };

        fetch(`${API}/api/chat/messages/${msgId}/react`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ emoji, userId, channelId }),
        }).catch(e => console.warn("[Chat] Reaction save failed:", e));

        socketRef.current?.emit("react", { messageId: msgId, channelId, emoji, userId });

        return {
          ...prev,
          [channelId]: msgs.map(m => m.id === msgId ? { ...m, reactions: newReactions } : m),
        };
      }
      return prev;
    });
  }, []);

  const clearDMUnread = useCallback((channelId: string) => {
    setUnreadDMs(prev => ({ ...prev, [channelId]: 0 }));
  }, []);

  return (
    <ChatContext.Provider value={{ messages, channels, activeChannel, typingUser, unreadDMs, setActiveChannel, sendMessage, toggleReaction, clearDMUnread }}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProvider;