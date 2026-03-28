import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUser } from "../contexts/UserContext";
import { ChatProvider, useChatContext, getDMChannelId } from "../contexts/ChatContext";
import roswaltLogo from "../assets/ROSWALT-LOGO-GOLDEN-8K.png";
import { ChatMessage, ChatUser, UserRole, Channel } from "../types/chat";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { EmojiPicker } from "./EmojiPicker";
import { YoutubePanel } from "./YoutubePanel";
import { VideoCallPanel } from "./VideoCallPanel";
import { ProfileModal } from "./ProfileModal";
import { MeetingModal } from "./MeetingModal";

const API = "https://adaptable-patience-production-45da.up.railway.app";

// ── Role badge styles ──────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; bg: string; color: string; glow: string }> = {
  staff:      { label: "Staff",      bg: "rgba(52,211,153,0.12)",  color: "#34d399", glow: "#34d39940" },
  admin:      { label: "Admin",      bg: "rgba(56,189,248,0.12)",  color: "#38bdf8", glow: "#38bdf840" },
  superadmin: { label: "SuperAdmin", bg: "rgba(251,191,36,0.14)",  color: "#fbbf24", glow: "#fbbf2440" },
  supremo:    { label: "Supremo",    bg: "rgba(244,114,182,0.14)", color: "#f472b6", glow: "#f472b640" },
};

const roleBadge = (role: string): React.CSSProperties => ({
  fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
  padding: "2px 8px", borderRadius: 20,
  background: ROLE_META[role]?.bg || "rgba(167,139,250,0.12)",
  color:      ROLE_META[role]?.color || "#a78bfa",
  display: "inline-block", whiteSpace: "nowrap",
  border: `1px solid ${ROLE_META[role]?.color || "#a78bfa"}30`,
});

// ── Toast ──────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDate = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const sameDay  = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
const esc      = (s: string) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const linkify  = (t: string) => t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#c9a96e;text-decoration:underline;text-underline-offset:3px">$1</a>');

const Initials: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const parts = name.trim().split(" ");
  const ini   = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  const hue   = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},55%,25%)`, border: `2px solid hsl(${hue},55%,40%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 800, color: `hsl(${hue},80%,75%)`, flexShrink: 0, fontFamily: "serif", letterSpacing: "0.02em" }}>
      {ini.toUpperCase()}
    </div>
  );
};

const Avatar: React.FC<{ src?: string; name: string; size?: number; online?: boolean }> = ({ src, name, size = 36, online }) => (
  <div style={{ position: "relative", flexShrink: 0 }}>
    {src
      ? <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", border: "2px solid #c9a96e30" }} />
      : <Initials name={name} size={size} />
    }
    {online !== undefined && (
      <div style={{ position: "absolute", bottom: 1, right: 1, width: size * 0.26, height: size * 0.26, background: online ? "#34d399" : "#4b5563", borderRadius: "50%", border: "2px solid #0c0d13" }} />
    )}
  </div>
);

// ── Main inner component ───────────────────────────────────────────────────
const ChatRoomInner: React.FC = () => {
  const { user: appUser, loginAsUser, teamMembers } = useUser();
  const { messages, channels, activeChannel, typingUser, unreadDMs, setActiveChannel, sendMessage, toggleReaction, clearDMUnread } = useChatContext();

  const realUsers: ChatUser[] = useMemo(() => (teamMembers || []).filter(Boolean).filter((m: any) => m?.email && (m.id || m.email)).map((m: any) => ({
    id:       m.id || m.email,
    name:     m.name || m.email.split("@")[0],
    email:    m.email,
    role:     (m.role as UserRole) || "staff",
    avatar:   (m as any).avatar || "",
    isOnline: (m as any).isOnline ?? false,
    status:   (m as any).status || "Available",
  })), [teamMembers]);

  const currentUser: ChatUser = useMemo(() => ({
    id:       appUser?.id || appUser?.email || "me",
    name:     appUser?.name || appUser?.email?.split("@")[0] || "You",
    email:    appUser?.email || "me@roswalt.com",
    role:     (appUser?.role as UserRole) || "staff",
    avatar:   (appUser as any)?.avatar || "",
    isOnline: true,
    status:   (appUser as any)?.status || "Available",
  }), [appUser]);

  // State
  const [showCall,    setShowCall]    = useState(false);
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [showDMPanel, setShowDMPanel] = useState(false);
  const [showMusic,   setShowMusic]   = useState(false);
  const [profileUser, setProfileUser] = useState<ChatUser>(currentUser);
  const [inputText,   setInputText]   = useState("");
  const [dmTarget,    setDmTarget]    = useState<ChatUser | null>(null);
  const [sending,     setSending]     = useState(false);
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLDivElement>(null);

  const isAdmin = ["admin", "superadmin", "supremo"].includes(currentUser.role);

  const activeChannelId = dmTarget ? getDMChannelId(currentUser.id, dmTarget.id) : activeChannel;
  const activeMessages  = useMemo(() => messages[activeChannelId] || [], [messages, activeChannelId]);
  const activeCh        = channels.find((c: Channel) => c.id === activeChannel);

  const totalDMUnread = useMemo(() =>
    realUsers.filter(u => u?.id).reduce((sum, u) => sum + (unreadDMs[getDMChannelId(currentUser.id, u.id)] || 0), 0),
  [realUsers, unreadDMs, currentUser.id]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dmTarget) return;
    const dmCh = getDMChannelId(currentUser.id, dmTarget.id);
    setActiveChannel(dmCh);
    clearDMUnread(dmCh);
  }, [dmTarget, currentUser.id, setActiveChannel, clearDMUnread]);

  useEffect(() => {
    setProfileUser(prev => ({ ...prev, name: appUser?.name || prev.name, avatar: (appUser as any)?.avatar || prev.avatar }));
  }, [appUser]);

  useEffect(() => {
    // Use MongoDB _id if available, fall back to email — skip silently on 404
    const userId = appUser?.id || appUser?.email;
    if (!userId) return;
    fetch(`${API}/api/users/${encodeURIComponent(appUser?.email || userId)}`)
      .then(r => { if (r.status === 404) return null; return r.ok ? r.json() : null; })
      .then(data => { if (data && !data.chatOnboarded) setShowOnboard(true); })
      .catch(() => {});
  }, [appUser?.id, appUser?.email]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const completeOnboard = useCallback(() => {
    setShowOnboard(false);
    const userId = appUser?.id || appUser?.email;
    if (!userId) return;
    fetch(`${API}/api/users/${encodeURIComponent(appUser?.email || userId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatOnboarded: true }) }).catch(() => {});
  }, [appUser?.id, appUser?.email]);

  const startCall = useCallback((roomUrl?: string) => {
    const room = roomUrl || `roswalt-smartcue-${activeChannel}`;
    const jitsi = room.startsWith("http") ? (room.includes("meet.jit.si") ? room : `https://meet.jit.si/${encodeURIComponent(room.replace(/https?:\/\/[^/]+\//, ""))}`) : `https://meet.jit.si/${room}`;
    setCallRoomUrl(jitsi);
    setShowCall(true);
  }, [activeChannel]);

  const doSend = useCallback(async (override?: Partial<ChatMessage>) => {
    const text = (inputRef.current?.innerText || "").trim() || inputText.trim();
    if (!text && !override?.gif && !override?.type) return;
    if (sending) return;
    setSending(true);
    const channelId = dmTarget ? getDMChannelId(currentUser.id, dmTarget.id) : activeChannel;
    try {
      await sendMessage({ channelId, author: profileUser, type: "text", text, reactions: {}, ...override });
    } catch (e) {
      showToast("Failed to send. Retrying...", "error");
    } finally {
      if (inputRef.current) inputRef.current.innerText = "";
      setInputText("");
      setShowPicker(false);
      setSending(false);
    }
  }, [inputText, sending, dmTarget, currentUser.id, activeChannel, sendMessage, profileUser]);

  const sendSticker = (s: string) => doSend({ type: "sticker", text: s });
  const sendGif     = (url: string) => doSend({ type: "gif", gif: url });
  const insertEmoji = (e: string) => { if (inputRef.current) { inputRef.current.focus(); document.execCommand("insertText", false, e); } };
  const sendMeeting = (title: string, link: string, _r: string[]) => {
    const channelId = dmTarget ? getDMChannelId(currentUser.id, dmTarget.id) : activeChannel;
    sendMessage({ channelId, author: profileUser, type: "meeting", text: `Meeting: ${title}`, meeting: { title, link, createdBy: profileUser.name }, reactions: {} });
    showToast("Meeting link sent!", "success");
  };
  const onShareMusic = (text: string) => sendMessage({ channelId: activeChannel, author: profileUser, type: "text", text, reactions: {} });

  // ── Render a message ──────────────────────────────────────────────────────
  const renderMsg = (msg: ChatMessage, prevMsg: ChatMessage | null) => {
    const showDate  = !prevMsg || !sameDay(prevMsg.createdAt, msg.createdAt);
    const isMine    = msg.author.id === currentUser.id || msg.author.email === currentUser.email;
    const isOptimistic = msg.id?.startsWith("opt_");
    const reactions = Object.entries(msg.reactions || {}).filter(([, u]) => (u as string[]).length > 0);
    const prevSame  = prevMsg && prevMsg.author.id === msg.author.id && !showDate && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;

    return (
      <React.Fragment key={msg.id}>
        {showDate && (
          <div className="date-divider">
            <div className="date-line" /><span>{fmtDate(msg.createdAt)}</span><div className="date-line" />
          </div>
        )}
        <div className={`msg-row${isMine ? " mine" : ""}${prevSame ? " grouped" : ""}`} style={{ opacity: isOptimistic ? 0.7 : 1 }}>
          {!prevSame ? (
            <Avatar src={msg.author.avatar || undefined} name={msg.author.name} size={38} />
          ) : (
            <div style={{ width: 38, flexShrink: 0 }} />
          )}
          <div className="msg-body">
            {!prevSame && (
              <div className="msg-meta">
                <span className="msg-name" style={{ color: isMine ? "#c9a96e" : "#e2e8f0" }}>{msg.author.name}</span>
                <span style={roleBadge(msg.author.role)}>{msg.author.role}</span>
                <span className="msg-time">{fmt(msg.createdAt)}{isOptimistic && " · sending…"}</span>
              </div>
            )}
            {msg.type === "sticker" && <div className="msg-sticker">{msg.text}</div>}
            {msg.type === "gif" && msg.gif && <img src={msg.gif} alt="GIF" loading="lazy" className="msg-gif" />}
            {msg.type === "meeting" && msg.meeting && (
              <div className="msg-meeting">
                <div className="meeting-icon">📹</div>
                <div className="meeting-info">
                  <div className="meeting-title">{msg.meeting.title}</div>
                  <div className="meeting-link">{msg.meeting.link}</div>
                  <div className="meeting-by">Created by {msg.meeting.createdBy}</div>
                </div>
                <button className="meeting-join" onClick={() => startCall(msg.meeting!.link)}>Join</button>
              </div>
            )}
            {(msg.type === "text" || msg.type === "voice" || (!msg.type && msg.text)) && (
              <div className="msg-text" dangerouslySetInnerHTML={{ __html: linkify(esc(msg.text || "")) }} />
            )}
            {reactions.length > 0 && (
              <div className="msg-reactions">
                {reactions.map(([emoji, users]) => (
                  <button key={emoji} className={`reaction-btn${(users as string[]).includes(currentUser.id) ? " active" : ""}`} onClick={() => toggleReaction(msg.id, emoji, currentUser.id)}>
                    {emoji} {(users as string[]).length}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="msg-actions-hover">
            {["👍","❤️","🔥","😂","🎉"].map(e => (
              <button key={e} className="quick-react" onClick={() => toggleReaction(msg.id, e, currentUser.id)}>{e}</button>
            ))}
          </div>
        </div>
      </React.Fragment>
    );
  };

  const activeChLabel = dmTarget ? dmTarget.name : `#${activeChannel}`;

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --gold:    #c9a96e;
      --gold-lt: #e4c98a;
      --gold-dk: #9a7a4a;
      --void:    #080a0f;
      --bg0:     #0c0d13;
      --bg1:     #0f1018;
      --bg2:     #13141e;
      --bg3:     #181a26;
      --bg4:     #1e2030;
      --border:  #1e2030;
      --text0:   #f0ece4;
      --text1:   #c8c4bc;
      --text2:   #7a7870;
      --text3:   #4a4845;
      --accent:  #7c6af7;
      --green:   #34d399;
      --red:     #f87171;
    }

    .sc-shell { width:100%; height:100%; background:var(--void); display:flex; align-items:stretch; justify-content:center; font-family:'DM Sans',sans-serif; }

    /* Luxury card */
    .sc-card {
      width:100%; max-width:900px; height:100%;
      display:flex; flex-direction:column; position:relative;
      background:var(--bg0);
      border:1px solid var(--gold-dk)40;
      overflow:hidden;
      box-shadow:0 0 0 1px #00000080, 0 32px 80px rgba(0,0,0,0.7);
    }

    /* Subtle gold shimmer at top */
    .sc-card::before {
      content:''; position:absolute; top:0; left:0; right:0; height:1px;
      background:linear-gradient(90deg, transparent, var(--gold)60, transparent);
      z-index:10;
    }

    /* ── Navbar ─────────────────────────────────────────────────────────── */
    .sc-nav {
      background:linear-gradient(180deg,#0e1019,#0c0d13);
      border-bottom:1px solid var(--border);
      flex-shrink:0; position:relative; z-index:20;
    }

    .sc-nav-row1 {
      display:flex; align-items:center; gap:6px;
      padding:8px 12px 7px;
      border-bottom:1px solid #1a1c28;
      min-width:0;
    }

    .brand-logo { width:28px; height:28px; object-fit:contain; flex-shrink:0; filter:drop-shadow(0 0 8px rgba(201,169,110,0.4)); }

    .brand-wrap { min-width:0; flex-shrink:1; overflow:hidden; }
    .brand-name {
      font-family:'Cormorant Garamond',serif; font-weight:700; font-size:15px;
      color:var(--gold); letter-spacing:0.04em; line-height:1;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .brand-sub { font-size:8px; color:var(--text3); letter-spacing:0.14em; text-transform:uppercase; margin-top:1px; white-space:nowrap; }

    .nav-actions { display:flex; align-items:center; gap:4px; margin-left:auto; flex-shrink:0; }

    .nav-btn {
      background:none; border:1px solid var(--border); border-radius:9px;
      color:var(--text2); padding:5px 8px; cursor:pointer; font-size:14px;
      transition:all 0.18s; font-family:'DM Sans',sans-serif; font-weight:500;
      position:relative; white-space:nowrap; flex-shrink:0; line-height:1;
    }
    .nav-btn:hover { background:var(--bg3); color:var(--text0); border-color:var(--gold-dk); }
    .nav-btn.active { background:rgba(201,169,110,0.1); color:var(--gold); border-color:var(--gold-dk); }

    .badge-dot {
      position:absolute; top:-4px; right:-4px;
      background:var(--red); color:#fff; font-size:8px; font-weight:900;
      border-radius:50%; width:15px; height:15px;
      display:flex; align-items:center; justify-content:center;
      border:2px solid var(--bg0);
    }

    .profile-pill {
      display:flex; align-items:center; gap:6px; cursor:pointer;
      padding:3px 6px 3px 4px; border-radius:10px; border:1px solid var(--border);
      transition:all 0.18s; background:none; flex-shrink:0; max-width:120px;
    }
    .profile-pill:hover { background:var(--bg3); border-color:var(--gold-dk)80; }
    .profile-name { font-size:11px; font-weight:700; color:var(--text0); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:64px; }

    /* Channel tabs */
    .sc-tabs {
      display:flex; align-items:center; gap:2px; padding:5px 12px;
      overflow-x:auto; scrollbar-width:none;
    }
    .sc-tabs::-webkit-scrollbar { display:none; }

    .ch-tab {
      padding:5px 14px; border-radius:8px; border:none; cursor:pointer;
      font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif;
      color:var(--text2); background:none;
      display:inline-flex; align-items:center; gap:5px;
      white-space:nowrap; transition:all 0.15s; flex-shrink:0; position:relative;
    }
    .ch-tab:hover { background:var(--bg3); color:var(--text1); }
    .ch-tab.active { background:rgba(201,169,110,0.1); color:var(--gold); font-weight:600; }
    .ch-tab.active::after {
      content:''; position:absolute; bottom:-1px; left:14px; right:14px; height:2px;
      background:linear-gradient(90deg,transparent,var(--gold),transparent); border-radius:1px;
    }
    .tab-badge {
      background:var(--red); color:#fff; font-size:8px; font-weight:800;
      border-radius:10px; padding:1px 5px; min-width:16px; text-align:center;
    }

    /* DM header */
    .dm-header { display:flex; align-items:center; gap:10px; padding:8px 16px; }
    .dm-back-btn { background:none; border:none; color:var(--text2); cursor:pointer; font-size:20px; line-height:1; padding:0; transition:color 0.15s; }
    .dm-back-btn:hover { color:var(--gold); }

    /* ── DM Panel overlay ───────────────────────────────────────────────── */
    .dm-panel-overlay { position:absolute; inset:0; z-index:50; display:flex; }
    .dm-panel {
      width:300px; background:var(--bg1); border-right:1px solid var(--border);
      display:flex; flex-direction:column;
      box-shadow:8px 0 40px rgba(0,0,0,0.5);
    }
    .dm-panel-hdr {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 16px; border-bottom:1px solid var(--border); flex-shrink:0;
    }
    .dm-panel-title { font-size:12px; font-weight:700; color:var(--text0); letter-spacing:0.06em; text-transform:uppercase; }
    .dm-close-btn { background:none; border:none; color:var(--text2); cursor:pointer; font-size:20px; padding:0; line-height:1; transition:color 0.15s; }
    .dm-close-btn:hover { color:var(--red); }
    .dm-list { flex:1; overflow-y:auto; padding:8px; scrollbar-width:thin; scrollbar-color:var(--bg4) transparent; }

    .dm-item {
      display:flex; align-items:center; gap:10px; padding:10px 10px;
      border-radius:12px; cursor:pointer; margin-bottom:2px;
      transition:all 0.15s; border:1px solid transparent;
    }
    .dm-item:hover { background:var(--bg3); border-color:var(--border); }
    .dm-item.active { background:rgba(201,169,110,0.08); border-color:var(--gold-dk)50; }
    .dm-item-info { flex:1; min-width:0; }
    .dm-item-name { font-size:13px; font-weight:500; color:var(--text1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dm-item-name.unread { font-weight:700; color:var(--text0); }
    .dm-item-preview { font-size:11px; color:var(--text3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
    .dm-item-preview.unread { color:var(--gold); }
    .dm-unread-badge { background:var(--accent); color:#fff; font-size:9px; font-weight:800; border-radius:10px; padding:2px 7px; flex-shrink:0; }
    .dm-backdrop { flex:1; background:rgba(0,0,0,0.5); backdrop-filter:blur(2px); cursor:pointer; }

    /* ── Messages ───────────────────────────────────────────────────────── */
    .sc-messages {
      flex:1; overflow-y:auto; padding:16px 12px 8px;
      display:flex; flex-direction:column; gap:2px;
      scrollbar-width:thin; scrollbar-color:var(--bg4) transparent;
    }
    .sc-messages::-webkit-scrollbar { width:4px; }
    .sc-messages::-webkit-scrollbar-thumb { background:var(--bg4); border-radius:2px; }

    .date-divider {
      display:flex; align-items:center; gap:12px;
      margin:20px 4px 14px; color:var(--text3); font-size:10px; font-weight:700;
      letter-spacing:0.12em; text-transform:uppercase;
    }
    .date-line { flex:1; height:1px; background:var(--border); }

    .msg-row {
      display:flex; gap:10px; padding:3px 8px 3px 10px; border-radius:12px;
      transition:background 0.12s; position:relative; align-items:flex-start;
    }
    .msg-row.grouped { padding-top:1px; padding-bottom:1px; }
    .msg-row:hover { background:var(--bg2); }
    .msg-row:hover .msg-actions-hover { opacity:1; }

    .msg-body { flex:1; min-width:0; }
    .msg-meta { display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
    .msg-name { font-size:13px; font-weight:700; letter-spacing:0.01em; }
    .msg-time { font-size:10px; color:var(--text3); }

    .msg-text {
      font-size:14px; line-height:1.7; color:var(--text1);
      word-break:break-word; font-weight:400;
    }
    .msg-sticker { font-size:54px; line-height:1; padding:4px 0; }
    .msg-gif { max-width:260px; border-radius:12px; display:block; margin-top:4px; border:1px solid var(--border); }

    .msg-meeting {
      display:inline-flex; gap:14px; align-items:center;
      background:var(--bg2); border:1px solid var(--gold-dk)40;
      border-radius:14px; padding:14px 16px; margin-top:6px; max-width:420px;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
    }
    .meeting-icon { font-size:24px; flex-shrink:0; }
    .meeting-info { flex:1; min-width:0; }
    .meeting-title { font-weight:700; font-size:14px; color:var(--text0); }
    .meeting-link { font-size:11px; color:var(--gold); word-break:break-all; margin-top:2px; }
    .meeting-by { font-size:10px; color:var(--text3); margin-top:2px; }
    .meeting-join {
      background:linear-gradient(135deg,var(--gold),var(--gold-dk));
      border:none; border-radius:10px; color:var(--void);
      padding:8px 16px; cursor:pointer; font-size:12px; font-weight:800;
      flex-shrink:0; transition:opacity 0.15s; letter-spacing:0.04em;
    }
    .meeting-join:hover { opacity:0.85; }

    .msg-reactions { display:flex; gap:4px; margin-top:6px; flex-wrap:wrap; }
    .reaction-btn {
      background:var(--bg3); border:1px solid var(--border); border-radius:20px;
      padding:3px 9px; cursor:pointer; font-size:12px; color:var(--text1);
      transition:all 0.15s;
    }
    .reaction-btn:hover, .reaction-btn.active {
      background:rgba(124,106,247,0.15); border-color:var(--accent);
    }

    .msg-actions-hover {
      position:absolute; right:10px; top:50%; transform:translateY(-50%);
      display:flex; gap:2px; opacity:0; transition:opacity 0.15s;
      background:var(--bg2); border:1px solid var(--border); border-radius:10px; padding:3px;
    }
    .quick-react {
      background:none; border:none; border-radius:7px; padding:3px 5px;
      cursor:pointer; font-size:14px; transition:background 0.12s;
    }
    .quick-react:hover { background:var(--bg4); }

    .empty-state {
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:14px;
      color:var(--text3); padding:40px;
    }
    .empty-logo { width:60px; height:60px; object-fit:contain; opacity:0.08; }
    .empty-text { font-size:13px; letter-spacing:0.04em; }

    /* Typing */
    .typing-indicator {
      display:flex; align-items:center; gap:8px; padding:6px 18px;
      color:var(--text2); font-size:12px; font-style:italic;
    }
    .tdots { display:flex; gap:3px; }
    .tdot {
      width:5px; height:5px; border-radius:50%; background:var(--gold-dk);
      animation:bounce 1.2s infinite;
    }
    .tdot:nth-child(2){animation-delay:0.2s} .tdot:nth-child(3){animation-delay:0.4s}
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    /* ── Input ──────────────────────────────────────────────────────────── */
    .sc-input-wrap {
      border-top:1px solid var(--border);
      background:linear-gradient(180deg,#0c0e16,#0a0c12);
      padding:10px 14px 12px; flex-shrink:0; position:relative;
    }
    .sc-input-inner {
      display:flex; align-items:flex-end; gap:8px;
      background:var(--bg2); border:1px solid var(--border);
      border-radius:14px; padding:7px 10px;
      transition:border-color 0.2s;
    }
    .sc-input-inner:focus-within { border-color:var(--gold-dk); }
    .input-box {
      flex:1; min-height:24px; max-height:130px; overflow-y:auto;
      outline:none; font-size:14px; color:var(--text0);
      line-height:1.65; font-family:'DM Sans',sans-serif;
      caret-color:var(--gold);
    }
    .input-box:empty::before { content:attr(data-placeholder); color:var(--text3); pointer-events:none; }
    .emoji-btn { background:none; border:none; cursor:pointer; font-size:20px; color:var(--text3); padding:2px; flex-shrink:0; transition:color 0.15s; }
    .emoji-btn:hover { color:var(--gold); }
    .send-btn {
      background:linear-gradient(135deg,var(--gold),var(--gold-dk));
      border:none; border-radius:11px; color:var(--void); padding:8px 13px;
      cursor:pointer; flex-shrink:0; transition:all 0.18s; font-weight:800;
      display:flex; align-items:center;
    }
    .send-btn:hover { opacity:0.85; transform:translateY(-1px); }
    .send-btn:active { transform:translateY(0); }
    .send-btn:disabled { opacity:0.4; cursor:default; transform:none; }

    /* ── Toast ──────────────────────────────────────────────────────────── */
    .sc-toast {
      position:fixed; bottom:24px; right:24px; z-index:9999;
      background:var(--bg2); border-radius:14px; padding:12px 18px;
      font-size:13px; color:var(--text0); max-width:320px;
      box-shadow:0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px var(--border);
      animation:toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
      font-family:'DM Sans',sans-serif;
    }
    @keyframes toastIn { from{opacity:0;transform:translateY(14px) scale(0.96)} to{opacity:1;transform:none} }

    /* ── Scrollbar ──────────────────────────────────────────────────────── */
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:var(--bg4); border-radius:2px; }
  `;

  return (
    <>
      <style>{css}</style>

      {showOnboard && <OnboardingOverlay role={currentUser.role} userName={currentUser.name} onFinish={completeOnboard} />}
      {showProfile && (
        <ProfileModal user={profileUser}
          onSave={(u: Partial<ChatUser>) => {
            setProfileUser(prev => ({ ...prev, ...u }));
            if (appUser) loginAsUser({ ...appUser, ...(u.name ? { name: u.name } : {}), ...(u.avatar ? { avatar: u.avatar } : {}), ...(u.status ? { status: u.status } : {}) });
          }}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showMeeting && <MeetingModal currentUser={profileUser} allUsers={realUsers} onSend={sendMeeting} onClose={() => setShowMeeting(false)} />}

      {toast && (
        <div className="sc-toast" style={{ borderLeft: `3px solid ${toast.type === "success" ? "var(--green)" : toast.type === "error" ? "var(--red)" : "var(--gold)"}` }}>
          {toast.msg}
        </div>
      )}

      <div className="sc-shell">
        <div className="sc-card">

          {/* ── NAV ROW 1: Brand + actions ──────────────────────────────── */}
          <div className="sc-nav">
            <div className="sc-nav-row1">
              <img src={roswaltLogo} alt="Roswalt" className="brand-logo" />
              <div className="brand-wrap">
                <div className="brand-name">SmartCue ChatRoom</div>
                <div className="brand-sub">Roswalt Realty</div>
              </div>

              <div className="nav-actions">
                {/* DM button — icon only */}
                <button className={`nav-btn${showDMPanel ? " active" : ""}`} onClick={() => setShowDMPanel(p => !p)} title={dmTarget ? `DM: ${dmTarget.name}` : "Direct Messages"} style={{ position: "relative" }}>
                  ✉
                  {totalDMUnread > 0 && <span className="badge-dot">{totalDMUnread > 9 ? "9+" : totalDMUnread}</span>}
                </button>

                <button className="nav-btn" onClick={() => startCall()} title="Video Call">📹</button>
                {isAdmin && <button className="nav-btn" onClick={() => setShowMeeting(true)} title="Schedule Meeting">🔗</button>}
                <button className={`nav-btn${showMusic ? " active" : ""}`} onClick={() => setShowMusic(p => !p)} title="Music">♫</button>

                {/* Profile — avatar + truncated first name only */}
                <div className="profile-pill" onClick={() => setShowProfile(true)}>
                  <div style={{ position: "relative" }}>
                    <Avatar src={profileUser.avatar || undefined} name={profileUser.name} size={26} online={true} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="profile-name">{profileUser.name.split(" ")[0]}</div>
                    <span style={roleBadge(currentUser.role)}>{currentUser.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Channel tabs */}
            {!dmTarget && (
              <div className="sc-tabs">
                {channels.map((ch: Channel) => (
                  <button key={ch.id} className={`ch-tab${activeChannel === ch.id ? " active" : ""}`} onClick={() => setActiveChannel(ch.id)}>
                    <span style={{ opacity: 0.5, fontSize: 10 }}>#</span>{ch.name}
                    {ch.unread ? <span className="tab-badge">{ch.unread}</span> : null}
                  </button>
                ))}
              </div>
            )}

            {/* DM active header */}
            {dmTarget && (
              <div className="dm-header">
                <button className="dm-back-btn" onClick={() => setDmTarget(null)}>←</button>
                <Avatar src={dmTarget.avatar || undefined} name={dmTarget.name} size={28} online={dmTarget.isOnline} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text0)" }}>{dmTarget.name}</span>
                  <span style={{ fontSize: 10, color: dmTarget.isOnline ? "var(--green)" : "var(--text3)", marginLeft: 8 }}>{dmTarget.isOnline ? "● Online" : "○ Offline"}</span>
                </div>
                <span style={roleBadge(dmTarget.role)}>{dmTarget.role}</span>
              </div>
            )}
          </div>

          {/* ── DM People Slide Panel ──────────────────────────────────── */}
          {showDMPanel && (
            <div className="dm-panel-overlay">
              <div className="dm-panel">
                <div className="dm-panel-hdr">
                  <div className="dm-panel-title">Direct Messages</div>
                  <button className="dm-close-btn" onClick={() => setShowDMPanel(false)}>×</button>
                </div>
                <div className="dm-list">
                  {realUsers.filter(u => u?.id).map((u: ChatUser) => {
                    const dmCh    = getDMChannelId(currentUser.id, u.id);
                    const unread  = unreadDMs[dmCh] || 0;
                    const dmMsgs  = messages[dmCh] || [];
                    const lastMsg = dmMsgs[dmMsgs.length - 1];
                    const isAct   = dmTarget?.id === u.id;
                    return (
                      <div key={u.id} className={`dm-item${isAct ? " active" : ""}`}
                        onClick={() => { setDmTarget(u); setShowDMPanel(false); }}>
                        <Avatar src={u.avatar || undefined} name={u.name} size={42} online={u.isOnline} />
                        <div className="dm-item-info">
                          <div className={`dm-item-name${unread > 0 ? " unread" : ""}`}>{u.name}</div>
                          <div className={`dm-item-preview${unread > 0 ? " unread" : ""}`}>
                            {lastMsg ? `${lastMsg.author?.id === currentUser.id ? "You: " : ""}${lastMsg.text?.slice(0, 32) || "Attachment"}` : <span style={roleBadge(u.role)}>{u.role}</span>}
                          </div>
                        </div>
                        {unread > 0 && <span className="dm-unread-badge">{unread}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="dm-backdrop" onClick={() => setShowDMPanel(false)} />
            </div>
          )}

          {/* Music */}
          {showMusic && (
            <div style={{ background: "var(--bg1)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <YoutubePanel onShareToChat={onShareMusic} />
            </div>
          )}

          {/* ── Messages ─────────────────────────────────────────────────── */}
          <div className="sc-messages">
            {activeMessages.length === 0 ? (
              <div className="empty-state">
                <img src={roswaltLogo} alt="" className="empty-logo" />
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, color: "var(--text3)" }}>
                  {dmTarget ? `Start a conversation with ${dmTarget.name.split(" ")[0]}` : `Welcome to #${activeChannel}`}
                </div>
                <div className="empty-text">
                  {dmTarget ? "Your messages are end-to-end saved to MongoDB." : activeCh?.description || "Send your first message below."}
                </div>
              </div>
            ) : (
              activeMessages.map((msg: ChatMessage, i: number) => renderMsg(msg, i > 0 ? activeMessages[i - 1] : null))
            )}
            {typingUser && (
              <div className="typing-indicator">
                <div className="tdots">{[0,1,2].map(i => <div key={i} className="tdot" />)}</div>
                <span style={{ color: "var(--gold-dk)", fontWeight: 600 }}>{typingUser}</span> is typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ────────────────────────────────────────────────────── */}
          <div className="sc-input-wrap">
            {showPicker && <EmojiPicker onEmoji={insertEmoji} onSticker={sendSticker} onGif={sendGif} onClose={() => setShowPicker(false)} />}
            <div className="sc-input-inner">
              <button className="emoji-btn" onClick={() => setShowPicker(p => !p)} style={{ color: showPicker ? "var(--gold)" : undefined }}>😊</button>
              <div ref={inputRef} contentEditable data-placeholder={`Message ${activeChLabel}`} className="input-box"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
              />
              <button className="send-btn" onClick={() => doSend()} disabled={sending}>
                {sending
                  ? <div style={{ width: 16, height: 16, border: "2px solid var(--void)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                }
              </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

// ── Wrapper with ChatProvider ──────────────────────────────────────────────
export const ChatRoom: React.FC = () => {
  const { user: appUser, teamMembers: rawMembers } = useUser();

  const currentUser: ChatUser = {
    id:       appUser?.id || appUser?.email || "me",
    name:     appUser?.name || appUser?.email?.split("@")[0] || "You",
    email:    appUser?.email || "me@roswalt.com",
    role:     (appUser?.role as UserRole) || "staff",
    avatar:   (appUser as any)?.avatar || "",
    isOnline: true,
    status:   "Available",
  };

  const teamMembers: ChatUser[] = (rawMembers || []).filter(Boolean).filter((m: any) => m?.email && (m.id || m.email)).map((m: any) => ({
    id:       m.id || m.email,
    name:     m.name || m.email.split("@")[0],
    email:    m.email,
    role:     (m.role as UserRole) || "staff",
    avatar:   (m as any).avatar || "",
    isOnline: (m as any).isOnline ?? false,
    status:   (m as any).status || "Available",
  }));

  return (
    <ChatProvider currentUser={currentUser} teamMembers={teamMembers}>
      <ChatRoomInner />
    </ChatProvider>
  );
};

export default ChatRoom;









