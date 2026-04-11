import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChatProvider, useChatContext } from "../contexts/ChatContext";
import { useUser } from "../contexts/UserContext";
import { ChatUser, UserRole } from "../types/chat";
import { ChatRoom } from "./ChatRoom";

const API = "https://api.roswaltsmartcue.com";

const getDMChannelId = (idA: string, idB: string) =>
  "dm_" + [idA, idB].sort().join("__");

// ── Toast notification shown on dashboard when a message arrives ──────────────
interface ToastNotif { id: number; senderName: string; text: string; avatar: string; isDM: boolean; }

const NotifToast: React.FC<{ notif: ToastNotif; onDismiss: () => void; onOpen: () => void }> = ({ notif, onDismiss, onOpen }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "#111319", border: "1px solid #1a1d2e",
      borderRadius: 12, padding: "10px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      cursor: "pointer", maxWidth: 300, animation: "fcbSlideDown 0.3s ease",
      marginBottom: 8,
    }}>
      <img src={notif.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(notif.senderName)}&backgroundColor=1a1d2e&textColor=a78bfa`}
        alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #7c6af7" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0f0", display: "flex", alignItems: "center", gap: 6 }}>
          {notif.senderName}
          {notif.isDM && <span style={{ fontSize: 9, background: "rgba(124,106,247,0.2)", color: "#a78bfa", borderRadius: 6, padding: "1px 5px" }}>DM</span>}
        </div>
        <div style={{ fontSize: 11, color: "#5a5f7a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
          {notif.text}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{ background: "none", border: "none", color: "#3a3f5c", cursor: "pointer", fontSize: 16, padding: 0, flexShrink: 0 }}>×</button>
    </div>
  );
};

// ── Inner component that reads from ChatContext ───────────────────────────────
const FloatingChatButtonInner: React.FC = () => {
  const { user }           = useUser();
  const { messages, channels, unreadDMs } = useChatContext();
  const [open, setOpen]    = useState(false);
  const [notifs, setNotifs] = useState<ToastNotif[]>([]);
  const notifIdRef         = useRef(0);
  const prevMessagesRef    = useRef<Record<string, number>>({});
  const mountedRef         = useRef(false);
  const currentUserId      = user?.id || user?.email || "";

  // Track new messages across all channels and DMs, show toast notifications
  useEffect(() => {
    if (!mountedRef.current) {
      // On first render just snapshot current counts — don't notify for history
      Object.keys(messages).forEach(ch => {
        prevMessagesRef.current[ch] = (messages[ch] || []).length;
      });
      mountedRef.current = true;
      return;
    }

    Object.keys(messages).forEach(ch => {
      const msgs     = messages[ch] || [];
      const prev     = prevMessagesRef.current[ch] || 0;
      if (msgs.length <= prev) { prevMessagesRef.current[ch] = msgs.length; return; }

      const newMsgs  = msgs.slice(prev);
      prevMessagesRef.current[ch] = msgs.length;

      newMsgs.forEach(msg => {
        if (!msg) return;
        const authorId    = msg.author?.id || (msg as any).authorId || "";
        const authorEmail = msg.author?.email || (msg as any).authorEmail || "";
        // Skip own messages
        if (authorId === currentUserId || authorEmail === (user?.email || "")) return;
        // Skip if chat is open
        if (open) return;

        const senderName = msg.author?.name || (msg as any).authorName || "Someone";
        const avatar     = msg.author?.avatar || (msg as any).authorAvatar || "";
        const text       = msg.type === "text" ? (msg.text || "").slice(0, 60)
                         : msg.type === "meeting" ? "Shared a meeting link"
                         : msg.type === "sticker" ? msg.text || "Sent a sticker"
                         : msg.type === "gif" ? "Sent a GIF"
                         : "New message";
        const isDM       = ch.startsWith("dm_");

        const id = ++notifIdRef.current;
        setNotifs(prev2 => [...prev2.slice(-3), { id, senderName, text, avatar, isDM }]);
      });
    });
  }, [messages]);

  // Total unread = channel unreads + DM unreads
  const channelUnread = channels.reduce((sum, ch) => sum + (ch.unread || 0), 0);
  const dmUnread      = Object.values(unreadDMs).reduce((a, b) => a + b, 0);
  const totalUnread   = channelUnread + dmUnread;

  const handleOpen  = () => { setOpen(true); setNotifs([]); };
  const handleClose = () => setOpen(false);
  const dismissNotif = useCallback((id: number) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
  }, []);

  if (!user) return null;

  return (
    <>
      <style>{`
        @keyframes fcbPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(201,169,110,0.45), 0 4px 20px rgba(0,0,0,0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(201,169,110,0),  0 4px 20px rgba(0,0,0,0.5); }
        }
        @keyframes fcbBadgePop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes fcbSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fcbSlideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        .fcb-btn {
          position: fixed; bottom: 28px; right: 28px; z-index: 8000;
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #c9a96e, #9a7a4a);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          transition: transform 0.18s, right 0.28s cubic-bezier(0.22,1,0.36,1), background 0.18s;
          animation: fcbPulse 3s ease-in-out infinite;
        }
        .fcb-btn.is-open {
          right: calc(440px + 16px);
          background: rgba(20,22,36,0.95);
          border: 1px solid rgba(201,169,110,0.2);
          animation: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .fcb-btn:hover  { transform: scale(1.1); }
        .fcb-btn:active { transform: scale(0.95); }
        .fcb-badge {
          position: absolute; top: -4px; right: -4px;
          min-width: 20px; height: 20px;
          background: #ef4444; border: 2px solid #060a15; border-radius: 10px;
          font-size: 9px; font-weight: 900; color: #fff;
          display: flex; align-items: center; justify-content: center; padding: 0 4px;
          animation: fcbBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 0 8px rgba(239,68,68,0.7);
          font-family: 'DM Sans', sans-serif;
        }
        .fcb-tooltip {
          position: absolute; right: calc(100% + 10px); top: 50%;
          transform: translateY(-50%);
          background: rgba(8,11,26,0.95); border: 1px solid rgba(201,169,110,0.2);
          border-radius: 8px; padding: 5px 10px;
          font-size: 11px; font-weight: 600; color: #eef0ff;
          white-space: nowrap; pointer-events: none; opacity: 0;
          transition: opacity 0.15s; font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .fcb-btn:hover .fcb-tooltip { opacity: 1; }
        .fcb-panel {
          position: fixed; top: 0; right: 0; width: 440px; height: 100vh;
          z-index: 7999; box-shadow: -8px 0 48px rgba(0,0,0,0.65);
          border-left: 1px solid rgba(201,169,110,0.12);
          animation: fcbSlideIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards;
          overflow: hidden; display: flex; flex-direction: column; background: #0c0d13;
        }
        .fcb-clickaway {
          position: fixed; top: 0; left: 0; right: 440px; bottom: 0;
          z-index: 7998; background: transparent; cursor: default;
        }
        @media (max-width: 520px) {
          .fcb-panel  { width: 100vw; }
          .fcb-btn.is-open { right: calc(100vw - 64px); }
          .fcb-clickaway { display: none; }
        }
      `}</style>

      {/* Toast notifications stack — bottom right above the chat button */}
      {notifs.length > 0 && (
        <div style={{ position: "fixed", bottom: 92, right: 28, zIndex: 8001, display: "flex", flexDirection: "column-reverse" }}>
          {notifs.map(n => (
            <NotifToast
              key={n.id}
              notif={n}
              onDismiss={() => dismissNotif(n.id)}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}

      <button
        className={`fcb-btn${open ? " is-open" : ""}`}
        onClick={open ? handleClose : handleOpen}
        title={open ? "Close Chat" : "SmartCue ChatRoom"}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#c9a96e" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#0c0d13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && totalUnread > 0 && (
          <span className="fcb-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
        )}
        <span className="fcb-tooltip">{open ? "Close Chat" : "SmartCue ChatRoom"}</span>
      </button>

      {open && (
        <>
          <div className="fcb-clickaway" onClick={handleClose} />
          <div className="fcb-panel">
            <ChatRoom />
          </div>
        </>
      )}
    </>
  );
};

// ── Wrapper — provides ChatContext ────────────────────────────────────────────
const FloatingChatButtonWrapper: React.FC = () => {
  const { user: appUser, teamMembers: rawMembers } = useUser();

  const currentUser: ChatUser = {
    id:       appUser?.id || appUser?.email || "me",
    name:     appUser?.name || appUser?.email?.split("@")[0] || "You",
    email:    appUser?.email || "me@roswalt.com",
    role:     (appUser?.role as UserRole) || "staff",
    avatar:   (appUser as any)?.avatar || "",
    isOnline: true,
    status:   (appUser as any)?.status || "Available",
  };

  const teamMembers: ChatUser[] = (rawMembers || [])
    .filter((m: any) => m?.email && m?.id)
    .map((m: any) => ({
      id:       m.id,
      name:     m.name || m.email.split("@")[0],
      email:    m.email,
      role:     (m.role as UserRole) || "staff",
      avatar:   (m as any).avatar || "",
      isOnline: (m as any).isOnline ?? false,
      status:   (m as any).status || "Available",
    }));

  return (
    <ChatProvider currentUser={currentUser} teamMembers={teamMembers}>
      <FloatingChatButtonInner />
    </ChatProvider>
  );
};

export const FloatingChatButton: React.FC = () => <FloatingChatButtonWrapper />;
export default FloatingChatButton;
