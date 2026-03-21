import React, { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "../contexts/UserContext";
import { ChatProvider, useChatContext, SEED_USERS } from "../contexts/ChatContext";
import { ChatMessage, ChatUser, UserRole } from "../types/chat";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { EmojiPicker } from "./EmojiPicker";
import { YoutubePanel } from "./YoutubePanel";
import { VideoCallPanel } from "./VideoCallPanel";
import { ProfileModal } from "./ProfileModal";
import { MeetingModal } from "./MeetingModal";

// ── Fonts ────────────────────────────────────────────────────────────────────
const FONT_LINK = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap');
`;

// ── Role badge config ────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  staff:      { bg: "rgba(110,231,183,0.12)", color: "#6ee7b7" },
  admin:      { bg: "rgba(103,232,249,0.12)", color: "#67e8f9" },
  superadmin: { bg: "rgba(249,168,212,0.12)", color: "#f9a8d4" },
  supremo:    { bg: "rgba(252,211,77,0.12)",  color: "#fcd34d" },
};

const roleStyle = (role: string): React.CSSProperties => ({
  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  padding: "2px 7px", borderRadius: 20,
  background: ROLE_COLORS[role]?.bg || "rgba(124,106,247,0.12)",
  color:      ROLE_COLORS[role]?.color || "#a78bfa",
  display: "inline-block",
});

// ── Toast ────────────────────────────────────────────────────────────────────
interface ToastState { msg: string; type: "info" | "success" | "error" }
let _showToast: ((m: string, t?: ToastState["type"]) => void) | null = null;
const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((msg: string, type: ToastState["type"] = "info") => {
    setToast({ msg, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  _showToast = show;
  return { toast, show };
};
const showToast = (m: string, t?: ToastState["type"]) => _showToast?.(m, t);

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};
const fmtDate = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

// ── Inner app (needs ChatContext) ────────────────────────────────────────────
const ChatRoomInner: React.FC = () => {
  const { user: appUser, loginAsUser } = useUser();
  const { messages, channels, activeChannel, onlineUsers, typingUser, setActiveChannel, sendMessage, toggleReaction } = useChatContext();

  // Map appUser → ChatUser shape
  const avatarSeed = encodeURIComponent(appUser?.email || "me");
  const currentUser: ChatUser = {
    id: appUser?.id || "me",
    name: appUser?.name || appUser?.email?.split("@")[0] || "You",
    email: appUser?.email || "me@roswalt.com",
    role: (appUser?.role as UserRole) || "staff",
    avatar: appUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
    isOnline: true,
    status: appUser?.status || "Available",
  };

  // State
  const [sidePanel,    setSidePanel]    = useState<"channels" | "dm" | "music" | "admin">("channels");
  const [showCall,     setShowCall]     = useState(false);
  const [showOnboard,  setShowOnboard]  = useState(() => !localStorage.getItem("nexus_onboard_" + appUser?.email));
  const [showProfile,  setShowProfile]  = useState(false);
  const [showMeeting,  setShowMeeting]  = useState(false);
  const [showPicker,   setShowPicker]   = useState(false);
  const [profileUser,  setProfileUser]  = useState<ChatUser>(currentUser);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [inputText,    setInputText]    = useState("");
  const [dmTarget,     setDmTarget]     = useState<ChatUser | null>(null);
  const { toast, show: showToastFn }    = useToast();

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLDivElement>(null);

  const isAdmin = ["admin", "superadmin", "supremo"].includes(currentUser.role);
  const activeMessages  = messages[dmTarget ? `dm_${dmTarget.id}` : activeChannel] || [];
  const activeChName    = dmTarget ? dmTarget.name : `#${activeChannel}`;
  const activeCh        = channels.find(c => c.id === activeChannel);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages]);
  useEffect(() => {
    if (!showOnboard) return;
    const key = "nexus_onboard_" + appUser?.email;
    if (!localStorage.getItem(key)) localStorage.setItem(key, "1");
  }, [showOnboard, appUser?.email]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const doSend = (override?: Partial<ChatMessage>) => {
    const text = inputRef.current?.innerText.trim() || inputText.trim();
    if (!text && !override?.gif && !override?.type) return;
    const channelId = dmTarget ? `dm_${dmTarget.id}` : activeChannel;
    sendMessage({
      channelId,
      author: profileUser,
      type: "text",
      text,
      reactions: {},
      ...override,
    });
    if (inputRef.current) inputRef.current.innerText = "";
    setInputText("");
    setShowPicker(false);
  };

  const sendSticker = (s: string) => doSend({ type: "sticker", text: s });
  const sendGif     = (url: string) => doSend({ type: "gif", gif: url });
  const insertEmoji = (e: string) => {
    if (inputRef.current) {
      inputRef.current.focus();
      document.execCommand("insertText", false, e);
    }
  };

  const sendMeeting = (title: string, link: string, _recipients: string[]) => {
    const channelId = dmTarget ? `dm_${dmTarget.id}` : activeChannel;
    sendMessage({
      channelId, author: profileUser, type: "meeting",
      text: `📹 ${title} — join link shared`,
      meeting: { title, link, createdBy: profileUser.name },
      reactions: {},
    });
    showToast("Meeting link sent! 🔗", "success");
  };

  const onShareMusic = (text: string) => {
    sendMessage({ channelId: activeChannel, author: profileUser, type: "text", text, reactions: {} });
  };

  // ── Sidebar nav ──────────────────────────────────────────────────────────
  const navItem = (id: typeof sidePanel, icon: string, label: string, show = true) =>
    show ? (
      <button key={id} onClick={() => { setSidePanel(id); setDmTarget(null); }} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 10, border: "none",
        background: sidePanel === id ? "rgba(124,106,247,0.15)" : "none",
        color: sidePanel === id ? "#a78bfa" : "#5a5f7a",
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        fontSize: 12, fontWeight: 600, width: "100%",
        transition: "background 0.15s, color 0.15s",
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        {sidebarOpen && <span>{label}</span>}
      </button>
    ) : null;

  // ── Message rendering ────────────────────────────────────────────────────
  const renderMsg = (msg: ChatMessage, prevMsg: ChatMessage | null, _idx: number) => {
    const showDate = !prevMsg || !sameDay(prevMsg.createdAt, msg.createdAt);
    const isMine   = msg.author.id === "me" || msg.author.email === currentUser.email;

    const reactionEntries = Object.entries(msg.reactions).filter(([, users]) => users.length > 0);

    return (
      <React.Fragment key={msg.id}>
        {showDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 12px", color: "#3a3f5c", fontSize: 11, fontWeight: 700 }}>
            <div style={{ flex: 1, height: 1, background: "#1f2338" }} />
            {fmtDate(msg.createdAt)}
            <div style={{ flex: 1, height: 1, background: "#1f2338" }} />
          </div>
        )}
        <div className="msg-row" style={{
          display: "flex", gap: 10, padding: "3px 8px",
          borderRadius: 10, transition: "background 0.1s",
          position: "relative",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "#181b27")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <img src={msg.author.avatar} alt={msg.author.name} style={{
            width: 34, height: 34, borderRadius: "50%", objectFit: "cover",
            flexShrink: 0, marginTop: 2, border: "1.5px solid #252840",
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: isMine ? "#a78bfa" : "#e0e0f0" }}>
                {msg.author.name}
              </span>
              <span style={roleStyle(msg.author.role)}>{msg.author.role}</span>
              <span style={{ fontSize: 10, color: "#3a3f5c" }}>{fmt(msg.createdAt)}</span>
            </div>

            {/* Message body */}
            {msg.type === "sticker" && (
              <div style={{ fontSize: 52, lineHeight: 1, padding: "4px 0" }}>{msg.text}</div>
            )}
            {msg.type === "gif" && msg.gif && (
              <img src={msg.gif} alt="GIF" loading="lazy" style={{ maxWidth: 220, borderRadius: 10, display: "block", marginTop: 2 }} />
            )}
            {msg.type === "meeting" && msg.meeting && (
              <div style={{
                display: "inline-flex", gap: 12, alignItems: "center",
                background: "#181b27", border: "1px solid #7c6af755",
                borderRadius: 12, padding: "10px 14px", marginTop: 4, maxWidth: 360,
              }}>
                <span style={{ fontSize: 22 }}>📹</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#e0e0f0" }}>{msg.meeting.title}</div>
                  <div style={{ fontSize: 11, color: "#7c6af7", wordBreak: "break-all" }}>{msg.meeting.link}</div>
                </div>
                <button onClick={() => window.open(msg.meeting!.link, "_blank")} style={{
                  background: "#7c6af7", border: "none", borderRadius: 8,
                  color: "#fff", padding: "6px 12px", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>Join</button>
              </div>
            )}
            {(msg.type === "text" || msg.type === "voice" || (!msg.type && msg.text)) && (
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "#d0d0e8", wordBreak: "break-word" }}
                dangerouslySetInnerHTML={{ __html: linkify(esc(msg.text || "")) }}
              />
            )}

            {/* Reactions */}
            {reactionEntries.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                {reactionEntries.map(([emoji, users]) => (
                  <button key={emoji} onClick={() => toggleReaction(msg.id, emoji, "me")} style={{
                    background: users.includes("me") ? "rgba(124,106,247,0.2)" : "#1e2230",
                    border: `1px solid ${users.includes("me") ? "#7c6af7" : "#252840"}`,
                    borderRadius: 20, padding: "2px 8px",
                    cursor: "pointer", fontSize: 12, color: "#e0e0f0",
                    transition: "background 0.15s",
                  }}>
                    {emoji} {users.length}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hover actions */}
          <div className="msg-actions" style={{
            position: "absolute", right: 8, top: 2,
            display: "flex", gap: 3,
            opacity: 0,
            transition: "opacity 0.15s",
          }}>
            {["👍","❤️","😄","🎉"].map(e => (
              <button key={e} onClick={() => toggleReaction(msg.id, e, "me")} style={{
                background: "#1e2230", border: "1px solid #252840", borderRadius: 6,
                padding: "3px 6px", cursor: "pointer", fontSize: 11,
              }}>{e}</button>
            ))}
          </div>
        </div>
      </React.Fragment>
    );
  };

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    ${FONT_LINK}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .msg-row:hover .msg-actions { opacity: 1 !important; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #252840; border-radius: 2px; }
    .ch-item:hover { background: #1a1d2e !important; }
    .ch-item.active { background: rgba(124,106,247,0.12) !important; color: #a78bfa !important; }
    .input-box:empty::before { content: attr(data-placeholder); color: #3a3f5c; pointer-events: none; }
    @keyframes toastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
    .typing-dot { width:5px;height:5px;border-radius:50%;background:#5a5f7a;animation:typingBounce 1.2s infinite; }
    .typing-dot:nth-child(2){animation-delay:.2s}
    .typing-dot:nth-child(3){animation-delay:.4s}
  `;

  return (
    <>
      <style>{css}</style>

      {showOnboard && (
        <OnboardingOverlay
          role={currentUser.role}
          userName={currentUser.name}
          onFinish={() => setShowOnboard(false)}
        />
      )}

      {showProfile && (
        <ProfileModal
          user={profileUser}
          onSave={updates => {
            // 1. Update local chat state immediately
            setProfileUser(prev => ({ ...prev, ...updates }));
            // 2. Persist avatar + name back into UserContext so other pages see it
            if (appUser) {
              loginAsUser({
                ...appUser,
                ...(updates.name   ? { name: updates.name }     : {}),
                ...(updates.avatar ? { avatar: updates.avatar }  : {}),
                ...(updates.status ? { status: updates.status }  : {}),
              });
            }
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showMeeting && (
        <MeetingModal
          currentUser={profileUser}
          allUsers={SEED_USERS}
          onSend={sendMeeting}
          onClose={() => setShowMeeting(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          background: "#181b27", border: `1px solid ${toast.type === "success" ? "#34d399" : toast.type === "error" ? "#f87171" : "#7c6af7"}`,
          borderRadius: 12, padding: "12px 18px", fontSize: 13, color: "#f0f0f6",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "toastIn 0.3s ease",
          fontFamily: "'DM Sans', sans-serif", maxWidth: 320,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── LAYOUT ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", height: "100vh", background: "#0a0b0f", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>

        {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <aside style={{
          width: sidebarOpen ? 252 : 52, flexShrink: 0,
          background: "#111319", borderRight: "1px solid #1a1d2e",
          display: "flex", flexDirection: "column",
          transition: "width 0.3s cubic-bezier(.4,0,.2,1)",
          overflow: "hidden",
        }}>
          {/* Sidebar header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 12px 10px", borderBottom: "1px solid #1a1d2e" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7c6af7, #2dd4bf)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>N</div>
            {sidebarOpen && <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: "#f0f0f6", flex: 1 }}>NexusChat</span>}
            <button onClick={() => setSidebarOpen(s => !s)} style={{ background: "none", border: "none", color: "#3a3f5c", cursor: "pointer", fontSize: 16, padding: 2, flexShrink: 0 }}>☰</button>
          </div>

          {/* Profile */}
          <div onClick={() => setShowProfile(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #1a1d2e", cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#181b27")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={profileUser.avatar} alt="me" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #7c6af7" }} />
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, background: "#34d399", borderRadius: "50%", border: "2px solid #111319" }} />
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profileUser.name}</div>
                <span style={roleStyle(currentUser.role)}>{currentUser.role}</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{ padding: "8px 6px", borderBottom: "1px solid #1a1d2e", display: "flex", flexDirection: "column", gap: 2 }}>
            {navItem("channels", "💬", "Channels")}
            {navItem("dm",       "👤", "Direct")}
            {navItem("music",    "🎵", "Music")}
            {navItem("admin",    "⚙",  "Admin", isAdmin)}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {sidePanel === "channels" && (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "8px 14px 4px", textTransform: "uppercase" }}>Channels</div>
                {channels.map(ch => (
                  <div key={ch.id} className={`ch-item${activeChannel === ch.id && !dmTarget ? " active" : ""}`}
                    onClick={() => { setActiveChannel(ch.id); setDmTarget(null); setSidePanel("channels"); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", cursor: "pointer", color: "#6b7280", fontSize: 13, margin: "1px 6px", borderRadius: 8, transition: "background 0.15s" }}
                  >
                    <span style={{ color: "#3a3f5c", fontSize: 14 }}>#</span>
                    {sidebarOpen && <span style={{ flex: 1 }}>{ch.name}</span>}
                    {sidebarOpen && ch.unread ? <span style={{ background: "#7c6af7", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>{ch.unread}</span> : null}
                  </div>
                ))}
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "10px 14px 4px", textTransform: "uppercase" }}>Online</div>
                {SEED_USERS.filter(u => u.isOnline).map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={u.avatar} alt={u.name} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: -1, right: -1, width: 7, height: 7, background: "#34d399", borderRadius: "50%", border: "1.5px solid #111319", boxShadow: "0 0 5px #34d399" }} />
                    </div>
                    {sidebarOpen && <span style={{ fontSize: 12, color: "#6b7280" }}>{u.name.split(" ")[0]}</span>}
                  </div>
                ))}
              </>
            )}

            {sidePanel === "dm" && (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "8px 14px 4px", textTransform: "uppercase" }}>Direct Messages</div>
                {SEED_USERS.map(u => (
                  <div key={u.id} onClick={() => { setDmTarget(u); setSidePanel("dm"); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer", borderRadius: 8, margin: "1px 6px", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1a1d2e")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={u.avatar} alt={u.name} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #252840" }} />
                      {u.isOnline && <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, background: "#34d399", borderRadius: "50%", border: "1.5px solid #111319" }} />}
                    </div>
                    {sidebarOpen && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0f0" }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: "#3a3f5c" }}>{u.role}</div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {sidePanel === "music" && (
              <YoutubePanel onShareToChat={onShareMusic} />
            )}

            {sidePanel === "admin" && isAdmin && (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "8px 14px 4px", textTransform: "uppercase" }}>Admin Tools</div>
                {[
                  { icon: "📨", label: "Send Meeting Link", action: () => setShowMeeting(true) },
                  { icon: "🔐", label: "Privacy Settings",  action: () => showToast("Privacy settings → connect Settings modal", "info") },
                  { icon: "👥", label: "Manage Members",    action: () => showToast("Member management → connect your User API", "info") },
                ].map(item => (
                  <div key={item.label} onClick={item.action} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    cursor: "pointer", color: "#8b90ad", fontSize: 13, margin: "1px 6px", borderRadius: 8, transition: "background 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#1a1d2e"; e.currentTarget.style.color = "#f0f0f6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8b90ad"; }}
                  >
                    <span>{item.icon}</span>
                    {sidebarOpen && item.label}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 8px", borderTop: "1px solid #1a1d2e", display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button onClick={() => setShowProfile(true)} title="Settings" style={{ background: "none", border: "1px solid #1f2338", borderRadius: 8, color: "#5a5f7a", padding: "6px 8px", cursor: "pointer", fontSize: 14 }}>⚙</button>
          </div>
        </aside>

        {/* ── CHAT MAIN ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0d0f18" }}>
          {/* Chat header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 20px", height: 54, flexShrink: 0,
            background: "#111319", borderBottom: "1px solid #1a1d2e",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {dmTarget ? (
                <>
                  <img src={dmTarget.avatar} alt={dmTarget.name} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#f0f0f6" }}>{dmTarget.name}</span>
                  <span style={roleStyle(dmTarget.role)}>{dmTarget.role}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 18, color: "#3a3f5c", fontWeight: 300 }}>#</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#f0f0f6" }}>{activeChannel}</span>
                  <span style={{ fontSize: 11, color: "#3a3f5c", marginLeft: 4 }}>{activeCh?.description}</span>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { icon: "📹", label: "Start Video Call",  action: () => setShowCall(true)    },
                ...(isAdmin ? [{ icon: "🔗", label: "Meeting Link",     action: () => setShowMeeting(true) }] : []),
                { icon: "🎵", label: "Music Player",      action: () => setSidePanel("music") },
              ].map(b => (
                <button key={b.label} title={b.label} onClick={b.action} style={{
                  background: "none", border: "1px solid #1f2338", borderRadius: 8,
                  color: "#5a5f7a", padding: "6px 9px", cursor: "pointer", fontSize: 15,
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1e2230"; e.currentTarget.style.color = "#f0f0f6"; e.currentTarget.style.borderColor = "#7c6af7"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#5a5f7a"; e.currentTarget.style.borderColor = "#1f2338"; }}
                >{b.icon}</button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
            {activeMessages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#3a3f5c", gap: 8 }}>
                <div style={{ fontSize: 40 }}>👋</div>
                <div style={{ fontSize: 14 }}>No messages yet. Start the conversation!</div>
              </div>
            ) : (
              activeMessages.map((msg, i) => renderMsg(msg, i > 0 ? activeMessages[i - 1] : null, i))
            )}
            {typingUser && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", color: "#5a5f7a", fontSize: 12, fontStyle: "italic" }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {[0,1,2].map(i => <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
                {typingUser} is typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ borderTop: "1px solid #1a1d2e", background: "#111319", padding: "10px 14px", position: "relative" }}>
            {showPicker && (
              <EmojiPicker
                onEmoji={insertEmoji}
                onSticker={sendSticker}
                onGif={sendGif}
                onClose={() => setShowPicker(false)}
              />
            )}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 8,
              background: "#1a1d2e", border: "1px solid #252840",
              borderRadius: 14, padding: "6px 10px",
              transition: "border-color 0.2s",
            }}>
              <button onClick={() => setShowPicker(p => !p)} title="Emoji / Sticker / GIF" style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: showPicker ? "#a78bfa" : "#3a3f5c",
                padding: "2px 4px", flexShrink: 0, transition: "color 0.15s",
              }}>
                😊
              </button>
              <div
                ref={inputRef}
                contentEditable
                data-placeholder={`Message ${activeChName}`}
                className="input-box"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
                style={{
                  flex: 1, minHeight: 24, maxHeight: 140, overflowY: "auto",
                  outline: "none", fontSize: 14, color: "#f0f0f6", lineHeight: 1.6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <button onClick={() => doSend()} style={{
                background: "#7c6af7", border: "none", borderRadius: 10,
                color: "#fff", padding: "7px 12px", cursor: "pointer", flexShrink: 0,
                transition: "opacity 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </main>

        {/* ── VIDEO CALL PANEL ─────────────────────────────────────────── */}
        {showCall && (
          <VideoCallPanel
            channel={activeChannel}
            currentUser={profileUser}
            participants={SEED_USERS.filter(u => u.isOnline).slice(0, 4)}
            onEnd={() => { setShowCall(false); showToast("Call ended", "info"); }}
          />
        )}
      </div>
    </>
  );
};

// ── Utilities ────────────────────────────────────────────────────────────────
function esc(s: string) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function linkify(text: string) {
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#a78bfa">$1</a>');
}

// ── Exported wrapper ─────────────────────────────────────────────────────────
export const ChatRoom: React.FC = () => (
  <ChatProvider>
    <ChatRoomInner />
  </ChatProvider>
);

export default ChatRoom;




