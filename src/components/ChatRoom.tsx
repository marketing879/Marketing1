import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUser } from "../contexts/UserContext";
import { ChatProvider, useChatContext, SEED_USERS } from "../contexts/ChatContext";
import { ChatMessage, ChatUser, UserRole } from "../types/chat";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { EmojiPicker } from "./EmojiPicker";
import { YoutubePanel } from "./YoutubePanel";
import { VideoCallPanel } from "./VideoCallPanel";
import { ProfileModal } from "./ProfileModal";
import { MeetingModal } from "./MeetingModal";

const FONT_LINK = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap');
`;

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

function esc(s: string) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function linkify(text: string) {
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#a78bfa">$1</a>');
}

const ChatRoomInner: React.FC = () => {
  // ── Pull real users from UserContext ──────────────────────────────────────
  const { user: appUser, loginAsUser, teamMembers } = useUser();
  const { messages, channels, activeChannel, typingUser, setActiveChannel, sendMessage, toggleReaction } = useChatContext();

  // Build real ChatUser list from teamMembers, fall back to SEED_USERS if empty
  const realUsers: ChatUser[] = useMemo(() => {
    const members = (teamMembers || []).filter(m => m && m.email);
    if (members.length === 0) return SEED_USERS;
    return members.map(m => ({
      id:       m.id || m.email,
      name:     m.name || m.email.split("@")[0],
      email:    m.email,
      role:     (m.role as UserRole) || "staff",
      avatar:   (m as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.email)}`,
      isOnline: (m as any).isOnline ?? false,
      status:   (m as any).status || "Available",
    }));
  }, [teamMembers]);

  const avatarSeed = encodeURIComponent(appUser?.email || "me");
  const currentUser: ChatUser = useMemo(() => ({
    id:       appUser?.id || appUser?.email || "me",
    name:     appUser?.name || appUser?.email?.split("@")[0] || "You",
    email:    appUser?.email || "me@roswalt.com",
    role:     (appUser?.role as UserRole) || "staff",
    avatar:   (appUser as any)?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
    isOnline: true,
    status:   (appUser as any)?.status || "Available",
  }), [appUser, avatarSeed]);

  const [sidePanel,   setSidePanel]   = useState<"channels" | "dm" | "music" | "admin">("channels");
  const [showCall,    setShowCall]    = useState(false);
  // ── Onboard state from MongoDB (chatOnboarded flag on user record) ─────────
  const [showOnboard, setShowOnboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [profileUser, setProfileUser] = useState<ChatUser>(currentUser);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputText,   setInputText]   = useState("");
  const [dmTarget,    setDmTarget]    = useState<ChatUser | null>(null);
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLDivElement>(null);

  const isAdmin        = ["admin", "superadmin", "supremo"].includes(currentUser.role);
  const activeMessages = useMemo(() => messages[dmTarget ? `dm_${dmTarget.id}` : activeChannel] || [], [messages, dmTarget, activeChannel]);
  const activeChName   = dmTarget ? dmTarget.name : `#${activeChannel}`;
  const activeCh       = channels.find(c => c.id === activeChannel);

  // Keep profileUser in sync with appUser changes
  useEffect(() => {
    setProfileUser(prev => ({
      ...prev,
      name:   appUser?.name   || prev.name,
      avatar: (appUser as any)?.avatar || prev.avatar,
      status: (appUser as any)?.status || prev.status,
    }));
  }, [appUser]);

  // ── Load onboard state from MongoDB on mount ────────────────────────────────
  useEffect(() => {
    if (!appUser?.id && !appUser?.email) return;
    const userId = appUser.id || appUser.email;
    fetch(`https://adaptable-patience-production-45da.up.railway.app/api/users/${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.chatOnboarded) setShowOnboard(true);
      })
      .catch(() => {});
  }, [appUser?.id, appUser?.email]);

  // ── Save onboard completion to MongoDB ──────────────────────────────────────
  const completeOnboard = useCallback(() => {
    setShowOnboard(false);
    const userId = appUser?.id || appUser?.email;
    if (!userId) return;
    fetch(`https://adaptable-patience-production-45da.up.railway.app/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatOnboarded: true }),
    }).catch(() => {});
  }, [appUser?.id, appUser?.email]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages]);

  const doSend = (override?: Partial<ChatMessage>) => {
    const text = inputRef.current?.innerText.trim() || inputText.trim();
    if (!text && !override?.gif && !override?.type) return;
    const channelId = dmTarget ? `dm_${dmTarget.id}` : activeChannel;
    sendMessage({ channelId, author: profileUser, type: "text", text, reactions: {}, ...override });
    if (inputRef.current) inputRef.current.innerText = "";
    setInputText("");
    setShowPicker(false);
  };

  const sendSticker = (s: string) => doSend({ type: "sticker", text: s });
  const sendGif     = (url: string) => doSend({ type: "gif", gif: url });
  const insertEmoji = (e: string) => {
    if (inputRef.current) { inputRef.current.focus(); document.execCommand("insertText", false, e); }
  };

  const sendMeeting = (title: string, link: string, _recipients: string[]) => {
    const channelId = dmTarget ? `dm_${dmTarget.id}` : activeChannel;
    sendMessage({ channelId, author: profileUser, type: "meeting", text: `📹 ${title} — join link shared`, meeting: { title, link, createdBy: profileUser.name }, reactions: {} });
    showToast("Meeting link sent! 🔗", "success");
  };

  const onShareMusic = (text: string) => {
    sendMessage({ channelId: activeChannel, author: profileUser, type: "text", text, reactions: {} });
  };

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

  const renderMsg = (msg: ChatMessage, prevMsg: ChatMessage | null, _idx: number) => {
    const showDate = !prevMsg || !sameDay(prevMsg.createdAt, msg.createdAt);
    const isMine   = msg.author.id === currentUser.id || msg.author.email === currentUser.email;
    const reactionEntries = Object.entries(msg.reactions).filter(([, users]) => (users as string[]).length > 0);

    return (
      <React.Fragment key={msg.id}>
        {showDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 12px", color: "#3a3f5c", fontSize: 11, fontWeight: 700 }}>
            <div style={{ flex: 1, height: 1, background: "#1f2338" }} />
            {fmtDate(msg.createdAt)}
            <div style={{ flex: 1, height: 1, background: "#1f2338" }} />
          </div>
        )}
        <div className="msg-row" style={{ display: "flex", gap: 10, padding: "3px 8px", borderRadius: 10, transition: "background 0.1s", position: "relative" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#181b27")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <img src={msg.author.avatar} alt={msg.author.name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: 2, border: "1.5px solid #252840" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: isMine ? "#a78bfa" : "#e0e0f0" }}>{msg.author.name}</span>
              <span style={roleStyle(msg.author.role)}>{msg.author.role}</span>
              <span style={{ fontSize: 10, color: "#3a3f5c" }}>{fmt(msg.createdAt)}</span>
            </div>
            {msg.type === "sticker" && <div style={{ fontSize: 52, lineHeight: 1, padding: "4px 0" }}>{msg.text}</div>}
            {msg.type === "gif" && msg.gif && <img src={msg.gif} alt="GIF" loading="lazy" style={{ maxWidth: 220, borderRadius: 10, display: "block", marginTop: 2 }} />}
            {msg.type === "meeting" && msg.meeting && (
              <div style={{ display: "inline-flex", gap: 12, alignItems: "center", background: "#181b27", border: "1px solid #7c6af755", borderRadius: 12, padding: "10px 14px", marginTop: 4, maxWidth: 340 }}>
                <span style={{ fontSize: 22 }}>📹</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#e0e0f0" }}>{msg.meeting.title}</div>
                  <div style={{ fontSize: 11, color: "#7c6af7", wordBreak: "break-all" }}>{msg.meeting.link}</div>
                </div>
                <button onClick={() => window.open(msg.meeting!.link, "_blank")} style={{ background: "#7c6af7", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Join</button>
              </div>
            )}
            {(msg.type === "text" || msg.type === "voice" || (!msg.type && msg.text)) && (
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "#d0d0e8", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: linkify(esc(msg.text || "")) }} />
            )}
            {reactionEntries.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                {reactionEntries.map(([emoji, users]) => (
                  <button key={emoji} onClick={() => toggleReaction(msg.id, emoji, currentUser.id)} style={{
                    background: (users as string[]).includes(currentUser.id) ? "rgba(124,106,247,0.2)" : "#1e2230",
                    border: `1px solid ${(users as string[]).includes(currentUser.id) ? "#7c6af7" : "#252840"}`,
                    borderRadius: 20, padding: "2px 8px", cursor: "pointer", fontSize: 12, color: "#e0e0f0", transition: "background 0.15s",
                  }}>
                    {emoji} {(users as string[]).length}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="msg-actions" style={{ position: "absolute", right: 8, top: 2, display: "flex", gap: 3, opacity: 0, transition: "opacity 0.15s" }}>
            {["👍","❤️","😄","🎉"].map(e => (
              <button key={e} onClick={() => toggleReaction(msg.id, e, currentUser.id)} style={{ background: "#1e2230", border: "1px solid #252840", borderRadius: 6, padding: "3px 6px", cursor: "pointer", fontSize: 11 }}>{e}</button>
            ))}
          </div>
        </div>
      </React.Fragment>
    );
  };

  const css = `
    ${FONT_LINK}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .sc-chat-wrap { display: flex; width: 100%; height: 100%; background: #0a0b0f; font-family: 'DM Sans', sans-serif; overflow: hidden; }
    .sc-sidebar { flex-shrink: 0; background: #111319; border-right: 1px solid #1a1d2e; display: flex; flex-direction: column; overflow: hidden; transition: width 0.3s cubic-bezier(.4,0,.2,1); }
    .sc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: #0d0f18; }
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

  // Sidebar width
  const SW = sidebarOpen ? 240 : 52;

  return (
    <>
      <style>{css}</style>

      {showOnboard && (
        <OnboardingOverlay role={currentUser.role} userName={currentUser.name} onFinish={completeOnboard} />
      )}

      {showProfile && (
        <ProfileModal
          user={profileUser}
          onSave={updates => {
            setProfileUser(prev => ({ ...prev, ...updates }));
            if (appUser) {
              loginAsUser({
                ...appUser,
                ...(updates.name   ? { name: updates.name }    : {}),
                ...(updates.avatar ? { avatar: updates.avatar } : {}),
                ...(updates.status ? { status: updates.status } : {}),
              });
            }
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showMeeting && (
        <MeetingModal
          currentUser={profileUser}
          allUsers={realUsers}
          onSend={sendMeeting}
          onClose={() => setShowMeeting(false)}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          background: "#181b27",
          border: `1px solid ${toast.type === "success" ? "#34d399" : toast.type === "error" ? "#f87171" : "#7c6af7"}`,
          borderRadius: 12, padding: "12px 18px", fontSize: 13, color: "#f0f0f6",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "toastIn 0.3s ease",
          fontFamily: "'DM Sans', sans-serif", maxWidth: 320,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── ROOT LAYOUT — fills whatever container it's placed in ── */}
      <div className="sc-chat-wrap">

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="sc-sidebar" style={{ width: SW }}>

          {/* Header — SmartCue ChatRoom branding */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 10px 10px", borderBottom: "1px solid #1a1d2e", flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg, #7c6af7, #2dd4bf)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 11, color: "#fff",
            }}>SC</div>
            {sidebarOpen && (
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 13, color: "#f0f0f6", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                SmartCue ChatRoom
              </span>
            )}
            <button onClick={() => setSidebarOpen(s => !s)} style={{ background: "none", border: "none", color: "#3a3f5c", cursor: "pointer", fontSize: 16, padding: 2, flexShrink: 0 }}>☰</button>
          </div>

          {/* Current user profile row */}
          <div onClick={() => setShowProfile(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderBottom: "1px solid #1a1d2e", cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = "#181b27")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={profileUser.avatar} alt="me" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "2px solid #7c6af7", display: "block" }} />
              <div style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, background: "#34d399", borderRadius: "50%", border: "2px solid #111319" }} />
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profileUser.name}</div>
                <span style={roleStyle(currentUser.role)}>{currentUser.role}</span>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div style={{ padding: "6px 5px", borderBottom: "1px solid #1a1d2e", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            {navItem("channels", "💬", "Channels")}
            {navItem("dm",       "👤", "Direct")}
            {navItem("music",    "🎵", "Music")}
            {navItem("admin",    "⚙",  "Admin", isAdmin)}
          </div>

          {/* Panel content — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

            {sidePanel === "channels" && (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "8px 12px 4px", textTransform: "uppercase" }}>Channels</div>
                {channels.map(ch => (
                  <div key={ch.id}
                    className={`ch-item${activeChannel === ch.id && !dmTarget ? " active" : ""}`}
                    onClick={() => { setActiveChannel(ch.id); setDmTarget(null); setSidePanel("channels"); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", cursor: "pointer", color: "#6b7280", fontSize: 13, margin: "1px 4px", borderRadius: 8 }}
                  >
                    <span style={{ color: "#3a3f5c", fontSize: 14, flexShrink: 0 }}>#</span>
                    {sidebarOpen && <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.name}</span>}
                    {sidebarOpen && ch.unread ? <span style={{ background: "#7c6af7", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px", flexShrink: 0 }}>{ch.unread}</span> : null}
                  </div>
                ))}

                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "10px 12px 4px", textTransform: "uppercase" }}>
                  Online ({realUsers.filter(u => u.isOnline).length})
                </div>
                {realUsers.filter(u => u.isOnline).map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={u.avatar} alt={u.name} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", bottom: -1, right: -1, width: 7, height: 7, background: "#34d399", borderRadius: "50%", border: "1.5px solid #111319" }} />
                    </div>
                    {sidebarOpen && <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name.split(" ")[0]}</span>}
                  </div>
                ))}
              </>
            )}

            {sidePanel === "dm" && (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "8px 12px 4px", textTransform: "uppercase" }}>
                  Team ({realUsers.length})
                </div>
                {realUsers.map(u => (
                  <div key={u.id} onClick={() => { setDmTarget(u); setSidePanel("dm"); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", borderRadius: 8, margin: "1px 4px" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1a1d2e")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={u.avatar} alt={u.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #252840", display: "block" }} />
                      {u.isOnline && <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, background: "#34d399", borderRadius: "50%", border: "1.5px solid #111319" }} />}
                    </div>
                    {sidebarOpen && (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: "#3a3f5c" }}>{u.role}</div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {sidePanel === "music" && <YoutubePanel onShareToChat={onShareMusic} />}

            {sidePanel === "admin" && isAdmin && (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "#3a3f5c", padding: "8px 12px 4px", textTransform: "uppercase" }}>Admin Tools</div>
                {[
                  { icon: "📨", label: "Send Meeting Link", action: () => setShowMeeting(true) },
                  { icon: "🔐", label: "Privacy Settings",  action: () => showToast("Privacy settings — coming soon", "info") },
                  { icon: "👥", label: "Manage Members",    action: () => showToast("Member management — connect your User API", "info") },
                ].map(item => (
                  <div key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", color: "#8b90ad", fontSize: 13, margin: "1px 4px", borderRadius: 8 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#1a1d2e"; (e.currentTarget as HTMLDivElement).style.color = "#f0f0f6"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; (e.currentTarget as HTMLDivElement).style.color = "#8b90ad"; }}
                  >
                    <span>{item.icon}</span>
                    {sidebarOpen && item.label}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "8px 6px", borderTop: "1px solid #1a1d2e", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
            <button onClick={() => setShowProfile(true)} title="Profile settings" style={{ background: "none", border: "1px solid #1f2338", borderRadius: 8, color: "#5a5f7a", padding: "5px 8px", cursor: "pointer", fontSize: 14 }}>⚙</button>
          </div>
        </aside>

        {/* ── CHAT MAIN ────────────────────────────────────────────────── */}
        <main className="sc-main">

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 52, flexShrink: 0, background: "#111319", borderBottom: "1px solid #1a1d2e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
              {dmTarget ? (
                <>
                  <img src={dmTarget.avatar} alt={dmTarget.name} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#f0f0f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dmTarget.name}</span>
                  <span style={roleStyle(dmTarget.role)}>{dmTarget.role}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 16, color: "#3a3f5c", fontWeight: 300, flexShrink: 0 }}>#</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#f0f0f6", whiteSpace: "nowrap" }}>{activeChannel}</span>
                  {activeCh?.description && <span style={{ fontSize: 11, color: "#3a3f5c", marginLeft: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeCh.description}</span>}
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {[
                { icon: "📹", label: "Start Video Call",  action: () => setShowCall(true)    },
                ...(isAdmin ? [{ icon: "🔗", label: "Meeting Link", action: () => setShowMeeting(true) }] : []),
                { icon: "🎵", label: "Music Player",      action: () => setSidePanel("music") },
              ].map(b => (
                <button key={b.label} title={b.label} onClick={b.action} style={{ background: "none", border: "1px solid #1f2338", borderRadius: 8, color: "#5a5f7a", padding: "5px 8px", cursor: "pointer", fontSize: 14, transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1e2230"; (e.currentTarget as HTMLButtonElement).style.color = "#f0f0f6"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#7c6af7"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#5a5f7a"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#1f2338"; }}
                >{b.icon}</button>
              ))}
            </div>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
            {activeMessages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#3a3f5c", gap: 8 }}>
                <div style={{ fontSize: 36 }}>👋</div>
                <div style={{ fontSize: 13 }}>No messages yet — start the conversation!</div>
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
          <div style={{ borderTop: "1px solid #1a1d2e", background: "#111319", padding: "8px 12px", position: "relative", flexShrink: 0 }}>
            {showPicker && (
              <EmojiPicker onEmoji={insertEmoji} onSticker={sendSticker} onGif={sendGif} onClose={() => setShowPicker(false)} />
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#1a1d2e", border: "1px solid #252840", borderRadius: 12, padding: "5px 10px" }}>
              <button onClick={() => setShowPicker(p => !p)} title="Emoji / Sticker / GIF" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: showPicker ? "#a78bfa" : "#3a3f5c", padding: "2px 2px", flexShrink: 0 }}>
                😊
              </button>
              <div
                ref={inputRef}
                contentEditable
                data-placeholder={`Message ${activeChName}`}
                className="input-box"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
                style={{ flex: 1, minHeight: 22, maxHeight: 120, overflowY: "auto", outline: "none", fontSize: 13, color: "#f0f0f6", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}
              />
              <button onClick={() => doSend()} style={{ background: "#7c6af7", border: "none", borderRadius: 9, color: "#fff", padding: "6px 11px", cursor: "pointer", flexShrink: 0 }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </main>

        {/* ── VIDEO CALL PANEL ─────────────────────────────────────────── */}
        {showCall && (
          <VideoCallPanel
            channel={activeChannel}
            currentUser={profileUser}
            participants={realUsers.filter(u => u.isOnline).slice(0, 4)}
            onEnd={() => { setShowCall(false); showToast("Call ended", "info"); }}
          />
        )}
      </div>
    </>
  );
};

export const ChatRoom: React.FC = () => (
  <ChatProvider>
    <ChatRoomInner />
  </ChatProvider>
);

export default ChatRoom;