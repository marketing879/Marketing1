import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { ChatMessage, ChatUser, Channel } from "../types/chat";

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

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages,      setMessages]   = useState<Record<string, ChatMessage[]>>({});
  const [channels,      setChannels]   = useState<Channel[]>(CHANNELS);
  const [activeChannel, setActive]     = useState("general");
  const [typingUser,    setTypingUser] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineUsers: ChatUser[] = [];

  const setActiveChannel = useCallback((id: string) => {
    setActive(id);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
  }, []);

  const sendMessage = useCallback((msg: Omit<ChatMessage, "id" | "createdAt">) => {
    const full: ChatMessage = {
      ...msg,
      id:        "msg_" + Date.now() + Math.random(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => ({
      ...prev,
      [msg.channelId]: [...(prev[msg.channelId] || []), full],
    }));
  }, []);

  const toggleReaction = useCallback((msgId: string, emoji: string, userId: string) => {
    setMessages(prev => {
      const updated = { ...prev };
      for (const ch of Object.keys(updated)) {
        const idx = updated[ch].findIndex(m => m.id === msgId);
        if (idx !== -1) {
          const msg   = { ...updated[ch][idx] };
          const users = [...(msg.reactions[emoji] || [])];
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
  }, []);

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

// Empty — no mock users
export const SEED_USERS: ChatUser[] = [];