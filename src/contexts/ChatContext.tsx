import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, ChatUser, Channel, UserRole } from "../types/chat";

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_USERS: ChatUser[] = [
  { id: "u1", name: "Priya Mehta",    email: "priya@roswalt.com",   role: "admin",      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",  isOnline: true  },
  { id: "u2", name: "Rahul Gupta",    email: "rahul@roswalt.com",   role: "superadmin", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=rahul",  isOnline: true  },
  { id: "u3", name: "Kavya Nair",     email: "kavya@roswalt.com",   role: "supremo",    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=kavya",  isOnline: false },
  { id: "u4", name: "Arjun Sharma",   email: "arjun@roswalt.com",   role: "staff",      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=arjun",  isOnline: true  },
  { id: "u5", name: "Sneha Iyer",     email: "sneha@roswalt.com",   role: "staff",      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sneha",  isOnline: true  },
  { id: "u6", name: "Dev Patel",      email: "dev@roswalt.com",     role: "staff",      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=dev",    isOnline: false },
];

const t = (minutesAgo: number) => {
  const d = new Date(Date.now() - minutesAgo * 60000);
  return d.toISOString();
};

const SEED_MESSAGES: Record<string, ChatMessage[]> = {
  general: [
    { id: "m1", channelId: "general", author: SEED_USERS[0], type: "text",    text: "Good morning team! 👋 Ready for a productive day?",   reactions: { "👍": ["u4", "u5"] }, createdAt: t(55) },
    { id: "m2", channelId: "general", author: SEED_USERS[1], type: "meeting", text: "Sprint review at 3pm — join the call!", meeting: { title: "Sprint Review", link: "https://meet.roswalt.io/sprint-q4", createdBy: "Rahul Gupta" }, reactions: { "✅": ["u4"] }, createdAt: t(48) },
    { id: "m3", channelId: "general", author: SEED_USERS[3], type: "text",    text: "Will the recording be shared?",                         reactions: {},                     createdAt: t(40) },
    { id: "m4", channelId: "general", author: SEED_USERS[2], type: "text",    text: "🎉 Great work everyone on hitting Q3 targets!",         reactions: { "🎉": ["u1","u4","u5"] }, createdAt: t(20) },
    { id: "m5", channelId: "general", author: SEED_USERS[4], type: "text",    text: "Does anyone know a good lo-fi playlist? Trying the music feature!", reactions: {}, createdAt: t(8) },
  ],
  announcements: [
    { id: "a1", channelId: "announcements", author: SEED_USERS[2], type: "text", text: "🚀 Roswalt SmartCue v2.0 is live! New: chat, video calls, YouTube music, sticker packs & GIFs.", reactions: { "🚀": ["u1","u2","u4","u5"] }, createdAt: t(120) },
  ],
  "project-alpha": [
    { id: "p1", channelId: "project-alpha", author: SEED_USERS[0], type: "text", text: "Alpha team: next milestone due Friday. Let's sync tomorrow morning.", reactions: {}, createdAt: t(200) },
    { id: "p2", channelId: "project-alpha", author: SEED_USERS[3], type: "text", text: "API integration is 80% done — just the auth layer remaining.", reactions: { "👍": ["u1"] }, createdAt: t(180) },
  ],
  random: [
    { id: "r1", channelId: "random", author: SEED_USERS[4], type: "text", text: "Who else is excited for the weekend? 🌊", reactions: { "✋": ["u4", "u6"] }, createdAt: t(400) },
  ],
};

export const CHANNELS: Channel[] = [
  { id: "general",       name: "general",       description: "Team-wide chat", type: "public", unread: 0 },
  { id: "announcements", name: "announcements", description: "Official updates", type: "public", unread: 0 },
  { id: "project-alpha", name: "project-alpha", description: "Alpha workspace", type: "public", unread: 0 },
  { id: "random",        name: "random",        description: "Anything goes", type: "public", unread: 0 },
];

// ── Context shape ─────────────────────────────────────────────────────────────
interface ChatContextValue {
  messages: Record<string, ChatMessage[]>;
  channels: Channel[];
  activeChannel: string;
  onlineUsers: ChatUser[];
  typingUser: string | null;
  setActiveChannel: (id: string) => void;
  sendMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  toggleReaction: (msgId: string, emoji: string, userId: string) => void;
  addChannel: (ch: Channel) => void;
  clearUnread: (channelId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
  return ctx;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages]       = useState<Record<string, ChatMessage[]>>(SEED_MESSAGES);
  const [channels, setChannels]       = useState<Channel[]>(CHANNELS);
  const [activeChannel, setActive]    = useState("general");
  const [typingUser, setTypingUser]   = useState<string | null>(null);
  const typingTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineUsers = SEED_USERS;

  const setActiveChannel = useCallback((id: string) => {
    setActive(id);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
  }, []);

  const sendMessage = useCallback((msg: Omit<ChatMessage, "id" | "createdAt">) => {
    const full: ChatMessage = { ...msg, id: "msg_" + Date.now() + Math.random(), createdAt: new Date().toISOString() };
    setMessages(prev => ({
      ...prev,
      [msg.channelId]: [...(prev[msg.channelId] || []), full],
    }));

    // Simulate reply
    const chance = Math.random();
    if (chance < 0.45 && msg.type === "text") {
      const responders = SEED_USERS.filter(u => u.isOnline && u.id !== msg.author.id);
      if (responders.length) {
        const r = responders[Math.floor(Math.random() * responders.length)];
        const replies = [
          "Got it! Thanks 👍", "Makes sense!", "Totally agree 🙌",
          "On it! ✅", "Let me check and get back.", "🔥 Love the energy!",
          "Noted 📝", "Interesting — can you elaborate?", "Will do!",
        ];
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        setTypingUser(r.name);
        typingTimerRef.current = setTimeout(() => {
          setTypingUser(null);
          const reply: ChatMessage = {
            id: "msg_" + Date.now(), channelId: msg.channelId, author: r,
            type: "text", text: replies[Math.floor(Math.random() * replies.length)],
            reactions: {}, createdAt: new Date().toISOString(),
          };
          setMessages(prev => ({
            ...prev,
            [msg.channelId]: [...(prev[msg.channelId] || []), reply],
          }));
        }, 1800 + Math.random() * 1500);
      }
    }
  }, []);

  const toggleReaction = useCallback((msgId: string, emoji: string, userId: string) => {
    setMessages(prev => {
      const updated = { ...prev };
      for (const ch of Object.keys(updated)) {
        const idx = updated[ch].findIndex(m => m.id === msgId);
        if (idx !== -1) {
          const msg = { ...updated[ch][idx] };
          const users = [...(msg.reactions[emoji] || [])];
          const pos = users.indexOf(userId);
          if (pos > -1) users.splice(pos, 1); else users.push(userId);
          msg.reactions = { ...msg.reactions, [emoji]: users };
          updated[ch] = [...updated[ch]];
          updated[ch][idx] = msg;
          return updated;
        }
      }
      return prev;
    });
  }, []);

  const addChannel = useCallback((ch: Channel) => {
    setChannels(prev => [...prev, ch]);
    setMessages(prev => ({ ...prev, [ch.id]: [] }));
  }, []);

  const clearUnread = useCallback((channelId: string) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unread: 0 } : c));
  }, []);

  return (
    <ChatContext.Provider value={{ messages, channels, activeChannel, onlineUsers, typingUser, setActiveChannel, sendMessage, toggleReaction, addChannel, clearUnread }}>
      {children}
    </ChatContext.Provider>
  );
};

export { SEED_USERS };
