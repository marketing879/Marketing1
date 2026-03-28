import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUser } from "../contexts/UserContext";
import { ChatProvider, useChatContext } from "../contexts/ChatContext";
import roswaltLogo from "../assets/ROSWALT-LOGO-GOLDEN-8K.png";
import { ChatMessage, ChatUser, UserRole, Channel } from "../types/chat";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { EmojiPicker } from "./EmojiPicker";
import { YoutubePanel } from "./YoutubePanel";
import { VideoCallPanel } from "./VideoCallPanel";
import { ProfileModal } from "./ProfileModal";
import { MeetingModal } from "./MeetingModal";

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
  return { toast };
};
const showToast = (m: string, t?: ToastState["type"]) => _showToast?.(m, t);

const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDate = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
const esc = (s: string) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const linkify = (t: string) => t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#a78bfa">$1</a>');

// Shared DM room — sort both IDs so A→B and B→A use the same channel
const getDMChannelId = (idA: string, idB: string) =>
  "dm_" + [idA, idB].sort().join("__");

const ChatRoomInner: React.FC = () => {
  const { user: appUser, loginAsUser, teamMembers } = useUser();
  const { messages, channels, activeChannel, typingUser, unreadDMs, setActiveChannel, sendMessage, toggleReaction, clearDMUnread } = useChatContext();

  const realUsers: ChatUser[] = useMemo(() => {
    return (teamMembers || [])
      .filter(m => m && m.email && m.id)
      .map(m => ({
        id:       m.id,
        name:     m.name || m.email.split("@")[0],
        email:    m.email,
        role:     (m.role as UserRole) || "staff",
        avatar:   (m as any).avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name || m.email)}&backgroundColor=1a1d2e&textColor=a78bfa`,
        isOnline: (m as any).isOnline ?? false,
        status:   (m as any).status || "Available",
      }));
  }, [teamMembers]);

  const currentUser: ChatUser = useMemo(() => ({
    id:       appUser?.id || appUser?.email || "me",
    name:     appUser?.name || appUser?.email?.split("@")[0] || "You",
    email:    appUser?.email || "me@roswalt.com",
    role:     (appUser?.role as UserRole) || "staff",
    avatar:   (appUser as any)?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(appUser?.name || appUser?.email || "me")}&backgroundColor=1a1d2e&textColor=a78bfa`,
    isOnline: true,
    status:   (appUser as any)?.status || "Available",
  }), [appUser]);

  const [showCall,    setShowCall]    = useState(false);
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [showDMList,  setShowDMList]  = useState(false);
  const [showMusic,   setShowMusic]   = useState(false);
  const [profileUser, setProfileUser] = useState<ChatUser>(currentUser);
  const [inputText,   setInputText]   = useState("");
  const [dmTarget,    setDmTarget]    = useState<ChatUser | null>(null);
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLDivElement>(null);
  const dmListRef      = useRef<HTMLDivElement>(null);

  const isAdmin        = ["admin", "superadmin", "supremo"].includes(currentUser.role);
  const activeMessages = useMemo(() => {
    if (!currentUser.id || currentUser.id === "me") return messages[activeChannel] || [];
    const ch = dmTarget ? getDMChannelId(currentUser.id, dmTarget.id) : activeChannel;
    return messages[ch] || [];
  }, [messages, dmTarget, activeChannel, currentUser.id]);
  const activeChName = dmTarget ? `${dmTarget.name.split(" ")[0]}` : `#${activeChannel}`;
  const activeCh       = channels.find((c: Channel) => c.id === activeChannel);

  // When dmTarget changes, join the shared DM channel and clear unread
  useEffect(() => {
    if (!dmTarget?.id || !currentUser.id || currentUser.id === "me") return;
    const dmChannelId = getDMChannelId(currentUser.id, dmTarget.id);
    setActiveChannel(dmChannelId);
    clearDMUnread(dmChannelId);
  }, [dmTarget, currentUser.id, setActiveChannel, clearDMUnread]);

  useEffect(() => {
    setProfileUser(prev => ({
      ...prev,
      name:   appUser?.name   || prev.name,
      avatar: (appUser as any)?.avatar || prev.avatar,
      status: (appUser as any)?.status || prev.status,
    }));
  }, [appUser]);

  useEffect(() => {
    if (!appUser?.email) return;
    fetch(`https://adaptable-patience-production-45da.up.railway.app/api/users/${encodeURIComponent(appUser.email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.chatOnboarded) setShowOnboard(true); })
      .catch(() => {});
  }, [appUser?.email]);

  const completeOnboard = useCallback(() => {
    setShowOnboard(false);
    if (!appUser?.email) return;
    fetch(`https://adaptable-patience-production-45da.up.railway.app/api/users/${encodeURIComponent(appUser.email)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatOnboarded: true }),
    }).catch(() => {});
  }, [appUser?.email]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages]);

  useEffect(() => {
    if (!showDMList) return;
    const handle = (e: MouseEvent) => {
      if (dmListRef.current && !dmListRef.current.contains(e.target as Node)) setShowDMList(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showDMList]);

  const startCall = useCallback((roomUrl?: string) => {
    const room = roomUrl || `roswalt-smartcue-${activeChannel}`;
    const jitsiUrl = room.startsWith("http")
      ? (room.includes("meet.jit.si") ? room : `https://meet.jit.si/${encodeURIComponent(room.replace(/https?:\/\/[^/]+\//, ""))}`)
      : `https://meet.jit.si/${room}`;
    setCallRoomUrl(jitsiUrl);
    setShowCall(true);
  }, [activeChannel]);

  const doSend = (override?: Partial<ChatMessage>) => {
    const text = inputRef.current?.innerText.trim() || inputText.trim();
    if (!text && !override?.gif && !override?.type) return;
    const channelId = dmTarget ? getDMChannelId(currentUser.id, dmTarget.id) : activeChannel;
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
  const sendMeeting = (title: string, link: string, _r: string[]) => {
    const channelId = dmTarget ? getDMChannelId(currentUser.id, dmTarget.id) : activeChannel;
    sendMessage({ channelId, author: profileUser, type: "meeting", text: `📹 ${title}`, meeting: { title, link, createdBy: profileUser.name }, reactions: {} });
    showToast("Meeting link sent! 🔗", "success");
  };
  const onShareMusic = (text: string) => sendMessage({ channelId: activeChannel, author: profileUser, type: "text", text, reactions: {} });

  const renderMsg = (msg: ChatMessage, prevMsg: ChatMessage | null) => {
    // Reconstruct author from flat fields if nested author object is missing
    const author = msg.author || {
      id:     (msg as any).authorId    || "unknown",
      name:   (msg as any).authorName  || "Unknown",
      email:  (msg as any).authorEmail || "",
      role:   (msg as any).authorRole  || "staff",
      avatar: (msg as any).authorAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=unknown&backgroundColor=1a1d2e&textColor=a78bfa`,
      isOnline: false,
      status: "Available",
    };
    if (!author.id) return null; // skip fully broken messages
    const showDate = !prevMsg || !sameDay(prevMsg.createdAt, msg.createdAt);
    const isMine   = author.id === currentUser.id || author.email === currentUser.email;
    const reactions = Object.entries(msg.reactions || {}).filter(([, u]) => (u as string[]).length > 0);
    return (
      <React.Fragment key={msg.id}>
        {showDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 12px", color: "#3a3f5c", fontSize: 11, fontWeight: 700 }}>
            <div style={{ flex: 1, height: 1, background: "#1f2338" }} />{fmtDate(msg.createdAt)}<div style={{ flex: 1, height: 1, background: "#1f2338" }} />
          </div>
        )}
        <div className="msg-row" style={{ display: "flex", gap: 10, padding: "4px 10px", borderRadius: 10, transition: "background 0.1s", position: "relative" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#181b27")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <img src={author.avatar} alt={author.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: 2, border: "1.5px solid #252840" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" as const }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: isMine ? "#a78bfa" : "#e0e0f0" }}>{author.name}</span>
              <span style={roleStyle(author.role)}>{author.role}</span>
              <span style={{ fontSize: 10, color: "#3a3f5c" }}>{fmt(msg.createdAt)}</span>
            </div>
            {msg.type === "sticker" && <div style={{ fontSize: 52, lineHeight: 1, padding: "4px 0" }}>{msg.text}</div>}
            {msg.type === "gif" && msg.gif && <img src={msg.gif} alt="GIF" loading="lazy" style={{ maxWidth: 240, borderRadius: 10, display: "block", marginTop: 2 }} />}
            {msg.type === "meeting" && msg.meeting && (
              <div style={{ display: "inline-flex", gap: 12, alignItems: "center", background: "#181b27", border: "1px solid #7c6af755", borderRadius: 12, padding: "10px 14px", marginTop: 4, maxWidth: 380 }}>
                <span style={{ fontSize: 22 }}>📹</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#e0e0f0" }}>{msg.meeting.title}</div>
                  <div style={{ fontSize: 11, color: "#7c6af7", wordBreak: "break-all" as const }}>{msg.meeting.link}</div>
                </div>
                <button onClick={() => startCall(msg.meeting!.link)} style={{ background: "#7c6af7", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Join</button>
              </div>
            )}
            {(msg.type === "text" || msg.type === "voice" || (!msg.type && msg.text)) && (
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "#d0d0e8", wordBreak: "break-word" as const }} dangerouslySetInnerHTML={{ __html: linkify(esc(msg.text || "")) }} />
            )}
            {reactions.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" as const }}>
                {reactions.map(([emoji, users]) => (
                  <button key={emoji} onClick={() => toggleReaction(msg.id, emoji, currentUser.id)} style={{
                    background: (users as string[]).includes(currentUser.id) ? "rgba(124,106,247,0.2)" : "#1e2230",
                    border: `1px solid ${(users as string[]).includes(currentUser.id) ? "#7c6af7" : "#252840"}`,
                    borderRadius: 20, padding: "2px 8px", cursor: "pointer", fontSize: 12, color: "#e0e0f0",
                  }}>{emoji} {(users as string[]).length}</button>
                ))}
              </div>
            )}
          </div>
          <div className="msg-actions" style={{ position: "absolute", right: 10, top: 4, display: "flex", gap: 3, opacity: 0, transition: "opacity 0.15s" }}>
            {["👍","❤️","😄","🎉"].map(e => (
              <button key={e} onClick={() => toggleReaction(msg.id, e, currentUser.id)} style={{ background: "#1e2230", border: "1px solid #252840", borderRadius: 6, padding: "3px 6px", cursor: "pointer", fontSize: 11 }}>{e}</button>
            ))}
          </div>
        </div>
      </React.Fragment>
    );
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .sc-root { width: 100%; height: 100%; background: #0a0b0f; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .sc-card { width: 100%; max-width: 860px; height: 100%; max-height: 90vh; display: flex; flex-direction: column; background: #0d0f18; border: 1px solid #1a1d2e; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.6); position: relative; }
    .msg-row:hover .msg-actions { opacity: 1 !important; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #252840; border-radius: 2px; }
    .ch-tab { padding: 6px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: all 0.15s; background: none; color: #5a5f7a; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .ch-tab:hover { background: #1a1d2e; color: #e0e0f0; }
    .ch-tab.active { background: rgba(124,106,247,0.15); color: #a78bfa; }
    .hdr-btn { background: none; border: 1px solid #1f2338; border-radius: 8px; color: #5a5f7a; padding: 5px 9px; cursor: pointer; font-size: 14px; transition: all 0.15s; }
    .hdr-btn:hover { background: #1e2230; color: #f0f0f6; border-color: #7c6af7; }
    .input-box:empty::before { content: attr(data-placeholder); color: #3a3f5c; pointer-events: none; }
    .dm-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; border-radius: 8px; transition: background 0.15s; }
    .dm-item:hover { background: #1a1d2e; }
    @keyframes toastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes typingBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
    .typing-dot { width:5px;height:5px;border-radius:50%;background:#5a5f7a;animation:typingBounce 1.2s infinite; }
    .typing-dot:nth-child(2){animation-delay:.2s}
    .typing-dot:nth-child(3){animation-delay:.4s}
  `;

  return (
    <>
      <style>{css}</style>

      {showOnboard && <OnboardingOverlay role={currentUser.role} userName={currentUser.name} onFinish={completeOnboard} />}

      {showProfile && (
        <ProfileModal user={profileUser}
          onSave={(updates: Partial<ChatUser>) => {
            setProfileUser(prev => ({ ...prev, ...updates }));
            if (appUser) loginAsUser({ ...appUser, ...(updates.name ? { name: updates.name } : {}), ...(updates.avatar ? { avatar: updates.avatar } : {}), ...(updates.status ? { status: updates.status } : {}) });
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showMeeting && <MeetingModal currentUser={profileUser} allUsers={realUsers} onSend={sendMeeting} onClose={() => setShowMeeting(false)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9000, background: "#181b27", border: `1px solid ${toast.type === "success" ? "#34d399" : toast.type === "error" ? "#f87171" : "#7c6af7"}`, borderRadius: 12, padding: "12px 18px", fontSize: 13, color: "#f0f0f6", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "toastIn 0.3s ease", maxWidth: 320 }}>
          {toast.msg}
        </div>
      )}

      <div className="sc-root">
        <div className="sc-card">

          {/* TOP NAVBAR */}
          <div style={{ background: "#111319", borderBottom: "1px solid #1a1d2e", flexShrink: 0 }}>

            {/* Brand + actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 8px", borderBottom: "1px solid #1a1d2e" }}>
              <img src={roswaltLogo} alt="Roswalt" style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(201,169,110,0.5))" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Impact, 'Arial Narrow', sans-serif", fontSize: 14, color: "#c9a96e", letterSpacing: "0.08em" }}>SmartCue ChatRoom</div>
                <div style={{ fontSize: 9, color: "#3a3f5c", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Roswalt Realty</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* DM button */}
                <div style={{ position: "relative" }} ref={dmListRef}>
                  <button className="hdr-btn" onClick={() => setShowDMList(p => !p)} title="Direct Messages" style={{ position: "relative" }}>
                    👤 {dmTarget ? dmTarget.name.split(" ")[0] : "DM"}
                    {(() => {
                      if (!currentUser.id || currentUser.id === "me" || realUsers.length === 0) return null;
                      const total = realUsers.reduce((sum, u) => sum + (unreadDMs[getDMChannelId(currentUser.id, u.id)] || 0), 0);
                      return total > 0 ? (
                        <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #111319" }}>{total}</span>
                      ) : null;
                    })()}
                  </button>
                </div>

                <button className="hdr-btn" onClick={() => startCall()} title="Video Call">📹</button>
                {isAdmin && <button className="hdr-btn" onClick={() => setShowMeeting(true)} title="Meeting Link">🔗</button>}
                <button className="hdr-btn" onClick={() => setShowMusic(p => !p)} style={{ color: showMusic ? "#a78bfa" : "#5a5f7a" }}>🎵</button>

                {/* Profile pill */}
                <div onClick={() => setShowProfile(true)} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "4px 8px", borderRadius: 9, border: "1px solid #1f2338", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1e2230")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ position: "relative" }}>
                    <img src={profileUser.avatar} alt="me" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "2px solid #7c6af7", display: "block" }} />
                    <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, background: "#34d399", borderRadius: "50%", border: "1.5px solid #111319" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e0e0f0", whiteSpace: "nowrap" as const }}>{profileUser.name.split(" ")[0]}</div>
                    <span style={roleStyle(currentUser.role)}>{currentUser.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Channel tabs */}
            {!dmTarget && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 10px", overflowX: "auto" as const, scrollbarWidth: "none" as const }}>
                {channels.map((ch: Channel) => (
                  <button key={ch.id} className={`ch-tab${activeChannel === ch.id ? " active" : ""}`} onClick={() => setActiveChannel(ch.id)} style={{ flexShrink: 0 }}>
                    <span style={{ opacity: 0.5 }}>#</span>{ch.name}
                    {ch.unread ? <span style={{ background: "#7c6af7", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 10, padding: "1px 5px" }}>{ch.unread}</span> : null}
                  </button>
                ))}
              </div>
            )}

            {/* DM header */}
            {dmTarget && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px" }}>
                <button onClick={() => setDmTarget(null)} style={{ background: "none", border: "none", color: "#5a5f7a", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
                <img src={dmTarget.avatar} alt={dmTarget.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#f0f0f6" }}>{dmTarget.name}</span>
                <span style={roleStyle(dmTarget.role)}>{dmTarget.role}</span>
              </div>
            )}
          </div>

          {/* DM People Panel — contained inside the chat card */}
          {showDMList && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: "flex", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ width: 280, background: "#111319", borderRight: "1px solid #1a1d2e", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                {/* Panel header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1a1d2e", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0f0" }}>Direct Messages</div>
                  <button onClick={() => setShowDMList(false)} style={{ background: "none", border: "none", color: "#5a5f7a", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
                </div>
                {/* User list */}
                <div style={{ flex: 1, overflowY: "auto" as const, padding: "8px" }}>
                  {realUsers.map((u: ChatUser) => {
                    const dmCh    = currentUser.id && currentUser.id !== "me" ? getDMChannelId(currentUser.id, u.id) : "";
                    const unread  = dmCh ? (unreadDMs[dmCh] || 0) : 0;
                    const dmMsgs  = dmCh ? (messages[dmCh] || []) : [];
                    const lastMsg = dmMsgs[dmMsgs.length - 1];
                    const isActive = dmTarget?.id === u.id;
                    return (
                      <div key={u.id} onClick={() => { setDmTarget(u); setShowDMList(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 2, background: isActive ? "rgba(124,106,247,0.15)" : unread > 0 ? "rgba(124,106,247,0.06)" : "transparent", transition: "background 0.15s" }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#1a1d2e"; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = unread > 0 ? "rgba(124,106,247,0.06)" : "transparent"; }}
                      >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img src={u.avatar} alt={u.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", display: "block", border: `2px solid ${isActive ? "#7c6af7" : "#252840"}` }} />
                          {u.isOnline && <div style={{ position: "absolute", bottom: 1, right: 1, width: 9, height: 9, background: "#34d399", borderRadius: "50%", border: "2px solid #111319" }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: unread > 0 ? "#f0f0f6" : "#c8ccdd", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                            {unread > 0 && <span style={{ background: "#7c6af7", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 7px", flexShrink: 0 }}>{unread}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: unread > 0 ? "#a78bfa" : "#3a3f5c", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                            {lastMsg
                              ? `${(lastMsg.author?.id || (lastMsg as any).authorId) === currentUser.id ? "You: " : ""}${lastMsg.text?.slice(0, 30) || "Attachment"}`
                              : u.role}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Dimmed rest — click to close */}
              <div style={{ flex: 1, background: "rgba(0,0,0,0.5)", cursor: "pointer" }} onClick={() => setShowDMList(false)} />
            </div>
          )}

          {/* Music panel */}
          {showMusic && (
            <div style={{ background: "#111319", borderBottom: "1px solid #1a1d2e", flexShrink: 0 }}>
              <YoutubePanel onShareToChat={onShareMusic} />
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto" as const, padding: "12px 8px 6px", display: "flex", flexDirection: "column" as const, gap: 1 }}>
            {activeMessages.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", color: "#3a3f5c", gap: 10 }}>
                <img src={roswaltLogo} alt="" style={{ width: 48, height: 48, objectFit: "contain", opacity: 0.15 }} />
                <div style={{ fontSize: 13 }}>No messages yet — start the conversation!</div>
              </div>
            ) : (
              activeMessages.map((msg: ChatMessage, i: number) => renderMsg(msg, i > 0 ? activeMessages[i - 1] : null))
            )}
            {typingUser && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", color: "#5a5f7a", fontSize: 12, fontStyle: "italic" as const }}>
                <div style={{ display: "flex", gap: 3 }}>{[0,1,2].map(i => <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
                {typingUser} is typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: "1px solid #1a1d2e", background: "#111319", padding: "10px 14px", position: "relative", flexShrink: 0 }}>
            {showPicker && <EmojiPicker onEmoji={insertEmoji} onSticker={sendSticker} onGif={sendGif} onClose={() => setShowPicker(false)} />}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#1a1d2e", border: "1px solid #252840", borderRadius: 14, padding: "6px 10px" }}>
              <button onClick={() => setShowPicker(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: showPicker ? "#a78bfa" : "#3a3f5c", padding: "2px", flexShrink: 0 }}>😊</button>
              <div ref={inputRef} contentEditable data-placeholder={`Message ${activeChName}`} className="input-box"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
                style={{ flex: 1, minHeight: 24, maxHeight: 130, overflowY: "auto" as const, outline: "none", fontSize: 14, color: "#f0f0f6", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}
              />
              <button onClick={() => doSend()} style={{ background: "#7c6af7", border: "none", borderRadius: 10, color: "#fff", padding: "7px 13px", cursor: "pointer", flexShrink: 0 }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCall && (
        <VideoCallPanel
          channel={activeChannel}
          currentUser={profileUser}
          participants={realUsers.filter((u: ChatUser) => u.isOnline).slice(0, 4)}
          roomUrl={callRoomUrl || undefined}
          onEnd={() => { setShowCall(false); setCallRoomUrl(null); showToast("Call ended", "info"); }}
        />
      )}
    </>
  );
};

export const ChatRoom: React.FC = () => {
  const { user: appUser, teamMembers: rawMembers } = useUser();

  const currentUser: ChatUser = useMemo(() => ({
    id:       appUser?.id || appUser?.email || "me",
    name:     appUser?.name || appUser?.email?.split("@")[0] || "You",
    email:    appUser?.email || "me@roswalt.com",
    role:     (appUser?.role as UserRole) || "staff",
    avatar:   (appUser as any)?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(appUser?.name || "me")}&backgroundColor=1a1d2e&textColor=a78bfa`,
    isOnline: true,
    status:   "Available",
  }), [appUser?.id, appUser?.email, appUser?.name, (appUser as any)?.avatar, appUser?.role]);

  const teamMembers: ChatUser[] = useMemo(() => (rawMembers || []).filter(m => m && m.email).map(m => ({
    id:       m.id || m.email,
    name:     m.name || m.email.split("@")[0],
    email:    m.email,
    role:     (m.role as UserRole) || "staff",
    avatar:   (m as any).avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name || m.email)}&backgroundColor=1a1d2e&textColor=a78bfa`,
    isOnline: (m as any).isOnline ?? false,
    status:   (m as any).status || "Available",
  })), [rawMembers]);

  return (
    <ChatProvider currentUser={currentUser} teamMembers={teamMembers}>
      <ChatRoomInner />
    </ChatProvider>
  );
};
export default ChatRoom;
