import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage, ChatUser, Channel } from "../types/chat";
import { io } from "socket.io-client";
type SocketInstance = ReturnType<typeof io>;

const API = "https://adaptable-patience-production-45da.up.railway.app";

// Shared DM room ID — same for both users regardless of who initiates
const getDMChannelId = (idA: string, idB: string) =>
  "dm_" + [idA, idB].sort().join("__");

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
  unreadDMs:        Record<string, number>;
  setActiveChannel: (id: string) => void;
  sendMessage:      (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  toggleReaction:   (msgId: string, emoji: string, userId: string) => void;
  addChannel:       (ch: Channel) => void;
  clearUnread:      (channelId: string) => void;
  clearDMUnread:    (channelId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
  return ctx;
};

export const ChatProvider: React.FC<{
  children: React.ReactNode;
  currentUser?: ChatUser;
  teamMembers?: ChatUser[];
}> = ({ children, currentUser, teamMembers = [] }) => {
  const [messages,      setMessages]    = useState<Record<string, ChatMessage[]>>({});
  const [channels,      setChannels]    = useState<Channel[]>(CHANNELS);
  const [activeChannel, setActive]      = useState("general");
  const [onlineUsers,   setOnlineUsers] = useState<ChatUser[]>([]);
  const [typingUser,    setTypingUser]  = useState<string | null>(null);
  const [unreadDMs,     setUnreadDMs]   = useState<Record<string, number>>({});
  const socketRef = useRef<SocketInstance | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeChRef    = useRef("general"); // track active channel for unread logic

  useEffect(() => { activeChRef.current = activeChannel; }, [activeChannel]);

  // ── Request notification permission ──────────────────────────────────────
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── Load messages from REST ───────────────────────────────────────────────
  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`${API}/api/chat/messages/${channelId}?limit=100`);
      if (!res.ok) { console.warn("[Chat] loadMessages failed:", res.status); return; }
      const data: any[] = await res.json();
      console.log(`[Chat] Loaded ${data.length} messages for #${channelId}`);
      const normalized: ChatMessage[] = data.map(m => ({
        ...m,
        id:        m.id || String(m._id),
        reactions: m.reactions && typeof m.reactions === "object" && !Array.isArray(m.reactions) ? m.reactions : {},
      }));
      setMessages(prev => ({ ...prev, [channelId]: normalized }));
    } catch (e) { console.error("[Chat] loadMessages error:", e); }
  }, []);

  useEffect(() => {
    CHANNELS.forEach(ch => loadMessages(ch.id));
  }, [loadMessages]);

  // Pre-load DM histories — staggered to avoid 28 simultaneous API calls
  useEffect(() => {
    if (!currentUser?.id || teamMembers.length === 0) return;
    let i = 0;
    const members = teamMembers.filter(m => m?.id && m.id !== currentUser.id);
    const interval = setInterval(() => {
      if (i >= members.length) { clearInterval(interval); return; }
      const dmCh = getDMChannelId(currentUser.id, members[i].id);
      loadMessages(dmCh);
      i++;
    }, 150); // load one DM history every 150ms
    return () => clearInterval(interval);
  }, [currentUser?.id, teamMembers.length, loadMessages]);

  // Stable ref so socket handlers always see latest currentUser without reconnecting
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const teamMembersRef = useRef(teamMembers);
  useEffect(() => { teamMembersRef.current = teamMembers; }, [teamMembers]);

  // ── Socket.io — connect ONCE, never reconnect unless user logs out ────────
  useEffect(() => {
    if (!currentUser?.id) return; // don't connect until we have a real user
    console.log("[Chat] Connecting socket to", API);
    const socket = io(API, {
      transports:           ["websocket", "polling"],
      withCredentials:      true,
      reconnectionAttempts: 10,
      reconnectionDelay:    2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Chat] Socket connected:", socket.id);
      const cu = currentUserRef.current;
      const tm = teamMembersRef.current;
      CHANNELS.forEach(ch => socket.emit("join_channel", ch.id));
      if (cu) {
        socket.emit("user_join", cu);
        tm.forEach(member => {
          if (member.id && member.id !== cu.id && member.email !== cu.email) {
            socket.emit("join_channel", getDMChannelId(cu.id, member.id));
          }
        });
        console.log("[Chat] Joined as:", cu.email, "| Pre-joined", tm.length, "DM rooms");
      }
    });

    socket.on("connect_error", (err: Error) => {
      console.error("[Chat] Socket connect_error:", err.message);
    });

    socket.on("disconnect", (reason: string) => {
      console.warn("[Chat] Socket disconnected:", reason);
    });

    socket.on("new_message", (msg: any) => {
      const cu = currentUserRef.current;
      console.log("[Chat] new_message received:", msg.channelId, msg.text?.slice(0, 30));
      const normalized: ChatMessage = {
        ...msg,
        id:        msg.id || String(msg._id),
        reactions: msg.reactions && typeof msg.reactions === "object" && !Array.isArray(msg.reactions) ? msg.reactions : {},
      };

      const myEmail  = cu?.email?.toLowerCase();
      const isFromMe = myEmail
        ? (normalized.author?.email?.toLowerCase() === myEmail || normalized.author?.id === cu?.id)
        : false;

      // Desktop notification
      if (!isFromMe && "Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification(`${normalized.author?.name || "Someone"} · #${normalized.channelId}`, {
            body:   normalized.type === "text" ? (normalized.text || "").slice(0, 100) : "New message",
            icon:   "/favicon.ico",
            tag:    `chat-${normalized.id}`,
          });
          n.onclick = () => { window.focus(); n.close(); };
        } catch {}
      }

      // Increment DM unread if it's a DM channel and not from me
      if (!isFromMe && normalized.channelId.startsWith("dm_") && normalized.channelId !== activeChRef.current) {
        setUnreadDMs(prev => ({ ...prev, [normalized.channelId]: (prev[normalized.channelId] || 0) + 1 }));
      }

      setMessages(prev => {
        const ch       = normalized.channelId;
        const existing = prev[ch] || [];
        if (existing.some(m => m.id === normalized.id)) return prev;
        return { ...prev, [ch]: [...existing, normalized] };
      });

      setChannels(prev => prev.map(c =>
        c.id === normalized.channelId && normalized.channelId !== activeChRef.current
          ? { ...c, unread: (c.unread || 0) + 1 }
          : c
      ));
    });

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

    socket.on("user_typing", ({ name, isTyping }: { name: string; isTyping: boolean }) => {
      if (isTyping) {
        setTypingUser(name);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
      } else {
        setTypingUser(null);
      }
    });

    socket.on("user_online",  (u: ChatUser) => setOnlineUsers(prev => { const f = prev.filter(x => x.email !== u.email); return [...f, { ...u, isOnline: true }]; }));
    socket.on("user_offline", ({ email }: { email: string }) => setOnlineUsers(prev => prev.map(u => u.email === email ? { ...u, isOnline: false } : u)));

    return () => {
      console.log("[Chat] Disconnecting socket");
      socket.disconnect();
    };
  }, [currentUser?.id]); // socket only reconnects if user identity changes

  // Re-join DM rooms once teamMembers are loaded — runs only once per session
  const dmRoomsJoinedRef = useRef(false);
  useEffect(() => {
    if (!currentUser?.id || teamMembers.length === 0) return;
    if (dmRoomsJoinedRef.current) return; // already joined
    const socket = socketRef.current;
    if (!socket?.connected) return;
    dmRoomsJoinedRef.current = true;
    teamMembers.forEach(member => {
      if (member.id && member.id !== currentUser.id && member.email !== currentUser.email) {
        socket.emit("join_channel", getDMChannelId(currentUser.id, member.id));
      }
    });
    console.log("[Chat] Pre-joined", teamMembers.length, "DM rooms");
  }, [currentUser?.id, teamMembers.length]);

  const setActiveChannel = useCallback((id: string) => {
    setActive(id);
    activeChRef.current = id;
    // Only update unread for known public channels
    setChannels(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
    socketRef.current?.emit("join_channel", id);
    loadMessages(id);
  }, [loadMessages]);

  // ── Send message ──────────────────────────────────────────────────────────
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

    // 2. Socket broadcast — backend forwards to all other clients in the channel
    const payload = { ...full, authorId: full.author.id, authorName: full.author.name };
    if (socketRef.current?.connected) {
      socketRef.current.emit("send_message", payload);
      console.log("[Chat] socket emit send_message:", full.id, "connected:", socketRef.current.connected);
    } else {
      console.warn("[Chat] Socket NOT connected, message not broadcast");
    }

    // 3. Persist to MongoDB via REST — backend schema requires flat authorId/authorName/authorRole
    try {
      const restPayload = {
        ...full,
        authorId:     full.author.id,
        authorName:   full.author.name,
        authorRole:   full.author.role,
        authorEmail:  full.author.email,
        authorAvatar: full.author.avatar,
      };
      console.log("[Chat] POST /api/chat/messages →", msg.channelId, full.text?.slice(0, 40));
      const res = await fetch(`${API}/api/chat/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(restPayload),
      });
      if (res.ok) {
        const saved = await res.json();
        console.log("[Chat] Saved to MongoDB:", saved.id || saved._id);
        const savedId = saved.id || String(saved._id);
        if (savedId !== full.id) {
          setMessages(prev => ({
            ...prev,
            [msg.channelId]: (prev[msg.channelId] || []).map(m =>
              m.id === full.id ? { ...m, id: savedId } : m
            ),
          }));
        }
      } else {
        const errText = await res.text();
        console.error("[Chat] REST save failed:", res.status, errText);
      }
    } catch (e) {
      console.error("[Chat] REST network error:", e);
    }
  }, []);

  const toggleReaction = useCallback(async (msgId: string, emoji: string, userId: string) => {
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
    try {
      await fetch(`${API}/api/chat/messages/${msgId}/react`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId, channelId: activeChRef.current }),
      });
    } catch {}
    socketRef.current?.emit("react", { messageId: msgId, emoji, userId, channelId: activeChRef.current });
  }, []);

  const addChannel = useCallback((ch: Channel) => {
    setChannels(prev => [...prev, ch]);
    setMessages(prev => ({ ...prev, [ch.id]: [] }));
  }, []);

  const clearDMUnread = useCallback((channelId: string) => {
    setUnreadDMs(prev => ({ ...prev, [channelId]: 0 }));
  }, []);

  const clearUnread = useCallback((channelId: string) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unread: 0 } : c));
  }, []);

  return (
    <ChatContext.Provider value={{ messages, channels, activeChannel, onlineUsers, typingUser, unreadDMs, setActiveChannel, sendMessage, toggleReaction, addChannel, clearUnread, clearDMUnread }}>
      {children}
    </ChatContext.Provider>
  );
};

export const SEED_USERS: ChatUser[] = [];
