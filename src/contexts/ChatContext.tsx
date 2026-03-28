import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, ChatUser, Channel } from "../types/chat";
import { io } from "socket.io-client";

const API = "https://adaptable-patience-production-45da.up.railway.app";

type SocketInstance = ReturnType<typeof io>;

export const getDMChannelId = (idA: string, idB: string) =>
  "dm_" + [idA, idB].sort().join("__");

export const SEED_USERS: ChatUser[] = [];

const DEFAULT_CHANNELS: Channel[] = [
  { id: "general",       name: "general",       type: "public", description: "General discussion", unread: 0 },
  { id: "announcements", name: "announcements", type: "public", description: "Company announcements", unread: 0 },
  { id: "sales",         name: "sales",         type: "public", description: "Sales team", unread: 0 },
  { id: "marketing",     name: "marketing",     type: "public", description: "Marketing team", unread: 0 },
  { id: "support",       name: "support",       type: "public", description: "Customer support", unread: 0 },
  { id: "random",        name: "random",        type: "public", description: "Off-topic fun", unread: 0 },
];

interface ChatContextValue {
  messages:        Record<string, ChatMessage[]>;
  channels:        Channel[];
  activeChannel:   string;
  typingUser:      string | null;
  unreadDMs:       Record<string, number>;
  setActiveChannel: (id: string) => void;
  sendMessage:     (msg: Omit<ChatMessage, "id" | "createdAt">) => Promise<void>;
  toggleReaction:  (msgId: string, emoji: string, userId: string) => void;
  clearDMUnread:   (channelId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);
export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
  return ctx;
};

interface ProviderProps {
  children:     React.ReactNode;
  currentUser:  ChatUser;
  teamMembers:  ChatUser[];
}

export const ChatProvider: React.FC<ProviderProps> = ({ children, currentUser, teamMembers }) => {
  const [messages,      setMessages]      = useState<Record<string, ChatMessage[]>>({});
  const [channels,      setChannels]      = useState<Channel[]>(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannelState] = useState("general");
  const [typingUser,    setTypingUser]    = useState<string | null>(null);
  const [unreadDMs,     setUnreadDMs]     = useState<Record<string, number>>({});

  const socketRef   = useRef<SocketInstance | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Load messages for a channel from MongoDB ──────────────────────────────
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

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;

    const socket = io(API, {
      transports:          ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay:   1500,
      withCredentials:     true,
      autoConnect:         true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Chat] Socket connected:", socket.id);

      // Join all public channels
      DEFAULT_CHANNELS.forEach(ch => socket.emit("join_channel", ch.id));

      // Join personal DM room so incoming DMs always arrive
      socket.emit("join_channel", `dm_personal_${currentUser.id}`);
      socket.emit("join_channel", `dm_personal_${currentUser.email}`);

      // Pre-join all DM rooms with team members
      teamMembers.forEach(member => {
        const dmCh = getDMChannelId(currentUser.id, member.id);
        socket.emit("join_channel", dmCh);
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
        if (existing.some(m => m.id === data.id)) return prev; // dedupe
        return { ...prev, [data.channelId]: [...existing, data] };
      });

      // Desktop notification for messages not from me
      const isFromMe = data.author?.id === currentUser.id || data.author?.email === currentUser.email;
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

      // Update channel unread badges for public channels
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
        return {
          ...prev,
          [data.channelId]: msgs.map(m =>
            m.id === data.messageId ? { ...m, reactions: data.reactions } : m
          ),
        };
      });
    });

    socket.on("user_typing", (data: { name: string; channelId: string }) => {
      setTypingUser(data.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(null), 2500);
    });

    // Request notification permission
    if (Notification.permission === "default") Notification.requestPermission();

    // Load all channel histories
    DEFAULT_CHANNELS.forEach(ch => loadMessages(ch.id));

    // Pre-load DM histories for all team members
    teamMembers.forEach(member => {
      const dmCh = getDMChannelId(currentUser.id, member.id);
      loadMessages(dmCh);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, currentUser.email]);

  // Re-join DM rooms when teamMembers loads
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !teamMembers.length) return;
    teamMembers.forEach(member => {
      const dmCh = getDMChannelId(currentUser.id, member.id);
      socket.emit("join_channel", dmCh);
      loadMessages(dmCh);
    });
  }, [teamMembers, currentUser.id, loadMessages]);

  const setActiveChannel = useCallback((id: string) => {
    setActiveChannelState(id);
    loadMessages(id);
    // Clear channel unread
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

    // 1. Add optimistically to local state
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
          channelId:  partial.channelId,
          authorId:   partial.author.id,
          authorName: partial.author.name,
          author:     partial.author,
          type:       partial.type || "text",
          text:       partial.text || "",
          gif:        partial.gif,
          meeting:    partial.meeting,
          reactions:  partial.reactions || {},
        }),
      });

      if (res.ok) {
        saved = await res.json();
        console.log("[Chat] Saved to MongoDB:", saved?.id);
        // Replace optimistic with real saved message
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

    // 3. Broadcast via socket (use saved ID if available, else optimistic)
    const socket = socketRef.current;
    if (socket?.connected) {
      const payload = {
        ...(saved || optimistic),
        channelId:  partial.channelId,
        authorId:   partial.author.id,
      };
      socket.emit("send_message", payload);
      console.log("[Chat] Socket emit send_message to", partial.channelId);
    } else {
      console.warn("[Chat] Socket not connected — message saved to DB but not broadcast live");
    }
  }, []);

  const toggleReaction = useCallback((msgId: string, emoji: string, userId: string) => {
    setMessages(prev => {
      // Find which channel has this message
      for (const [channelId, msgs] of Object.entries(prev)) {
        const msg = msgs.find(m => m.id === msgId);
        if (!msg) continue;
        const users: string[] = (msg.reactions[emoji] as string[]) || [];
        const updated = users.includes(userId)
          ? users.filter(u => u !== userId)
          : [...users, userId];
        const newReactions = { ...msg.reactions, [emoji]: updated };

        // Persist
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
