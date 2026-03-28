import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, ChatUser, Channel } from "../types/chat";
import { io, Socket } from "socket.io-client";

const API = "https://adaptable-patience-production-45da.up.railway.app";

export const CHANNELS: Channel[] = [
  { id: "general",       name: "general",       description: "Team-wide chat",  type: "public", unread: 0 },
  { id: "announcements", name: "announcements", description: "Official updates", type: "public", unread: 0 },
  { id: "project-alpha", name: "project-alpha", description: "Alpha workspace",  type: "public", unread: 0 },
  { id: "random",        name: "random",        description: "Anything goes",    type: "public", unread: 0 },
];

interface ChatContextValue {
  messages:         Record<string, ChatMessage[]>;
  channels:         Channel[];
  activeChannel:    string;
  onlineUsers:      ChatUser[];
  typingUser:       string | null;
  setActiveChannel: (id: string) => void;
  sendMessage:      (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  toggleReaction:   (msgId: string, emoji: string, userId: string) => void;
  addChannel:       (ch: Channel) => void;
  clearUnread:      (channelId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
  return ctx;
};

// currentUser is passed in from ChatRoom so socket can identify the sender
export const ChatProvider: React.FC<{ children: React.ReactNode; currentUser?: ChatUser }> = ({ children, currentUser }) => {
  const [messages,      setMessages]   = useState<Record<string, ChatMessage[]>>({});
  const [channels,      setChannels]   = useState<Channel[]>(CHANNELS);
  const [activeChannel, setActive]     = useState("general");
  const [onlineUsers,   setOnlineUsers] = useState<ChatUser[]>([]);
  const [typingUser,    setTypingUser] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load messages for a channel from REST API ───────────────────────────
  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const res  = await fetch(`${API}/api/chat/messages/${channelId}?limit=100`);
      if (!res.ok) return;
      const data: any[] = await res.json();
      const normalized: ChatMessage[] = data.map(m => ({
        ...m,
        id:        m.id || String(m._id),
        reactions: m.reactions && typeof m.reactions === "object" && !Array.isArray(m.reactions)
          ? m.reactions
          : {},
      }));
      setMessages(prev => ({ ...prev, [channelId]: normalized }));
    } catch {}
  }, []);

  // ── Load all channels on mount ───────────────────────────────────────────
  useEffect(() => {
    CHANNELS.forEach(ch => loadMessages(ch.id));
  }, [loadMessages]);

  // ── Socket.io — connect once, rejoin on channel change ──────────────────
  useEffect(() => {
    const socket = io(API, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Join all channels so we receive messages from all of them
      CHANNELS.forEach(ch => socket.emit("join_channel", ch.id));
      // Announce presence
      if (currentUser) socket.emit("user_join", currentUser);
    });

    // Real-time: new message from another user
    socket.on("new_message", (msg: any) => {
      const normalized: ChatMessage = {
        ...msg,
        id:        msg.id || String(msg._id),
        reactions: msg.reactions && typeof msg.reactions === "object" && !Array.isArray(msg.reactions)
          ? msg.reactions
          : {},
      };
      setMessages(prev => {
        const ch = normalized.channelId;
        const existing = prev[ch] || [];
        // Avoid duplicates
        if (existing.some(m => m.id === normalized.id)) return prev;
        return { ...prev, [ch]: [...existing, normalized] };
      });
      // Increment unread if not active channel
      setChannels(prev => prev.map(c =>
        c.id === normalized.channelId && normalized.channelId !== activeChannel
          ? { ...c, unread: (c.unread || 0) + 1 }
          : c
      ));
    });

    // Reaction update from another user
    socket.on("reaction_update", ({ messageId, emoji, userId }: any) => {
      setMessages(prev => {
        const updated = { ...prev };
        for (const ch of Object.keys(updated)) {
          const idx = updated[ch].findIndex(m => m.id === messageId);
          if (idx !== -1) {
            const msg   = { ...updated[ch][idx] };
            const users = [...((msg.reactions[emoji] as string[]) || [])];
            const pos   = users.indexOf(userId);
            if (pos > -1) users.splice(pos, 1); else users.push(userId);
            msg.reactions    = { ...msg.reactions, [emoji]: users };
            updated[ch]      = [...updated[ch]];
            updated[ch][idx] = msg;
            return updated;
          }
        }
        return prev;
      });
    });

    // Typing indicator
    socket.on("user_typing", ({ name, isTyping }: { name: string; isTyping: boolean }) => {
      if (isTyping) {
        setTypingUser(name);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
      } else {
        setTypingUser(null);
      }
    });

    // Online presence
    socket.on("user_online",  (u: ChatUser) => setOnlineUsers(prev => { const f = prev.filter(x => x.email !== u.email); return [...f, { ...u, isOnline: true }]; }));
    socket.on("user_offline", ({ email }: { email: string }) => setOnlineUsers(prev => prev.map(u => u.email === email ? { ...u, isOnline: false } : u)));

    return () => { socket.disconnect(); };
  }, [currentUser?.id]); // only reconnect if user identity changes

  // ── Rejoin channel on switch ─────────────────────────────────────────────
  const setActiveChannel = useCallback((id: string) => {
    setActive(id);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
    socketRef.current?.emit("join_channel", id);
    // Load fresh messages when switching
    loadMessages(id);
  }, [loadMessages]);

  // ── Send message: optimistic + REST POST + socket broadcast ─────────────
  const sendMessage = useCallback(async (msg: Omit<ChatMessage, "id" | "createdAt">) => {
    const full: ChatMessage = {
      ...msg,
      id:        "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
    };

    // 1. Optimistic local update
    setMessages(prev => ({
      ...prev,
      [msg.channelId]: [...(prev[msg.channelId] || []), full],
    }));

    // 2. Persist to backend via REST
    try {
      const res = await fetch(`${API}/api/chat/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(full),
      });
      if (res.ok) {
        const saved = await res.json();
        const savedId = saved.id || String(saved._id);
        // Replace optimistic message with saved version (correct _id from DB)
        if (savedId !== full.id) {
          setMessages(prev => ({
            ...prev,
            [msg.channelId]: (prev[msg.channelId] || []).map(m =>
              m.id === full.id ? { ...m, id: savedId } : m
            ),
          }));
        }
      }
    } catch {}

    // 3. Broadcast to other users via socket
    socketRef.current?.emit("send_message", full);
  }, []);

  // ── Toggle reaction: REST + socket ──────────────────────────────────────
  const toggleReaction = useCallback(async (msgId: string, emoji: string, userId: string) => {
    // Optimistic local update
    setMessages(prev => {
      const updated = { ...prev };
      for (const ch of Object.keys(updated)) {
        const idx = updated[ch].findIndex(m => m.id === msgId);
        if (idx !== -1) {
          const msg   = { ...updated[ch][idx] };
          const users = [...((msg.reactions[emoji] as string[]) || [])];
          const pos   = users.indexOf(userId);
          if (pos > -1) users.splice(pos, 1); else users.push(userId);
          msg.reactions    = { ...msg.reactions, [emoji]: users };
          updated[ch]      = [...updated[ch]];
          updated[ch][idx] = msg;
          return updated;
        }
      }
      return prev;
    });

    // Persist + broadcast
    try {
      await fetch(`${API}/api/chat/messages/${msgId}/react`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ emoji, userId, channelId: activeChannel }),
      });
    } catch {}

    socketRef.current?.emit("react", { messageId: msgId, emoji, userId, channelId: activeChannel });
  }, [activeChannel]);

  const addChannel = useCallback((ch: Channel) => {
    setChannels(prev => [...prev, ch]);
    setMessages(prev => ({ ...prev, [ch.id]: [] }));
  }, []);

  const clearUnread = useCallback((channelId: string) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unread: 0 } : c));
  }, []);

  return (
    <ChatContext.Provider value={{
      messages, channels, activeChannel, onlineUsers, typingUser,
      setActiveChannel, sendMessage, toggleReaction, addChannel, clearUnread,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const SEED_USERS: ChatUser[] = [];