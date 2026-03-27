import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { useUser, Task } from "../contexts/UserContext";
import ClaudeChat from "./ClaudeChat";
import roswaltLogo from "../assets/ROSWALT-LOGO-GOLDEN-8K.png";
import { greetUser, setElevenLabsVoice, speakText } from "../services/VoiceModule";
import {
  Plus, Upload, LogOut, CheckCircle, RotateCw, Eye, X,
  Zap, User, ChevronRight, Calendar, Flag,
  FileText, ArrowUpRight, MessageSquare, Shield, Sparkles, Loader,
  FolderPlus, Briefcase, Users, Settings, MapPin, Building2, Target, DollarSign,
  Home, BarChart2, AlertTriangle, AlertCircle, TrendingUp, Video, Image as ImageIcon,
  Activity, Search, Trash2,
} from "lucide-react";

type Tab = "home" | "overview" | "approvals" | "tasks" | "users" | "addUser" | "projects" | "ai" | "tickets" | "activity";

const DEFAULT_PASSWORDS: Record<string, string> = {
  "pushkaraj.gore@roswalt.com": "100001",
  "aziz.khan@roswalt.com": "100002",
  "vinay.vanmali@roswalt.com": "100003",
  "jalal.shaikh@roswalt.com": "100004",
  "nidhi.mehta@roswalt.com": "100005",
  "keerti.barua@roswalt.com": "100006",
  "hetal.makwana@roswalt.com": "100007",
  "prathamesh.chile@roswalt.com": "100008",
  "samruddhi.shivgan@roswalt.com": "100009",
  "irfan.ansari@roswalt.com": "100010",
  "vishal.chaudhary@roswalt.com": "100011",
  "mithilesh.menge@roswalt.com": "100012",
  "jai.bhojwani@roswalt.com": "100013",
  "vikrant.pabrekar@roswalt.com": "100014",
  "gaurav.chavan@roswalt.com": "100015",
  "harish.utkam@roswalt.com": "100016",
  "siddhesh.achari@roswalt.com": "100017",
  "raj.vichare@roswalt.com": "100018",
  "rohan.fernandes@roswalt.com": "100019",
  "vaibhavi.gujjeti@roswalt.com": "100020",
};

const roleOrder: Record<string, number> = { superadmin: 0, admin: 1, staff: 2 };

const PROJECT_COLORS = [
  "#d4af37", "#c9a96e", "#b8941f", "#9d6e28", "#e5c158",
  "#8b7355", "#a89968", "#cdb892", "#b39e6f", "#8a6d3b",
];

const PROJECT_TYPES = [
  "Residential", "Commercial", "Mixed-Use", "Luxury Villa",
  "Apartment Complex", "Office Space", "Retail", "Industrial",
];

interface ReviewResult {
  results: Array<{ image: number; status: "CLEAN" | "MINOR" | "ERROR"; issues: string[]; recommendations: string }>;
  hasErrors: boolean;
  timestamp: string;
}

const BACKEND = "https://adaptable-patience-production-45da.up.railway.app";

// ── Color palette (matches AdminDashboard G object) ─────────────────────────
const G = {
  gold:       "#d4af37",
  goldLight:  "#e5c158",
  goldDark:   "#b8941f",
  cyan:       "#00e5ff",
  purple:     "#a855f7",
  success:    "#10b981",
  danger:     "#ef4444",
  amber:      "#f59e0b",
  magenta:    "#ec4899",
  textPrimary:"#f5ead8",
  textSecondary:"#d4c5b0",
  textMuted:  "#8b7355",
  border:     "#3a2f25",
};

// ── Flash Panel ──────────────────────────────────────────────────────────────
interface SAFlashPanelProps {
  saName: string;
  pendingApprovals: Task[];
  fullyApproved: Task[];
  allTasks: Task[];
  teamMembers: any[];
  projects: any[];
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
}

const SAFlashPanel: React.FC<SAFlashPanelProps> = ({
  saName, pendingApprovals, fullyApproved, allTasks, teamMembers, projects, onClose, onNavigate,
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

  const tatBreached = allTasks.filter(t => (t as any).tatBreached);
  const frozen      = allTasks.filter(t => (t as any).isFrozen);
  const inReview    = allTasks.filter(t => t.approvalStatus === "in-review");

  const handleClose = () => { setVisible(false); setTimeout(onClose, 320); };
  const handleNav   = (tab: Tab) => { handleClose(); setTimeout(() => onNavigate(tab), 340); };

  const pills = [
    { label: "Total Tasks",    value: allTasks.length,           color: G.cyan,    icon: "◈" },
    { label: "Pending SA",     value: pendingApprovals.length,   color: G.amber,   icon: "⏳" },
    { label: "Fully Approved", value: fullyApproved.length,      color: G.success, icon: "✓" },
    { label: "In Review",      value: inReview.length,           color: G.purple,  icon: "⚡" },
    { label: "TAT Breached",   value: tatBreached.length,        color: G.danger,  icon: "⚠" },
    { label: "Frozen",         value: frozen.length,             color: "#b06af3", icon: "🔒" },
    { label: "Team",           value: teamMembers.length,        color: G.gold,    icon: "👥" },
    { label: "Projects",       value: projects.length,           color: G.magenta, icon: "🏗" },
  ];

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:9000, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, opacity: visible?1:0, transition:"opacity 0.32s ease" }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background:"transparent", border:`1px solid ${G.gold}44`, borderRadius:24,
        maxWidth:700, width:"100%", maxHeight:"90vh", overflowY:"auto",
        boxShadow:`0 40px 120px rgba(0,0,0,0.97), 0 0 100px ${G.gold}0d, inset 0 1px 0 rgba(212,175,55,0.08)`,
        transform: visible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.95)",
        transition:"transform 0.36s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Decorative top glow */}
        <div style={{ position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)", width:300, height:120, background:`radial-gradient(ellipse, ${G.gold}18, transparent 70%)`, pointerEvents:"none", borderRadius:"50%" }} />

        {/* Header */}
        <div style={{ padding:"28px 32px 22px", borderBottom:`1px solid rgba(212,175,55,0.08)`, background:"transparent", borderRadius:"24px 24px 0 0", position:"relative" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
            <div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 12px", borderRadius:6, background:`${G.gold}18`, border:`1px solid ${G.gold}44`, fontSize:9, fontWeight:800, color:G.gold, textTransform:"uppercase", letterSpacing:"1.4px", marginBottom:14 }}>
                <Zap size={8} /> Superadmin Live Briefing
              </div>
              <div style={{ fontSize:26, fontWeight:800, color:G.textPrimary, letterSpacing:"-0.6px", fontFamily:"'Oswald',sans-serif", lineHeight:1.15 }}>
                Welcome, <span style={{ background:`linear-gradient(135deg,${G.goldLight},${G.gold})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{saName}</span>
              </div>
              <div style={{ fontSize:12, color:G.textMuted, marginTop:7 }}>Your platform snapshot — act on urgent items first.</div>
            </div>
            <button onClick={handleClose}
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, width:36, height:36, color:G.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14 }}>✕</button>
          </div>
          {/* Pills */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:22 }}>
            {pills.map(p => (
              <div key={p.label} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 13px", borderRadius:10, background:`${p.color}12`, border:`1px solid ${p.color}35` }}>
                <span style={{ fontSize:11, color:p.color }}>{p.icon}</span>
                <span style={{ fontSize:20, fontWeight:900, color:p.color, fontFamily:"'Oswald',sans-serif", lineHeight:1 }}>{p.value}</span>
                <span style={{ fontSize:9, color:G.textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <div style={{ padding:"22px 32px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${G.amber}22` }}>
              <span style={{ fontSize:14 }}>⏳</span>
              <span style={{ fontSize:11, fontWeight:800, color:G.amber, textTransform:"uppercase", letterSpacing:"0.8px" }}>Awaiting Your Approval</span>
              <span style={{ padding:"1px 7px", borderRadius:8, background:`${G.amber}20`, border:`1px solid ${G.amber}55`, fontSize:9, color:G.amber, fontWeight:800, animation:"sa-pulse 1.5s ease-in-out infinite" }}>{pendingApprovals.length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {pendingApprovals.slice(0,5).map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:11, background:`${G.amber}07`, border:`1px solid ${G.amber}20` }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:G.amber, boxShadow:`0 0 8px ${G.amber}`, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:G.textPrimary }}>{t.title}</div>
                    <div style={{ fontSize:10, color:G.textMuted }}>Assigned to: <span style={{ color:G.textSecondary }}>{t.assignedTo}</span></div>
                  </div>
                  <button onClick={() => handleNav("approvals")}
                    style={{ padding:"5px 12px", background:`${G.amber}18`, border:`1px solid ${G.amber}44`, borderRadius:7, color:G.amber, fontSize:10, fontWeight:700, cursor:"pointer", textTransform:"uppercase" }}>
                    Review →
                  </button>
                </div>
              ))}
              {pendingApprovals.length > 5 && <div style={{ textAlign:"center", fontSize:11, color:G.textMuted }}>+{pendingApprovals.length - 5} more awaiting</div>}
            </div>
          </div>
        )}

        {/* TAT Breached */}
        {tatBreached.length > 0 && (
          <div style={{ padding:`0 32px 22px` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${G.danger}18` }}>
              <AlertTriangle size={13} color={G.danger} />
              <span style={{ fontSize:11, fontWeight:800, color:G.danger, textTransform:"uppercase", letterSpacing:"0.8px" }}>TAT Breached</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {tatBreached.slice(0,3).map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, background:`${G.danger}07`, border:`1px solid ${G.danger}20` }}>
                  <div style={{ flex:1, fontSize:12, color:G.textSecondary }}>{t.title}</div>
                  <span style={{ fontSize:8, padding:"2px 6px", borderRadius:3, background:`${G.danger}18`, color:G.danger, fontWeight:700, textTransform:"uppercase", border:`1px solid ${G.danger}35` }}>BREACH</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"18px 32px", borderTop:`1px solid rgba(255,255,255,0.05)`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:10, color:pendingApprovals.length > 0 ? G.amber : G.success }}>
            {pendingApprovals.length > 0 ? `⚠ ${pendingApprovals.length} task${pendingApprovals.length>1?"s":""} need your sign-off` : "✓ No pending approvals"}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {pendingApprovals.length > 0 && (
              <button onClick={() => handleNav("approvals")}
                style={{ padding:"10px 18px", background:`linear-gradient(135deg,${G.amber}22,${G.amber}10)`, border:`1px solid ${G.amber}44`, borderRadius:9, color:G.amber, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", textTransform:"uppercase", letterSpacing:"0.5px" }}>
                Review All
              </button>
            )}
            <button onClick={handleClose}
              style={{ padding:"10px 24px", background:`linear-gradient(135deg,${G.gold},${G.goldDark})`, border:"none", borderRadius:9, color:"#000", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit", textTransform:"uppercase", letterSpacing:"0.6px", boxShadow:`0 0 28px ${G.gold}40` }}>
              Let's Go →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard ───────────────────────────────────────────────────────────
const SADashboard: React.FC = () => {
  const {
    tasks = [], teamMembers = [], addUser, superadminReviewTask, logout, user,
    addTask, projects = [], addProject, updateTask, updateUser, getNextOTP,
    assistanceTickets, superadminApproveTicket, deleteTask,
    activityLog = [], logActivity,
  } = useUser() as any;

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const handleTabChange = (tab: Tab) => {
    if (tab !== "projects") setSelectedProject(null);
    setActiveTab(tab);
  };
  const [mounted, setMounted] = useState(false);
  const [newUser, setNewUser] = useState({ name:"", email:"", role:"staff", password:"", phone:"" });
  const [successMsg, setSuccessMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  // Phone inline-edit state (used in Team Directory tab)
  const [editPhoneId, setEditPhoneId] = useState<string|null>(null);
  const [editPhoneVal, setEditPhoneVal] = useState("");

  // Background video
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(() => {
    try { return localStorage.getItem("sa_bg_video") || null; } catch { return null; }
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Task creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title:"", description:"", priority:"medium" as "low"|"medium"|"high",
    dueDate:"", assignedTo:"", projectId:"",
  });

  // Project creation
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name:"", description:"", projectCode:"", color:PROJECT_COLORS[0],
    launchDate:"", sqft:"", location:"", address:"", usp:"",
    inventory:"", priceRange:"", projectType:"Residential", targetAudience:"",
  });

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reviewComments, setReviewComments] = useState("");

  // AI Review
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewResults, setAiReviewResults] = useState<ReviewResult | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);

  // Lightbox
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  // Flash panel + voice
  const [showFlashPanel, setShowFlashPanel] = useState(false);
  const greetedRef   = useRef(false);
  const flashVoiceRef = useRef(false);

  // Task detail modal
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // All-tasks tab filters
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");

  // Flash alert messages (timed banners)
  const [flashAlerts, setFlashAlerts] = useState<{id:number;msg:string;color:string}[]>([]);
  const flashIdRef = useRef(0);

  // Hourly voice interval ref
  const hourlyVoiceRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Auto-refresh ref (2 hours)
  const autoRefreshRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // ── Flash alert helper ────────────────────────────────────────────────────
  const pushFlashAlert = (msg: string, color = G.amber) => {
    const id = ++flashIdRef.current;
    setFlashAlerts(prev => [...prev.slice(-4), { id, msg, color }]);
    setTimeout(() => setFlashAlerts(prev => prev.filter(a => a.id !== id)), 7000);
  };

  // ── Hourly voice briefing ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const runHourlyBriefing = async () => {
      const allT     = (tasks as Task[]);
      const pending  = allT.filter(t => t.approvalStatus === "admin-approved").length;
      const tat      = allT.filter(t => (t as any).tatBreached).length;
      const frozen   = allT.filter(t => (t as any).isFrozen).length;
      const tickets  = (assistanceTickets ?? []).length;
      const projCount = (projects as any[]).filter((p:any) => !(p as any).status || (p as any).status === "active").length;

      // Who has the most TAT breaches
      const tatMap: Record<string,number> = {};
      allT.filter(t=>(t as any).tatBreached).forEach(t => { tatMap[t.assignedTo] = (tatMap[t.assignedTo]||0)+1; });
      const topBreacher = Object.entries(tatMap).sort((a,b)=>b[1]-a[1])[0];
      const topName = topBreacher ? `${teamMembers.find((m:any)=>m.email===topBreacher[0])?.name||topBreacher[0]} with ${topBreacher[1]} breach${topBreacher[1]>1?"es":""}` : "none";

      const script = [
        `Hourly system update.`,
        `Total tasks: ${allT.length}.`,
        pending > 0 ? `${pending} task${pending>1?"s":""} pending your final approval.` : `No pending approvals.`,
        tat > 0 ? `${tat} TAT breach${tat>1?"es":""} detected. Top breacher: ${topName}.` : `No TAT breaches.`,
        frozen > 0 ? `${frozen} task${frozen>1?"s are":" is"} frozen.` : "",
        tickets > 0 ? `${tickets} assistance ticket${tickets>1?"s":""} open.` : "",
        `Active projects: ${projCount}.`,
        `Platform status: ${pending===0&&tat===0&&frozen===0 ? "all clear" : "attention required"}.`,
      ].filter(Boolean).join(" ");

      await speakText(script);
      pushFlashAlert(`⏰ Hourly update: ${pending} pending · ${tat} TAT breach${tat!==1?"es":""} · ${tickets} ticket${tickets!==1?"s":""}`, G.cyan);
    };

    // Run every hour
    hourlyVoiceRef.current = setInterval(runHourlyBriefing, 60 * 60 * 1000);
    return () => { if (hourlyVoiceRef.current) clearInterval(hourlyVoiceRef.current); };
  }, [user, tasks, assistanceTickets, projects, teamMembers]);

  // ── Auto-refresh every 2 hours ────────────────────────────────────────────
  useEffect(() => {
    autoRefreshRef.current = setTimeout(() => {
      pushFlashAlert("🔄 Auto-refreshing dashboard...", G.purple);
      setTimeout(() => window.location.reload(), 1500);
    }, 2 * 60 * 60 * 1000);
    return () => { if (autoRefreshRef.current) clearTimeout(autoRefreshRef.current); };
  }, []);

  // ── Watch for new tasks and push flash alerts ─────────────────────────────
  const prevTaskCountRef = useRef<number>((tasks as Task[]).length);
  useEffect(() => {
    const curr = (tasks as Task[]).length;
    if (curr > prevTaskCountRef.current) {
      const diff = curr - prevTaskCountRef.current;
      pushFlashAlert(`✨ ${diff} new task${diff>1?"s":""} added to the platform`, G.success);
    }
    prevTaskCountRef.current = curr;
  }, [(tasks as Task[]).length]);

  // ── Watch for new TAT breaches ────────────────────────────────────────────
  const prevTatRef = useRef<number>(0);
  useEffect(() => {
    const curr = (tasks as Task[]).filter(t=>(t as any).tatBreached).length;
    if (curr > prevTatRef.current && prevTatRef.current > 0) {
      const newBreaches = curr - prevTatRef.current;
      pushFlashAlert(`⚠ ${newBreaches} new TAT breach${newBreaches>1?"es":""} detected!`, G.danger);
      speakText(`Alert. ${newBreaches} new turnaround time breach${newBreaches>1?"es have":" has"} been detected.`);
    }
    prevTatRef.current = curr;
  }, [(tasks as Task[]).filter(t=>(t as any).tatBreached).length]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.load();
  }, [backgroundVideo]);

  // Greeting + voice
  useEffect(() => {
    if (greetedRef.current) return;
    if (!user) return;
    greetedRef.current = true;
    setElevenLabsVoice("ThT5KcBeYPX3keUQqHPh");
    const name = (user as any).name || localStorage.getItem("fullName") || "there";
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    setTimeout(async () => {
      await greetUser(name);
      const parts: string[] = [];
      if (pendingApprovals.length > 0)
        parts.push(`You have ${pendingApprovals.length} task${pendingApprovals.length>1?"s":""} awaiting your final sign-off.`);
      const tat = tasks.filter((t: Task) => (t as any).tatBreached).length;
      if (tat > 0) parts.push(`${tat} task${tat>1?"s have":" has"} breached turnaround time.`);
      if (parts.length === 0) parts.push("All tasks are on track. Your platform is in excellent shape.");
      await speakText(parts.join(" "));
    }, 800);

    setTimeout(() => setShowFlashPanel(true), 1400);
  }, [user]);

  // Flash panel voice
  useEffect(() => {
    if (!showFlashPanel) return;
    if (flashVoiceRef.current) return;
    if (pendingApprovals.length === 0) return;
    flashVoiceRef.current = true;
    const names = pendingApprovals.map((t: Task) => t.title);
    const script = pendingApprovals.length === 1
      ? `Attention. A task requires your final approval: ${names[0]}. Please review and sign off.`
      : `Attention. ${pendingApprovals.length} tasks are awaiting your sign-off. Please navigate to the Approvals tab to review them.`;
    setTimeout(async () => { await speakText(script); }, 3500);
  }, [showFlashPanel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
      if (e.key === "ArrowRight") setLightboxIndex(i => Math.min(i+1, lightboxPhotos.length-1));
      if (e.key === "ArrowLeft")  setLightboxIndex(i => Math.max(i-1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhotos.length]);

  // Auto-generate OTP when the Add User tab opens
  useEffect(() => {
    if (activeTab === "addUser" && !newUser.password) {
      setNewUser(prev => ({ ...prev, password: (getNextOTP as any)() }));
    }
  }, [activeTab]);

  const pendingApprovals = tasks.filter((t: Task) => t.approvalStatus === "admin-approved");
  const fullyApproved    = tasks.filter((t: Task) => t.approvalStatus === "superadmin-approved");
  const inReview         = tasks.filter((t: Task) => t.approvalStatus === "in-review");
  const tatBreached      = tasks.filter((t: Task) => (t as any).tatBreached);
  const frozenTasks      = tasks.filter((t: Task) => (t as any).isFrozen);
  const allAssistTickets = (assistanceTickets ?? []);
  const activeProjects   = projects.filter((p: any) => !(p as any).status || (p as any).status === "active");
  const assignableAdmins = teamMembers.filter((m: any) => m.role === "admin");
  const assignableStaff  = teamMembers.filter((m: any) => m.role === "staff");

  // Delete-request tickets needing SA approval
  const deleteRequestTickets = (allAssistTickets as any[]).filter((t: any) => t.ticketType === "delete-request" && t.status === "superadmin-pending");

  // Project drill-down state
  const [selectedProject, setSelectedProject] = React.useState<any>(null);

  // Ticket oversight state
  const [saTicketFilter,     setSaTicketFilter]     = React.useState<"all"|"delete-request"|"small-activity"|"general-query"|"task-delegation">("all");
  const [selectedSaTicket,   setSelectedSaTicket]   = React.useState<any>(null);
  const [saTicketNote,       setSaTicketNote]       = React.useState("");
  const [showSaTicketModal,  setShowSaTicketModal]  = React.useState(false);

  // Activity Monitor state
  const [activitySearch,     setActivitySearch]     = React.useState("");
  const [activityCategory,   setActivityCategory]   = React.useState<"all"|"task"|"ticket"|"project"|"user"|"auth"|"approval">("all");
  const [activityPage,       setActivityPage]       = React.useState(0);
  const ACTIVITY_PAGE_SIZE = 50;

  // Voice alert for new delete-request tickets
  const prevDeleteReqRef = React.useRef(deleteRequestTickets.length);
  React.useEffect(() => {
    const prev = prevDeleteReqRef.current;
    const curr = deleteRequestTickets.length;
    if (curr > prev) {
      const newest = deleteRequestTickets[0] as any;
      speakText(`Urgent. A delete request has been submitted by ${newest?.raisedBy ?? "an admin"} for the task ${newest?.taskTitle ?? "unknown"}. Your approval is required.`);
    }
    prevDeleteReqRef.current = curr;
  }, [deleteRequestTickets.length]);

  const handleApprove = (taskId: string) => {
    superadminReviewTask(taskId, true, reviewComments || "Approved by Superadmin");
    setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); setAiReviewResults(null);
    speakText("Task fully approved and marked as complete.");
    showSuccess("Task fully approved ✓");
  };

  const handleReject = (taskId: string) => {
    if (!reviewComments.trim()) { showSuccess("⚠ Please add a reason for rejection."); return; }
    superadminReviewTask(taskId, false, reviewComments);
    setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); setAiReviewResults(null);
    speakText("Task sent back for rework. The team has been notified.");
    showSuccess("Task sent back for rework");
  };

  const handleAddUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    const result = (addUser as any)(newUser as any);
    if (result.success) {
      const nextOTP = (getNextOTP as any)();
      setNewUser({ name:"", email:"", role:"staff", password: nextOTP, phone:"" });
      speakText(`New member ${newUser.name} has been added to the team.`);
      showSuccess("User added successfully ✓");
    } else {
      showSuccess(`⚠ ${result.message}`);
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.description || !newTask.assignedTo || !newTask.dueDate) {
      showSuccess("⚠ Please fill in all required fields."); return;
    }
    if (!newTask.projectId) { showSuccess("⚠ Please select a project."); return; }
    const member = teamMembers.find((m: any) => m.email === newTask.assignedTo);
    if (!member) { showSuccess("⚠ Selected member not found."); return; }
    (addTask as any)({
      title: newTask.title, description: newTask.description, status:"pending",
      priority: newTask.priority, dueDate: newTask.dueDate,
      assignedTo: newTask.assignedTo, projectId: newTask.projectId,
      assignedBy: user?.email || "", approvalStatus:"assigned",
    });
    speakText(`Task ${newTask.title} assigned to ${(member as any).name}.`);
    showSuccess(`✓ Task assigned to ${(member as any).name}`);
    setNewTask({ title:"", description:"", priority:"medium", dueDate:"", assignedTo:"", projectId:"" });
    setShowCreateModal(false);
  };

  const handleCreateProject = () => {
    if (!newProject.name.trim()) { showSuccess("⚠ Project name is required."); return; }
    if (addProject) {
      (addProject as any)({
        name: newProject.name, description: newProject.description,
        projectCode: newProject.projectCode || newProject.name.substring(0,3).toUpperCase(),
        color: newProject.color, status:"active",
        launchDate: newProject.launchDate, sqft: newProject.sqft,
        location: newProject.location, address: newProject.address,
        usp: newProject.usp, inventory: newProject.inventory,
        priceRange: newProject.priceRange, projectType: newProject.projectType,
        targetAudience: newProject.targetAudience,
      } as any);
      showSuccess(`✓ Project "${newProject.name}" created`);
      setNewProject({ name:"", description:"", projectCode:"", color:PROJECT_COLORS[0], launchDate:"", sqft:"", location:"", address:"", usp:"", inventory:"", priceRange:"", projectType:"Residential", targetAudience:"" });
      setShowProjectModal(false);
    }
  };

  const handleAIReview = async (photos: string[]) => {
    if (photos.length === 0) { showSuccess("⚠ No attachments to review."); return; }
    setAiReviewing(true); setAiReviewResults(null);
    try {
      const contentArray: any[] = [{ type:"text", text:`Review each image for grammar, clarity and professionalism. Return ONLY a JSON array:\n[{"image":1,"status":"CLEAN|MINOR|ERROR","issues":[],"recommendations":"..."}]` }];
      for (const photo of photos) {
        let base64 = photo, mime = "image/jpeg";
        if (photo.startsWith("data:")) { const m = photo.match(/data:([^;]+);base64,(.+)/); if (m) { mime = m[1]; base64 = m[2]; } }
        contentArray.push({ type:"image", source:{ type:"base64", media_type:mime, data:base64 } });
      }
      const res = await fetch("https://adaptable-patience-production-45da.up.railway.app/api/review-attachments", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ taskId: selectedTask?.id, contentArray }),
      });
      if (!res.ok) { showSuccess(`✕ ${(await res.json()).message}`); return; }
      const data = await res.json();
      setAiReviewResults({ results: data.results||[], hasErrors: data.hasErrors||false, timestamp: new Date().toISOString() });
      setReviewPanelOpen(true);
      showSuccess(data.hasErrors ? "⚠ Issues found in attachments." : "✓ All attachments clear!");
    } catch {
      showSuccess("✕ Backend not running. Run: npm start");
    } finally {
      setAiReviewing(false);
    }
  };

  const handleBackgroundVideoUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("video/")) { showSuccess("⚠ Please select a video file."); return; }
    if (backgroundVideo?.startsWith("blob:")) URL.revokeObjectURL(backgroundVideo);
    const blobUrl = URL.createObjectURL(file);
    setBackgroundVideo(null);
    requestAnimationFrame(() => setBackgroundVideo(blobUrl));
    const reader = new FileReader();
    reader.onload = () => {
      try { localStorage.setItem("sa_bg_video", reader.result as string); } catch { /* quota */ }
    };
    reader.readAsDataURL(file);
    showSuccess("✓ Background video updated");
  };

  const openLightbox     = (photos: string[], index = 0) => { setLightboxPhotos(photos); setLightboxIndex(index); setShowLightbox(true); };
  const openTaskDetail   = (task: Task) => { setDetailTask(task); setShowTaskDetail(true); };
  const openReviewModal = (task: Task) => { setSelectedTask(task); setReviewComments(""); setAiReviewResults(null); setReviewPanelOpen(false); setShowReviewModal(true); };
  const handleLogout   = () => { logout(); navigate("/login"); };
  const showSuccess    = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };

  // ── Save phone number to backend ────────────────────────────────────────────
  const savePhoneToBackend = async (member: any, phone: string) => {
    try {
      const res = await fetch(`${BACKEND}/api/users/${member.email}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: member.name, email: member.email, role: member.role }),
      });
      if (!res.ok) throw new Error("Server error");
      (updateUser as any)(member.email, { phone });
      showSuccess(`✓ Mobile saved for ${member.name}`);
    } catch {
      showSuccess("✕ Failed to save phone number — check backend connection");
    } finally {
      setEditPhoneId(null);
    }
  };
  const getStaffName   = (email: string) => { const m = teamMembers.find((t: any) => t.email === email); return m ? (m as any).name : email; };

  const handleExportCredentials = async () => {
    setExporting(true);
    try {
      const sorted = [...teamMembers].sort((a: any, b: any) => (roleOrder[a.role]??9) - (roleOrder[b.role]??9));
      const rows = sorted.map((member: any, idx: number) => ({
        "#": String(idx+1), "Full Name": member.name, Email: member.email,
        Role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
        "OTP / Password": DEFAULT_PASSWORDS[member.email.toLowerCase()] ?? "—",
      }));
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("User Credentials");
      ws.columns = [
        { header:"#", key:"#", width:5 }, { header:"Full Name", key:"Full Name", width:30 },
        { header:"Email", key:"Email", width:36 }, { header:"Role", key:"Role", width:14 },
        { header:"OTP / Password", key:"OTP / Password", width:18 },
      ];
      rows.forEach((row: any) => ws.addRow(row));
      await wb.xlsx.writeFile(`Roswalt_Credentials_${new Date().toISOString().slice(0,10)}.xlsx`);
      showSuccess("Credentials exported ✓");
    } catch { showSuccess("✕ Export failed"); } finally { setExporting(false); }
  };

  const priClass = (p: string) =>
    p === "high" ? "sa-badge sa-badge-danger" : p === "low" ? "sa-badge sa-badge-success" : "sa-badge sa-badge-warning";

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id:"home",      label:"Home",      icon:<Home size={17} /> },
    { id:"tasks",     label:"All Tasks",  icon:<FileText size={17} />,   count: tasks.length },
    { id:"overview",  label:"Overview",  icon:<BarChart2 size={17} /> },
    { id:"approvals", label:"Approvals", icon:<CheckCircle size={17} />, count: pendingApprovals.length },
    { id:"tickets",   label:"Tickets",   icon:<AlertCircle size={17} />, count: (allAssistTickets as any[]).filter((t:any) => t.status === "superadmin-pending").length || undefined },
    { id:"projects",  label:"Projects",  icon:<Briefcase size={17} />,  count: projects.length },
    { id:"users",     label:"Users",     icon:<Users size={17} />,      count: teamMembers.length },
    { id:"addUser",   label:"Add User",  icon:<Plus size={17} /> },
    { id:"activity",  label:"Activity",  icon:<Activity size={17} /> },
    { id:"ai",        label:"Claude AI", icon:<Sparkles size={17} /> },
  ];

  // ── Time of day greeting ──
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  // ── Stat cards for Home ──
  const homeStats = [
    { label:"Total Tasks",      value: tasks.length,              color: G.cyan,    sub:"Platform-wide",        icon:"◈",  tab:"overview" as Tab },
    { label:"Pending Approval", value: pendingApprovals.length,   color: G.amber,   sub:"Admin-approved tasks", icon:"⏳", tab:"approvals" as Tab, urgent: pendingApprovals.length > 0 },
    { label:"Fully Approved",   value: fullyApproved.length,      color: G.success, sub:"Superadmin sign-off",  icon:"✓",  tab:"approvals" as Tab },
    { label:"TAT Breached",     value: tatBreached.length,        color: G.danger,  sub:"Deadline misses",      icon:"⚠",  tab:"overview" as Tab,  urgent: tatBreached.length > 0 },
    { label:"Frozen Tasks",     value: frozenTasks.length,        color: "#b06af3", sub:"Ticket-blocked",       icon:"🔒", tab:"overview" as Tab,  urgent: frozenTasks.length > 0 },
    { label:"Assist. Tickets",  value: allAssistTickets.length,   color: G.magenta, sub: deleteRequestTickets.length > 0 ? `${deleteRequestTickets.length} delete req pending` : "Open escalations", icon:"🎫", tab:"tickets" as Tab, urgent: deleteRequestTickets.length > 0 },
    { label:"Team Members",     value: teamMembers.length,        color: G.gold,    sub:"Across all roles",     icon:"👥", tab:"users" as Tab },
    { label:"Active Projects",  value: activeProjects.length,     color: G.purple,  sub:"Live properties",      icon:"🏗",  tab:"projects" as Tab },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');

        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        :root {
          --sa-gold: #d4af37; --sa-gold-light: #e5c158; --sa-gold-dark: #b8941f;
          --sa-cyan: #00e5ff; --sa-purple: #a855f7; --sa-success: #10b981;
          --sa-danger: #ef4444; --sa-amber: #f59e0b; --sa-magenta: #ec4899;
          --sa-text: #f5ead8; --sa-text-s: #d4c5b0; --sa-text-m: #8b7355;
          --sa-border: rgba(212,175,55,0.15); --sa-bg: transparent;
        }

        @keyframes sa-fadeUp   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes sa-fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes sa-scaleIn  { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes sa-spin     { to { transform:rotate(360deg); } }
        @keyframes sa-pulse    { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        @keyframes sa-glow     { 0%,100% { box-shadow:0 0 14px rgba(212,175,55,0.2); } 50% { box-shadow:0 0 32px rgba(212,175,55,0.55); } }
        @keyframes sa-shimmer  { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes sa-float    { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
        @keyframes sa-particle { 0% { transform:translateY(0) scale(1); opacity:0.8; } 100% { transform:translateY(-120px) scale(0.2); opacity:0; } }

        .sa-fade-up  { animation: sa-fadeUp  0.52s cubic-bezier(0.22,1,0.36,1) both; }
        .sa-fade-in  { animation: sa-fadeIn  0.35s ease both; }
        .sa-scale-in { animation: sa-scaleIn 0.3s ease both; }
        .sa-spin     { animation: sa-spin 1s linear infinite; }
        .sa-pulse-anim { animation: sa-pulse 1.5s ease-in-out infinite; }

        body { background: transparent; color: var(--sa-text); font-family:'DM Sans',sans-serif; }

        /* Video background wrapper */
        .sa-video-bg {
          position: fixed; inset: 0; z-index: 0; overflow: hidden;
        }
        .sa-video-bg video {
          width:100%; height:100%; object-fit:cover; opacity:1;
        }
        .sa-video-overlay {
          position: absolute; inset: 0;
          background: transparent;
        }
        .sa-video-overlay::after {
          content:''; position:absolute; inset:0;
          background: transparent;
        }

        /* App shell */
        .sa-app {
          min-height:100vh; display:flex; position:relative; z-index:1;
          font-family:'DM Sans',sans-serif;
        }

        /* SIDEBAR */
        .sa-sidebar {
          width: 72px; min-height:100vh;
          background: rgba(4,4,16,0.5);
          backdrop-filter: blur(18px);
          border-right: 1px solid rgba(212,175,55,0.12);
          display: flex; flex-direction:column; align-items:center;
          padding: 20px 0; gap:8px; position:sticky; top:0; height:100vh;
          overflow-y:auto; z-index:20;
          box-shadow: 2px 0 40px rgba(0,0,0,0.5), inset -1px 0 0 rgba(212,175,55,0.06);
        }
        .sa-sidebar-logo {
          width:42px; height:42px; object-fit:contain;
          filter: drop-shadow(0 0 12px rgba(212,175,55,0.5));
          margin-bottom:12px; animation: sa-float 4s ease-in-out infinite;
        }
        .sa-sidebar-divider {
          width:36px; height:1px; background:rgba(212,175,55,0.12); margin:6px 0;
        }
        .sa-nav-btn {
          width:48px; height:48px; border-radius:14px; border:1px solid transparent;
          background:transparent; color:var(--sa-text-m); cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.22s ease; position:relative;
        }
        .sa-nav-btn:hover {
          background:rgba(212,175,55,0.1); color:var(--sa-text-s);
          border-color:rgba(212,175,55,0.2);
        }
        .sa-nav-btn.active {
          background:linear-gradient(135deg,rgba(212,175,55,0.2),rgba(184,148,31,0.1));
          color:var(--sa-gold); border-color:rgba(212,175,55,0.4);
          box-shadow:0 0 20px rgba(212,175,55,0.15), inset 0 1px 0 rgba(212,175,55,0.15);
        }
        .sa-nav-badge {
          position:absolute; top:-4px; right:-4px;
          background:var(--sa-danger); color:#fff;
          font-size:9px; font-weight:800; padding:2px 5px; border-radius:8px;
          border:1.5px solid rgba(4,6,18,0.9); line-height:1.2;
          font-family:'Space Mono',monospace;
        }
        .sa-nav-tooltip {
          position:absolute; left:58px; top:50%; transform:translateY(-50%);
          background:rgba(0,0,0,0.7); border:1px solid rgba(212,175,55,0.2);
          color:var(--sa-text); font-size:11px; font-weight:600;
          padding:5px 10px; border-radius:7px; white-space:nowrap;
          pointer-events:none; opacity:0; transition:opacity 0.18s;
          z-index:100; box-shadow:0 8px 24px rgba(0,0,0,0.5);
        }
        .sa-nav-btn:hover .sa-nav-tooltip { opacity:1; }

        /* MAIN */
        .sa-main {
          flex:1; padding:0; overflow-y:auto; position:relative; z-index:1;
          transition:opacity 0.4s ease;
        }

        /* TOP BAR */
        .sa-topbar {
          position:sticky; top:0; z-index:15;
          background:rgba(4,4,16,0.55); backdrop-filter:blur(18px);
          border-bottom:1px solid rgba(212,175,55,0.1);
          padding:0 32px; height:60px;
          display:flex; align-items:center; justify-content:space-between; gap:16px;
          box-shadow:0 4px 30px rgba(0,0,0,0.4);
        }
        .sa-topbar-left { display:flex; align-items:center; gap:16px; }
        .sa-topbar-right { display:flex; align-items:center; gap:12px; }
        .sa-topbar-title {
          font-size:20px; font-weight:700; font-family:'Oswald',sans-serif;
          color:var(--sa-text); letter-spacing:"0.5px";
        }
        .sa-topbar-title em {
          font-style:italic;
          background:linear-gradient(135deg,var(--sa-gold-light),var(--sa-gold));
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sa-topbar-sub { font-size:11px; color:var(--sa-text-m); }
        .sa-tab-pill {
          padding:6px 14px; border-radius:20px; border:1px solid rgba(212,175,55,0.2);
          background:rgba(212,175,55,0.06); color:var(--sa-text-m); font-size:12px;
          font-weight:600; cursor:pointer; transition:all 0.2s;
        }
        .sa-tab-pill:hover { background:rgba(212,175,55,0.12); color:var(--sa-gold); }
        .sa-tab-pill.active {
          background:linear-gradient(135deg,rgba(212,175,55,0.2),rgba(184,148,31,0.1));
          color:var(--sa-gold); border-color:rgba(212,175,55,0.4);
        }

        /* PAGE CONTENT */
        .sa-page { padding:32px 40px; }

        .sa-page-header {
          display:flex; justify-content:space-between; align-items:flex-start;
          margin-bottom:36px; gap:24px;
        }
        .sa-page-title {
          font-size:34px; font-weight:700; font-family:'Oswald',sans-serif;
          color:var(--sa-text); letter-spacing:"-0.4px"; line-height:1.15;
        }
        .sa-page-title em {
          font-style:italic;
          background:linear-gradient(135deg,var(--sa-gold-light),var(--sa-gold));
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sa-page-sub { font-size:13px; color:var(--sa-text-m); margin-top:6px; font-weight:400; }

        /* STAT CARDS */
        .sa-stats-grid {
          display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:18px; margin-bottom:36px;
        }
        .sa-stat-card {
          background: linear-gradient(145deg, rgba(10,8,20,0.72) 0%, rgba(20,14,8,0.68) 100%);
          border:1px solid rgba(212,175,55,0.16); border-radius:16px;
          padding:22px 20px; cursor:pointer; transition:all 0.28s ease;
          position:relative; overflow:hidden;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .sa-stat-card::before {
          content:''; position:absolute; top:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(212,175,55,0.25),transparent);
        }
        .sa-stat-card:hover {
          transform:translateY(-5px) scale(1.01);
          background: linear-gradient(145deg, rgba(16,12,28,0.82) 0%, rgba(26,18,10,0.78) 100%);
          box-shadow:0 20px 60px rgba(0,0,0,0.5);
        }
        .sa-stat-card.urgent { animation:sa-glow 2.4s ease-in-out infinite; }
        .sa-stat-icon { font-size:20px; margin-bottom:10px; opacity:0.9; }
        .sa-stat-num {
          font-size:38px; font-weight:900; font-family:'Oswald',sans-serif; line-height:1;
          margin-bottom:4px;
        }
        .sa-stat-label { font-size:11px; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:3px; }
        .sa-stat-sub { font-size:10px; color:rgba(255,255,255,0.45); font-weight:500; }
        .sa-stat-dot {
          position:absolute; top:16px; right:16px; width:8px; height:8px; border-radius:50%;
        }

        /* SECTION HEADER */
        .sa-section-label {
          font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.4px;
          color:var(--sa-text-m); margin-bottom:16px; margin-top:36px;
          display:flex; align-items:center; gap:8px;
        }
        .sa-section-label::after {
          content:''; flex:1; height:1px; background:rgba(212,175,55,0.1);
        }

        /* CARDS */
        .sa-card {
          background: linear-gradient(145deg, rgba(8,6,22,0.76) 0%, rgba(18,12,6,0.72) 100%);
          border:1px solid rgba(212,175,55,0.14); border-radius:16px;
          padding:24px; transition:all 0.25s; position:relative; overflow:hidden;
          backdrop-filter: blur(14px);
          box-shadow: 0 4px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .sa-card:hover { border-color:rgba(212,175,55,0.28); box-shadow:0 12px 48px rgba(0,0,0,0.5); background: linear-gradient(145deg, rgba(12,8,28,0.84) 0%, rgba(22,16,8,0.8) 100%); }
        .sa-card::before {
          content:''; position:absolute; top:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(212,175,55,0.2),transparent);
        }

        /* TASK CARDS */
        .sa-task-card {
          background: linear-gradient(145deg, rgba(8,6,20,0.74) 0%, rgba(18,12,6,0.7) 100%);
          backdrop-filter: blur(12px);
          border:1px solid rgba(212,175,55,0.12); border-radius:14px;
          padding:20px 24px; margin-bottom:12px; transition:all 0.22s;
          position:relative; overflow:hidden;
        }
        .sa-task-card:hover { border-color:rgba(212,175,55,0.28); transform:translateX(3px); box-shadow:0 8px 30px rgba(0,0,0,0.35); }
        .sa-task-card::before {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
          background:linear-gradient(180deg,var(--sa-gold),var(--sa-gold-dark));
          border-radius:0 2px 2px 0;
        }
        .sa-task-title { font-size:15px; font-weight:600; color:var(--sa-text); margin-bottom:6px; }
        .sa-task-desc { font-size:12px; color:var(--sa-text-m); line-height:1.55; }
        .sa-task-meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; align-items:center; }

        /* BADGES */
        .sa-badge {
          display:inline-flex; align-items:center; gap:4px;
          padding:3px 9px; border-radius:20px; font-size:10px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.5px;
        }
        .sa-badge-gold    { background:rgba(212,175,55,0.15); color:var(--sa-gold);    border:1px solid rgba(212,175,55,0.3); }
        .sa-badge-success { background:rgba(16,185,129,0.12); color:var(--sa-success); border:1px solid rgba(16,185,129,0.25); }
        .sa-badge-danger  { background:rgba(239,68,68,0.12);  color:var(--sa-danger);  border:1px solid rgba(239,68,68,0.25); }
        .sa-badge-warning { background:rgba(245,158,11,0.12); color:var(--sa-amber);   border:1px solid rgba(245,158,11,0.25); }
        .sa-badge-purple  { background:rgba(168,85,247,0.12); color:var(--sa-purple);  border:1px solid rgba(168,85,247,0.25); }
        .sa-badge-cyan    { background:rgba(0,229,255,0.1);   color:var(--sa-cyan);    border:1px solid rgba(0,229,255,0.2); }
        .sa-badge-primary { background:rgba(212,175,55,0.15); color:var(--sa-gold);    border:1px solid rgba(212,175,55,0.3); }
        .sa-badge-secondary { background:rgba(212,175,55,0.08); color:var(--sa-text-s); border:1px solid rgba(212,175,55,0.18); }

        /* BUTTONS */
        .sa-btn {
          padding:10px 18px; border-radius:10px; border:none; font-size:13px;
          font-weight:600; cursor:pointer; transition:all 0.22s;
          display:inline-flex; align-items:center; gap:8px; font-family:'DM Sans',sans-serif;
        }
        .sa-btn-primary {
          background:linear-gradient(135deg,var(--sa-gold),var(--sa-gold-dark));
          color:#000; box-shadow:0 4px 16px rgba(212,175,55,0.2);
        }
        .sa-btn-primary:hover { background:linear-gradient(135deg,var(--sa-gold-light),var(--sa-gold)); transform:translateY(-2px); box-shadow:0 8px 28px rgba(212,175,55,0.35); }
        .sa-btn-primary:disabled { opacity:0.45; cursor:not-allowed; transform:none; }
        .sa-btn-secondary { background:rgba(212,175,55,0.08); color:var(--sa-gold); border:1px solid rgba(212,175,55,0.25); }
        .sa-btn-secondary:hover { background:rgba(212,175,55,0.16); border-color:rgba(212,175,55,0.4); }
        .sa-btn-danger { background:rgba(239,68,68,0.1); color:var(--sa-danger); border:1px solid var(--sa-danger); }
        .sa-btn-danger:hover { background:rgba(239,68,68,0.22); }
        .sa-btn-success { background:rgba(16,185,129,0.1); color:var(--sa-success); border:1px solid var(--sa-success); }
        .sa-btn-success:hover { background:rgba(16,185,129,0.22); }
        .sa-btn-logout { width:100%; justify-content:center; background:rgba(239,68,68,0.08); color:var(--sa-danger); border:1px solid rgba(239,68,68,0.35); }
        .sa-btn-logout:hover { background:rgba(239,68,68,0.18); }

        /* TABLE */
        .sa-table-wrap {
          background: linear-gradient(145deg, rgba(8,6,20,0.72) 0%, rgba(18,12,6,0.68) 100%);
          backdrop-filter: blur(12px);
          border:1px solid rgba(212,175,55,0.12); border-radius:16px; overflow:hidden;
        }
        .sa-table { width:100%; border-collapse:collapse; }
        .sa-table th {
          padding:14px 20px; text-align:left; font-size:10px; font-weight:800;
          text-transform:uppercase; letter-spacing:1px; color:var(--sa-text-m);
          border-bottom:1px solid rgba(212,175,55,0.1);
          background:rgba(212,175,55,0.04);
        }
        .sa-table td {
          padding:14px 20px; font-size:13px; color:var(--sa-text-s);
          border-bottom:1px solid rgba(212,175,55,0.05);
        }
        .sa-table tr:last-child td { border-bottom:none; }
        .sa-table tr:hover td { background:rgba(212,175,55,0.03); }

        /* PROJECT CARDS */
        .sa-project-card {
          background: linear-gradient(145deg, rgba(8,6,20,0.72) 0%, rgba(18,12,6,0.68) 100%);
          backdrop-filter: blur(12px);
          border:1px solid rgba(212,175,55,0.12); border-radius:16px; padding:22px;
          transition:all 0.28s; position:relative; overflow:hidden;
        }
        .sa-project-card:hover { border-color:rgba(212,175,55,0.3); transform:translateY(-4px); box-shadow:0 16px 50px rgba(0,0,0,0.5); }

        /* FORMS */
        .sa-form-group { margin-bottom:20px; }
        .sa-form-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--sa-text-m); margin-bottom:8px; }
        .sa-form-input, .sa-form-select, .sa-form-textarea {
          width:100%; padding:11px 14px; background:rgba(8,6,20,0.6); border:1px solid rgba(212,175,55,0.18);
          border-radius:10px; color:var(--sa-text); font-size:13px; font-family:'DM Sans',sans-serif;
          transition:all 0.2s; outline:none;
        }
        .sa-form-input:focus, .sa-form-select:focus, .sa-form-textarea:focus {
          border-color:rgba(212,175,55,0.45); box-shadow:0 0 0 3px rgba(212,175,55,0.08);
        }
        .sa-form-textarea { resize:vertical; min-height:90px; }
        .sa-form-select option { background:#040612; }
        .sa-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .sa-grid-full { grid-column:1/-1; }

        /* TOAST */
        .sa-toast {
          position:fixed; bottom:32px; right:32px; z-index:9999;
          padding:14px 22px; background:rgba(8,6,20,0.95);
          border:1px solid rgba(212,175,55,0.35); border-radius:12px;
          color:var(--sa-gold); font-size:13px; font-weight:600;
          box-shadow:0 12px 48px rgba(0,0,0,0.5), 0 0 30px rgba(212,175,55,0.15);
          transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .sa-toast.visible { opacity:1; transform:translateY(0); }
        .sa-toast.hidden  { opacity:0; transform:translateY(20px); pointer-events:none; }

        /* OVERLAY / MODAL */
        .sa-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(16px);
          z-index:500; display:flex; align-items:center; justify-content:center; padding:20px;
          animation:sa-fadeIn 0.22s ease;
        }
        .sa-modal {
          background: linear-gradient(160deg, rgba(6,4,18,0.96) 0%, rgba(14,10,6,0.96) 100%);
          backdrop-filter: blur(20px);
          border:1px solid rgba(212,175,55,0.2); border-radius:18px;
          width:100%; max-width:660px; max-height:90vh; overflow-y:auto;
          animation:sa-scaleIn 0.3s ease;
          box-shadow:0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(212,175,55,0.12);
        }
        .sa-modal-header {
          padding:28px 28px 24px; border-bottom:1px solid rgba(212,175,55,0.12);
          display:flex; justify-content:space-between; align-items:flex-start;
          background:transparent;
        }
        .sa-modal-title { font-size:20px; font-weight:700; color:var(--sa-text); font-family:'Oswald',sans-serif; letter-spacing:"0.3px"; }
        .sa-modal-sub { font-size:11px; color:var(--sa-text-m); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px; }
        .sa-modal-close {
          width:36px; height:36px; display:flex; align-items:center; justify-content:center;
          background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.2);
          border-radius:9px; color:var(--sa-text-m); cursor:pointer; transition:all 0.2s; flex-shrink:0;
        }
        .sa-modal-close:hover { background:var(--sa-gold); color:#000; border-color:var(--sa-gold); }
        .sa-modal-body { padding:28px; }

        /* EMPTY STATE */
        .sa-empty {
          text-align:center; padding:64px 20px;
          background:transparent; border:1px dashed rgba(212,175,55,0.15);
          border-radius:16px;
        }
        .sa-empty-icon { font-size:48px; opacity:0.25; margin-bottom:16px; }
        .sa-empty-text { font-size:16px; color:var(--sa-text-m); }

        /* LIGHTBOX */
        .sa-lightbox { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:600; display:flex; align-items:center; justify-content:center; padding:20px; }
        .sa-lightbox-img { max-width:90vw; max-height:85vh; object-fit:contain; border-radius:10px; }
        .sa-lightbox-close, .sa-lightbox-nav { position:absolute; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.25); color:#fff; border-radius:9px; width:42px; height:42px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; }
        .sa-lightbox-close:hover, .sa-lightbox-nav:hover { background:rgba(212,175,55,0.28); }
        .sa-lightbox-close { top:20px; right:24px; }
        .sa-lightbox-nav.prev { left:20px; top:50%; transform:translateY(-50%); }
        .sa-lightbox-nav.next { right:20px; top:50%; transform:translateY(-50%); }
        .sa-lightbox-count { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); font-size:12px; color:rgba(212,175,55,0.5); font-family:'Space Mono',monospace; }

        /* HOME PAGE specific */
        .sa-home-hero {
          position:relative; padding:48px 40px 36px; overflow:hidden;
        }
        .sa-home-hero-bg {
          position:absolute; inset:0;
          background:transparent;
          pointer-events:none;
        }
        .sa-home-hero-bg::before {
          content:''; position:absolute; top:-80px; right:-80px;
          width:360px; height:360px; border-radius:50%;
          background:radial-gradient(circle,rgba(212,175,55,0.07),transparent 70%);
        }
        .sa-welcome-text {
          font-size:42px; font-weight:700; font-family:'Oswald',sans-serif;
          color:var(--sa-text); letter-spacing:"-0.5px"; line-height:1.1; margin-bottom:8px;
        }
        .sa-welcome-text em {
          font-style:italic;
          background:linear-gradient(135deg,var(--sa-gold-light),var(--sa-gold),var(--sa-gold-dark));
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
        }
        .sa-welcome-date { font-size:13px; color:var(--sa-text-m); font-weight:400; margin-top:4px; }

        /* Video upload button */
        .sa-video-upload-btn {
          display:inline-flex; align-items:center; gap:8px;
          padding:8px 16px; border-radius:9px; border:1px solid rgba(212,175,55,0.2);
          background:rgba(212,175,55,0.06); color:var(--sa-text-m); font-size:12px;
          font-weight:600; cursor:pointer; transition:all 0.2s; font-family:'DM Sans',sans-serif;
        }
        .sa-video-upload-btn:hover { background:rgba(212,175,55,0.14); color:var(--sa-gold); border-color:rgba(212,175,55,0.35); }

        /* Progress mini bar */
        .sa-progress-bar {
          height:4px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; margin-top:10px;
        }
        .sa-progress-fill { height:100%; border-radius:2px; transition:width 0.4s ease; }

        /* Analysis card rows */
        .sa-analysis-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:11px 0; border-bottom:1px solid rgba(212,175,55,0.06);
        }
        .sa-analysis-row:last-child { border-bottom:none; }

        @keyframes sa-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>

      {/* VIDEO BACKGROUND */}
      <div className="sa-video-bg">
        <video
          ref={videoRef}
          src={backgroundVideo || "/videos/GettyImages-1332151934.mp4"}
          autoPlay muted loop playsInline
        />
        <div className="sa-video-overlay" />
      </div>

      {/* FLASH PANEL */}
      {showFlashPanel && (
        <SAFlashPanel
          saName={(user as any)?.name || user?.email?.split("@")[0] || "Superadmin"}
          pendingApprovals={pendingApprovals}
          fullyApproved={fullyApproved}
          allTasks={tasks}
          teamMembers={teamMembers}
          projects={projects}
          onClose={() => setShowFlashPanel(false)}
          onNavigate={(tab) => handleTabChange(tab)}
        />
      )}

      <div className="sa-app">
        {/* SIDEBAR */}
        <aside className="sa-sidebar">
          <img src={roswaltLogo} alt="Roswalt" className="sa-sidebar-logo" />
          <div className="sa-sidebar-divider" />
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sa-nav-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.icon}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="sa-nav-badge">{tab.count}</span>
              )}
              <span className="sa-nav-tooltip">{tab.label}</span>
            </button>
          ))}
          <div style={{ flex:1 }} />
          <div className="sa-sidebar-divider" />
          {/* Video upload trigger */}
          <button
            className="sa-nav-btn"
            onClick={() => videoInputRef.current?.click()}
            title="Change background video"
          >
            <Video size={17} />
            <span className="sa-nav-tooltip">BG Video</span>
          </button>
          <input ref={videoInputRef} type="file" accept="video/*" style={{ display:"none" }} onChange={e => handleBackgroundVideoUpload(e.target.files)} />
          {/* User avatar / logout */}
          <button
            className="sa-nav-btn"
            onClick={handleLogout}
            style={{ color:"rgba(239,68,68,0.7)" }}
          >
            <LogOut size={17} />
            <span className="sa-nav-tooltip">Sign Out</span>
          </button>
        </aside>

        {/* MAIN */}
        <main className="sa-main" style={{ opacity: mounted ? 1 : 0 }}>

          {/* TOP BAR */}
          <div className="sa-topbar">
            <div className="sa-topbar-left">
              <div>
                <div className="sa-topbar-title">
                  {activeTab === "home"      && <>Superadmin <em>HQ</em></>}
                  {activeTab === "overview"  && <>Command <em>Centre</em></>}
                  {activeTab === "approvals" && <>Final <em>Approvals</em></>}
                  {activeTab === "tickets"   && <>Ticket <em>Oversight</em></>}
                  {activeTab === "projects"  && <>Project <em>Portfolio</em></>}
                  {activeTab === "users"     && <>Team <em>Directory</em></>}
                  {activeTab === "addUser"   && <>Add <em>Member</em></>}
                  {activeTab === "tasks"     && <>All <em>Tasks</em></>}
                  {activeTab === "activity"  && <>Activity <em>Monitor</em></>}
                  {activeTab === "ai"        && <>Claude <em>AI</em></>}
                </div>
                <div className="sa-topbar-sub">{today}</div>
              </div>
            </div>
            <div className="sa-topbar-right">
              {pendingApprovals.length > 0 && (
                <div
                  onClick={() => setActiveTab("approvals")}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", cursor:"pointer" }}
                >
                  <div style={{ width:7, height:7, borderRadius:"50%", background:G.amber, animation:"sa-pulse 1.5s ease-in-out infinite" }} />
                  <span style={{ fontSize:11, fontWeight:700, color:G.amber }}>{pendingApprovals.length} PENDING</span>
                </div>
              )}
              <button className="sa-btn sa-btn-primary" style={{ padding:"8px 16px", fontSize:12 }} onClick={() => setShowCreateModal(true)}>
                <Plus size={14} /> New Task
              </button>
              {user?.role === "superadmin" && (
                <button className="sa-btn sa-btn-secondary" style={{ padding:"8px 14px", fontSize:12 }} onClick={handleExportCredentials} disabled={exporting}>
                  <FileText size={14} /> {exporting ? "…" : "Export"}
                </button>
              )}
            </div>
          </div>

          {/* TOAST */}
          <div className={`sa-toast ${successMsg ? "visible" : "hidden"}`}>{successMsg}</div>

          {/* ── FLASH ALERTS BAR ──────────────────────────────────────── */}
          {flashAlerts.length > 0 && (
            <div style={{ position:"sticky", top:60, zIndex:14, display:"flex", flexDirection:"column", gap:4, padding:"8px 32px 0", pointerEvents:"none" }}>
              {flashAlerts.map(a => (
                <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", borderRadius:9, background:`linear-gradient(90deg,${a.color}18,${a.color}0a)`, border:`1px solid ${a.color}35`, backdropFilter:"blur(12px)", animation:"sa-fadeUp 0.3s ease both", pointerEvents:"auto" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:a.color, boxShadow:`0 0 8px ${a.color}`, flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:600, color:a.color }}>{a.msg}</span>
                  <button onClick={() => setFlashAlerts(p => p.filter(x=>x.id!==a.id))} style={{ marginLeft:"auto", background:"none", border:"none", color:a.color, cursor:"pointer", opacity:0.6, fontSize:13, padding:"0 4px" }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* ── HOME TAB ──────────────────────────────────────────────── */}
          {activeTab === "home" && (
            <div className="sa-fade-in">
              {/* Hero */}
              <div className="sa-home-hero">
                <div className="sa-home-hero-bg" />
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16, position:"relative" }}>
                  <div>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 12px", borderRadius:20, background:"rgba(212,175,55,0.1)", border:"1px solid rgba(212,175,55,0.25)", fontSize:10, fontWeight:700, color:G.gold, textTransform:"uppercase", letterSpacing:"1.2px", marginBottom:16 }}>
                      <Shield size={9} /> Superadmin Dashboard
                    </div>
                    <div className="sa-welcome-text">
                      {timeGreet}, <em>{(user as any)?.name || user?.email?.split("@")[0] || "Admin"}</em>
                    </div>
                    <div className="sa-welcome-date">Today is {today}</div>
                  </div>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <label className="sa-video-upload-btn" htmlFor="sa-video-file">
                      <Video size={14} /> Change Background
                    </label>
                    <input id="sa-video-file" type="file" accept="video/*" style={{ display:"none" }}
                      onChange={e => handleBackgroundVideoUpload(e.target.files)} />
                    <button className="sa-btn sa-btn-primary" onClick={() => setShowCreateModal(true)}>
                      <Plus size={14} /> Assign Task
                    </button>
                  </div>
                </div>
              </div>

              <div className="sa-page" style={{ paddingTop:0 }}>
                {/* STAT CARDS */}
                <div className="sa-stats-grid">
                  {homeStats.map((s, i) => (
                    <div
                      key={i}
                      className={`sa-stat-card sa-fade-up ${s.urgent ? "urgent" : ""}`}
                      style={{ animationDelay:`${i*60}ms`, cursor:"pointer", borderColor: s.urgent ? `${s.color}30` : undefined }}
                      onClick={() => setActiveTab(s.tab)}
                    >
                      <div className="sa-stat-dot" style={{ background:s.color, boxShadow:`0 0 10px ${s.color}${s.urgent?"":"55"}` }} />
                      <div className="sa-stat-icon">{s.icon}</div>
                      <div className="sa-stat-num" style={{ background:`linear-gradient(135deg,${s.color},${s.color}aa)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{s.value}</div>
                      <div className="sa-stat-label">{s.label}</div>
                      <div className="sa-stat-sub">{s.sub}</div>
                      {tasks.length > 0 && (s.label === "Fully Approved" || s.label === "Pending Approval") && (
                        <div className="sa-progress-bar" style={{ marginTop:12 }}>
                          <div className="sa-progress-fill" style={{ width:`${Math.min(100,(s.value/Math.max(tasks.length,1))*100)}%`, background:s.color }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ANALYSIS PANEL */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:20, marginBottom:32 }}>
                  {/* Approval Pipeline */}
                  <div className="sa-card sa-fade-up" style={{ animationDelay:"100ms" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                      <div>
                        <div style={{ fontSize:12, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", fontWeight:700, marginBottom:4 }}>Approval Pipeline</div>
                        <div style={{ fontSize:22, fontWeight:800, color:G.textPrimary, fontFamily:"'Oswald',sans-serif" }}>{tasks.length} Tasks</div>
                      </div>
                      <div style={{ width:42, height:42, borderRadius:12, background:`${G.amber}18`, border:`1px solid ${G.amber}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <TrendingUp size={18} color={G.amber} />
                      </div>
                    </div>
                    {[
                      { label:"Assigned",           value: tasks.filter((t:Task)=>t.approvalStatus==="assigned").length,             color:G.textMuted },
                      { label:"In Review",           value: inReview.length,                                                          color:G.cyan },
                      { label:"Admin Approved",      value: pendingApprovals.length,                                                  color:G.amber },
                      { label:"Fully Approved",      value: fullyApproved.length,                                                     color:G.success },
                      { label:"Rejected / Rework",   value: tasks.filter((t:Task)=>t.approvalStatus==="rejected").length,            color:G.danger },
                    ].map((row, i) => (
                      <div key={i} className="sa-analysis-row">
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:row.color, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:G.textSecondary }}>{row.label}</span>
                        </div>
                        <span style={{ fontSize:14, fontWeight:700, color:row.color, fontFamily:"'Oswald',sans-serif" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Team Breakdown */}
                  <div className="sa-card sa-fade-up" style={{ animationDelay:"160ms" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                      <div>
                        <div style={{ fontSize:12, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", fontWeight:700, marginBottom:4 }}>Team Breakdown</div>
                        <div style={{ fontSize:22, fontWeight:800, color:G.textPrimary, fontFamily:"'Oswald',sans-serif" }}>{teamMembers.length} Members</div>
                      </div>
                      <div style={{ width:42, height:42, borderRadius:12, background:`${G.gold}18`, border:`1px solid ${G.gold}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Users size={18} color={G.gold} />
                      </div>
                    </div>
                    {[
                      { label:"Superadmin", value: teamMembers.filter((m:any)=>m.role==="superadmin").length, color:G.gold },
                      { label:"Admin",      value: teamMembers.filter((m:any)=>m.role==="admin").length,      color:G.cyan },
                      { label:"Staff",      value: teamMembers.filter((m:any)=>m.role==="staff").length,      color:G.purple },
                    ].map((row, i) => (
                      <div key={i} className="sa-analysis-row">
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:row.color, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:G.textSecondary }}>{row.label}</span>
                        </div>
                        <span style={{ fontSize:14, fontWeight:700, color:row.color, fontFamily:"'Oswald',sans-serif" }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid rgba(212,175,55,0.08)" }}>
                      <div style={{ fontSize:11, color:G.textMuted, marginBottom:8 }}>Tasks per staff member</div>
                      <div style={{ fontSize:24, fontWeight:900, color:G.gold, fontFamily:"'Oswald',sans-serif" }}>
                        {teamMembers.filter((m:any)=>m.role==="staff").length > 0
                          ? (tasks.length / teamMembers.filter((m:any)=>m.role==="staff").length).toFixed(1)
                          : "—"}
                        <span style={{ fontSize:13, color:G.textMuted, fontWeight:400, marginLeft:4 }}>avg</span>
                      </div>
                    </div>
                  </div>

                  {/* Assistance & Escalations */}
                  <div className="sa-card sa-fade-up" style={{ animationDelay:"220ms" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                      <div>
                        <div style={{ fontSize:12, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", fontWeight:700, marginBottom:4 }}>Escalations</div>
                        <div style={{ fontSize:22, fontWeight:800, color:G.textPrimary, fontFamily:"'Oswald',sans-serif" }}>{allAssistTickets.length} Tickets</div>
                      </div>
                      <div style={{ width:42, height:42, borderRadius:12, background:`${G.magenta}18`, border:`1px solid ${G.magenta}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <MessageSquare size={18} color={G.magenta} />
                      </div>
                    </div>
                    {[
                      { label:"Open",           value: allAssistTickets.filter((t:any)=>t.status==="open").length,           color:G.cyan },
                      { label:"Pending Admin",  value: allAssistTickets.filter((t:any)=>t.status==="pending-admin").length,  color:G.amber },
                      { label:"Admin Approved", value: allAssistTickets.filter((t:any)=>t.status==="admin-approved").length, color:G.success },
                      { label:"Resolved",       value: allAssistTickets.filter((t:any)=>t.status==="resolved").length,       color:G.textMuted },
                    ].map((row, i) => (
                      <div key={i} className="sa-analysis-row">
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:row.color, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:G.textSecondary }}>{row.label}</span>
                        </div>
                        <span style={{ fontSize:14, fontWeight:700, color:row.color, fontFamily:"'Oswald',sans-serif" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* TAT & Frozen */}
                  <div className="sa-card sa-fade-up" style={{ animationDelay:"280ms", borderColor: tatBreached.length > 0 ? `${G.danger}25` : undefined }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                      <div>
                        <div style={{ fontSize:12, color:G.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", fontWeight:700, marginBottom:4 }}>Risk Signals</div>
                        <div style={{ fontSize:22, fontWeight:800, color:tatBreached.length>0?G.danger:G.success, fontFamily:"'Oswald',sans-serif" }}>
                          {tatBreached.length > 0 ? `${tatBreached.length} Breach${tatBreached.length>1?"es":""}` : "All Clear"}
                        </div>
                      </div>
                      <div style={{ width:42, height:42, borderRadius:12, background:`${tatBreached.length>0?G.danger:G.success}18`, border:`1px solid ${tatBreached.length>0?G.danger:G.success}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <AlertTriangle size={18} color={tatBreached.length>0?G.danger:G.success} />
                      </div>
                    </div>
                    {[
                      { label:"TAT Breached",  value: tatBreached.length,  color:G.danger },
                      { label:"Frozen Tasks",  value: frozenTasks.length,  color:"#b06af3" },
                      { label:"Active Tasks",  value: tasks.filter((t:Task)=>t.approvalStatus!=="superadmin-approved").length, color:G.amber },
                    ].map((row, i) => (
                      <div key={i} className="sa-analysis-row">
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:row.color, flexShrink:0 }} />
                          <span style={{ fontSize:12, color:G.textSecondary }}>{row.label}</span>
                        </div>
                        <span style={{ fontSize:14, fontWeight:700, color:row.color, fontFamily:"'Oswald',sans-serif" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── BAR CHARTS ─────────────────────────────────────── */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:32 }}>

                  {/* Task Status Bar Chart */}
                  <div style={{ background:"linear-gradient(145deg,rgba(8,6,22,0.76),rgba(18,12,6,0.72))", backdropFilter:"blur(14px)", border:"1px solid rgba(212,175,55,0.14)", borderRadius:16, padding:24, boxShadow:"0 4px 28px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"1.2px", color:G.textMuted, marginBottom:4 }}>Task Status Breakdown</div>
                    <div style={{ fontSize:13, color:G.textSecondary, marginBottom:20 }}>By approval stage</div>
                    {(() => {
                      const bars = [
                        { label:"Assigned",   value: tasks.filter((t:Task)=>t.approvalStatus==="assigned").length,            color:G.textMuted },
                        { label:"In Review",  value: inReview.length,                                                          color:G.cyan },
                        { label:"Adm Apprvd", value: pendingApprovals.length,                                                  color:G.amber },
                        { label:"Approved",   value: fullyApproved.length,                                                     color:G.success },
                        { label:"Rejected",   value: tasks.filter((t:Task)=>t.approvalStatus==="rejected").length,            color:G.danger },
                      ];
                      const max = Math.max(...bars.map(b=>b.value), 1);
                      const chartH = 120;
                      return (
                        <div>
                          {/* Bars */}
                          <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:chartH, marginBottom:10 }}>
                            {bars.map((b,i) => (
                              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column" as const, alignItems:"center", gap:4, height:"100%", justifyContent:"flex-end" }}>
                                <span style={{ fontSize:11, fontWeight:700, color:b.color, fontFamily:"'Oswald',sans-serif" }}>{b.value}</span>
                                <div style={{ width:"100%", borderRadius:"4px 4px 0 0", background:`linear-gradient(180deg,${b.color},${b.color}66)`, height:`${Math.max((b.value/max)*100,4)}%`, transition:"height 0.6s ease", boxShadow:`0 0 12px ${b.color}44`, minHeight:4 }} />
                              </div>
                            ))}
                          </div>
                          {/* X labels */}
                          <div style={{ display:"flex", gap:10 }}>
                            {bars.map((b,i) => (
                              <div key={i} style={{ flex:1, textAlign:"center" as const, fontSize:9, color:G.textMuted, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.3px", lineHeight:1.3 }}>{b.label}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Team & Tickets Horizontal Bar Chart */}
                  <div style={{ background:"linear-gradient(145deg,rgba(8,6,22,0.76),rgba(18,12,6,0.72))", backdropFilter:"blur(14px)", border:"1px solid rgba(212,175,55,0.14)", borderRadius:16, padding:24, boxShadow:"0 4px 28px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"1.2px", color:G.textMuted, marginBottom:4 }}>Platform Metrics</div>
                    <div style={{ fontSize:13, color:G.textSecondary, marginBottom:20 }}>Horizontal view</div>
                    {(() => {
                      const bars = [
                        { label:"Total Tasks",      value: tasks.length,                                                                color:G.cyan },
                        { label:"Pending SA",       value: pendingApprovals.length,                                                     color:G.amber },
                        { label:"TAT Breached",     value: tatBreached.length,                                                          color:G.danger },
                        { label:"Frozen",           value: frozenTasks.length,                                                          color:"#b06af3" },
                        { label:"Assist Tickets",   value: allAssistTickets.length,                                                     color:G.magenta },
                        { label:"Team Members",     value: teamMembers.length,                                                          color:G.gold },
                      ];
                      const max = Math.max(...bars.map(b=>b.value), 1);
                      return (
                        <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                          {bars.map((b,i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <div style={{ width:88, fontSize:10, color:G.textMuted, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.3px", flexShrink:0, lineHeight:1.3 }}>{b.label}</div>
                              <div style={{ flex:1, height:14, background:"rgba(255,255,255,0.04)", borderRadius:7, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${Math.max((b.value/max)*100,2)}%`, background:`linear-gradient(90deg,${b.color},${b.color}88)`, borderRadius:7, transition:"width 0.7s ease", boxShadow:`0 0 8px ${b.color}44` }} />
                              </div>
                              <div style={{ width:26, textAlign:"right" as const, fontSize:12, fontWeight:700, color:b.color, fontFamily:"'Oswald',sans-serif", flexShrink:0 }}>{b.value}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                </div>

                {/* RECENT PENDING — quick view */}
                {pendingApprovals.length > 0 && (
                  <>
                    <div className="sa-section-label">⏳ Awaiting Your Sign-Off</div>
                    {pendingApprovals.slice(0,4).map((task: Task, idx: number) => (
                      <div className="sa-task-card sa-fade-up" key={task.id} style={{ animationDelay:`${idx*55}ms` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                          <div style={{ flex:1 }}>
                            <div className="sa-task-title">{task.title}</div>
                            <div className="sa-task-desc">{task.description?.slice(0,110)}{(task.description?.length||0)>110?"…":""}</div>
                          </div>
                          <button className="sa-btn sa-btn-primary" style={{ padding:"8px 14px", fontSize:12, flexShrink:0 }} onClick={() => openReviewModal(task)}>
                            <Eye size={13} /> Review
                          </button>
                        </div>
                        <div className="sa-task-meta">
                          <span className="sa-badge sa-badge-gold">Admin Approved</span>
                          {task.priority && <span className={priClass(task.priority)}><Flag size={10} /> {task.priority}</span>}
                          <span className="sa-badge sa-badge-cyan"><Calendar size={10} /> {new Date(task.dueDate).toLocaleDateString()}</span>
                          <span className="sa-badge sa-badge-purple"><User size={10} /> {getStaffName(task.assignedTo)}</span>
                        </div>
                      </div>
                    ))}
                    {pendingApprovals.length > 4 && (
                      <button onClick={() => setActiveTab("approvals")} className="sa-btn sa-btn-secondary" style={{ width:"100%", justifyContent:"center", marginTop:4 }}>
                        View all {pendingApprovals.length} pending <ChevronRight size={14} />
                      </button>
                    )}
                  </>
                )}

                {/* PROJECTS QUICK VIEW */}
                {projects.length > 0 && (
                  <>
                    <div className="sa-section-label">🏗 Active Projects</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
                      {activeProjects.slice(0,4).map((project: any, idx: number) => (
                        <div className="sa-project-card sa-fade-up" key={project.id} style={{ animationDelay:`${idx*60}ms` }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                            <div style={{ width:10, height:10, borderRadius:"50%", background:project.color||G.gold, boxShadow:`0 0 10px ${project.color||G.gold}55`, flexShrink:0 }} />
                            <div style={{ fontSize:14, fontWeight:700, color:G.textPrimary, flex:1 }}>{project.name}</div>
                            <span className="sa-badge sa-badge-success" style={{ fontSize:9 }}>{project.status||"active"}</span>
                          </div>
                          {project.projectType && <div style={{ fontSize:11, color:G.textMuted, marginBottom:6 }}>{project.projectType} {project.location ? `· ${project.location}` : ""}</div>}
                          <div style={{ fontSize:11, color:G.textMuted }}>{tasks.filter((t:Task)=>t.projectId===project.id).length} tasks</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}

          {/* ── ALL TASKS TAB ─────────────────────────────────────────────── */}
          {activeTab === "tasks" && (() => {
            const statusColors: Record<string,string> = {
              "assigned": G.textMuted, "in-review": G.cyan, "admin-approved": G.amber,
              "superadmin-approved": G.success, "rejected": G.danger,
            };
            const filtered = (tasks as Task[]).filter((t: Task) => {
              const matchSearch = !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                t.assignedTo.toLowerCase().includes(taskSearch.toLowerCase());
              const matchFilter = taskFilter === "all" ||
                (taskFilter === "pending" && t.approvalStatus !== "superadmin-approved") ||
                (taskFilter === "breached" && (t as any).tatBreached) ||
                (taskFilter === "frozen" && (t as any).isFrozen) ||
                t.approvalStatus === taskFilter;
              return matchSearch && matchFilter;
            });
            const filters = [
              { key:"all", label:`All (${tasks.length})` },
              { key:"assigned", label:"Assigned" },
              { key:"in-review", label:"In Review" },
              { key:"admin-approved", label:"Adm. Approved" },
              { key:"superadmin-approved", label:"SA Approved" },
              { key:"pending", label:"Pending" },
              { key:"breached", label:"TAT Breached" },
              { key:"frozen", label:"Frozen" },
            ];
            return (
              <div className="sa-page sa-fade-in">
                <div className="sa-page-header">
                  <div>
                    <h1 className="sa-page-title">All <em>Tasks</em></h1>
                    <p className="sa-page-sub">Complete lifecycle view of every task across all users</p>
                  </div>
                  <button className="sa-btn sa-btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={15} /> Assign Task
                  </button>
                </div>

                {/* Search + filters */}
                <div style={{ display:"flex", flexWrap:"wrap" as const, gap:10, marginBottom:24, alignItems:"center" }}>
                  <input
                    className="sa-form-input"
                    placeholder="🔍 Search by title or assignee…"
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    style={{ width:260, padding:"9px 14px", fontSize:12 }}
                  />
                  <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
                    {filters.map(f => (
                      <button key={f.key}
                        onClick={() => setTaskFilter(f.key)}
                        style={{ padding:"7px 13px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer",
                          background: taskFilter===f.key ? `${G.gold}22` : "rgba(255,255,255,0.04)",
                          border: `1px solid ${taskFilter===f.key ? G.gold+"55" : "rgba(255,255,255,0.1)"}`,
                          color: taskFilter===f.key ? G.gold : G.textMuted, transition:"all 0.18s" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize:11, color:G.textMuted, marginLeft:"auto" }}>{filtered.length} task{filtered.length!==1?"s":""}</span>
                </div>

                {/* Task cards */}
                {filtered.length === 0 ? (
                  <div className="sa-empty"><div className="sa-empty-icon">📋</div><div className="sa-empty-text">No tasks match filter</div></div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
                    {filtered.map((task: Task, idx: number) => {
                      const attachments = (task as any).attachments || [];
                      const history = (task as any).activityLog || (task as any).history || [];
                      const isFrozen = (task as any).isFrozen;
                      const isTat = (task as any).tatBreached;
                      const statusColor = statusColors[task.approvalStatus] || G.textMuted;
                      const proj = (projects as any[]).find((p:any)=>p.id===task.projectId);
                      // Progress %
                      const progressMap: Record<string,number> = {
                        "assigned":20, "in-review":50, "admin-approved":75, "superadmin-approved":100, "rejected":10
                      };
                      const progress = progressMap[task.approvalStatus] || 0;
                      return (
                        <div key={task.id} className="sa-task-card sa-fade-up" style={{ animationDelay:`${Math.min(idx,8)*40}ms`, borderColor: isFrozen ? "#b06af355" : isTat ? `${G.danger}35` : undefined }}>
                          {/* Header row */}
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:12 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                                {isFrozen && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:"#b06af322", color:"#b06af3", border:"1px solid #b06af355", fontWeight:700, textTransform:"uppercase" as const }}>🔒 Frozen</span>}
                                {isTat    && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:`${G.danger}18`, color:G.danger, border:`1px solid ${G.danger}44`, fontWeight:700, textTransform:"uppercase" as const }}>⚠ TAT</span>}
                                {proj && <span style={{ fontSize:9, color:G.textMuted }}>📁 {proj.name}</span>}
                              </div>
                              <div className="sa-task-title" style={{ marginBottom:4 }}>{task.title}</div>
                              <div className="sa-task-desc">{task.description?.slice(0,140)}{(task.description?.length||0)>140?"…":""}</div>
                            </div>
                            <div style={{ display:"flex", flexDirection:"column" as const, gap:6, flexShrink:0, alignItems:"flex-end" }}>
                              <button className="sa-btn sa-btn-primary" style={{ padding:"7px 13px", fontSize:11 }} onClick={() => openTaskDetail(task)}>
                                <Eye size={12} /> Details
                              </button>
                              {task.approvalStatus === "admin-approved" && (
                                <button className="sa-btn sa-btn-success" style={{ padding:"7px 13px", fontSize:11 }} onClick={() => openReviewModal(task)}>
                                  <CheckCircle size={12} /> Review
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div style={{ marginBottom:12 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                              <span style={{ fontSize:10, color:statusColor, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.5px" }}>
                                {task.approvalStatus?.replace(/-/g," ")}
                              </span>
                              <span style={{ fontSize:10, color:G.textMuted }}>{progress}%</span>
                            </div>
                            <div style={{ height:5, background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${statusColor},${statusColor}bb)`, borderRadius:3, transition:"width 0.6s ease", boxShadow:`0 0 8px ${statusColor}55` }} />
                            </div>
                          </div>

                          {/* Meta row */}
                          <div className="sa-task-meta">
                            <span className="sa-badge sa-badge-purple"><User size={10} /> {getStaffName(task.assignedTo)}</span>
                            {task.priority && <span className={priClass(task.priority)}><Flag size={10} /> {task.priority}</span>}
                            <span className="sa-badge sa-badge-cyan"><Calendar size={10} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</span>
                            {attachments.length > 0 && (
                              <span className="sa-badge sa-badge-gold" style={{ cursor:"pointer" }} onClick={()=>openLightbox(attachments)}>
                                📎 {attachments.length} attachment{attachments.length!==1?"s":""}
                              </span>
                            )}
                            {history.length > 0 && (
                              <span className="sa-badge" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:G.textMuted, fontSize:10 }}>
                                🕐 {history.length} event{history.length!==1?"s":""}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "overview" && (() => {
            // ── Pie chart helper (SVG) ───────────────────────────────────
            const PieChart = ({ slices, size=160 }: { slices:{value:number;color:string;label:string}[]; size?:number }) => {
              const total = slices.reduce((s,x)=>s+x.value,0) || 1;
              const r = size/2 - 16;
              const cx = size/2; const cy = size/2;
              let angle = -Math.PI/2;
              const paths = slices.map(s=>{
                const pct = s.value/total;
                const a1 = angle; const a2 = angle + pct*2*Math.PI;
                const laf = pct > 0.5 ? 1 : 0;
                const x1=cx+r*Math.cos(a1); const y1=cy+r*Math.sin(a1);
                const x2=cx+r*Math.cos(a2); const y2=cy+r*Math.sin(a2);
                const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${laf} 1 ${x2} ${y2} Z`;
                angle = a2;
                return { ...s, d, pct };
              });
              return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  {paths.map((p,i)=>(
                    <path key={i} d={p.d} fill={p.color} opacity={0.85}
                      style={{ filter:`drop-shadow(0 0 6px ${p.color}66)` }} />
                  ))}
                  <circle cx={cx} cy={cy} r={r*0.52} fill="rgba(4,4,18,0.9)" />
                  <text x={cx} y={cy-5} textAnchor="middle" fill={G.textPrimary} fontSize={18} fontWeight={800} fontFamily="Oswald">{total}</text>
                  <text x={cx} y={cy+14} textAnchor="middle" fill={G.textMuted} fontSize={8} fontWeight={600} letterSpacing={1}>TOTAL</text>
                </svg>
              );
            };

            // ── Bar chart helper ─────────────────────────────────────────
            const BarChart = ({ bars, height=100 }: { bars:{label:string;value:number;color:string}[]; height?:number }) => {
              const max = Math.max(...bars.map(b=>b.value), 1);
              return (
                <div>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:8, height }}>
                    {bars.map((b,i)=>(
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column" as const, alignItems:"center", gap:4, height:"100%", justifyContent:"flex-end" }}>
                        <span style={{ fontSize:11, fontWeight:700, color:b.color, fontFamily:"'Oswald',sans-serif" }}>{b.value}</span>
                        <div style={{ width:"100%", borderRadius:"4px 4px 0 0", background:`linear-gradient(180deg,${b.color},${b.color}55)`,
                          height:`${Math.max((b.value/max)*100,3)}%`, boxShadow:`0 0 10px ${b.color}44`, minHeight:3 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    {bars.map((b,i)=>(
                      <div key={i} style={{ flex:1, textAlign:"center" as const, fontSize:8, color:G.textMuted, fontWeight:600,
                        textTransform:"uppercase" as const, letterSpacing:"0.3px", lineHeight:1.3 }}>{b.label}</div>
                    ))}
                  </div>
                </div>
              );
            };

            // ── Data ─────────────────────────────────────────────────────
            const statusSlices = [
              { label:"Assigned",  value:(tasks as Task[]).filter(t=>t.approvalStatus==="assigned").length,           color:G.textMuted },
              { label:"In Review", value:inReview.length,                                                              color:G.cyan },
              { label:"Adm Appvd", value:pendingApprovals.length,                                                     color:G.amber },
              { label:"Approved",  value:fullyApproved.length,                                                         color:G.success },
              { label:"Rejected",  value:(tasks as Task[]).filter(t=>t.approvalStatus==="rejected").length,           color:G.danger },
            ];
            const riskSlices = [
              { label:"On Track", value:Math.max((tasks as Task[]).length - tatBreached.length - frozenTasks.length,0), color:G.success },
              { label:"TAT",      value:tatBreached.length,                                                             color:G.danger },
              { label:"Frozen",   value:frozenTasks.length,                                                             color:"#b06af3" },
            ];

            // TAT per user (bar chart)
            const tatMap: Record<string,number> = {};
            (tasks as Task[]).filter(t=>(t as any).tatBreached).forEach(t => { tatMap[t.assignedTo]=(tatMap[t.assignedTo]||0)+1; });
            const tatBars = Object.entries(tatMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([email,val])=>({
              label:(teamMembers as any[]).find(m=>m.email===email)?.name?.split(" ")[0]||email.split("@")[0], value:val, color:G.danger
            }));

            // Completion over projects (bar)
            const projCompletionBars = (projects as any[]).slice(0,6).map((p:any) => {
              const projTasks = (tasks as Task[]).filter(t=>t.projectId===p.id);
              const done = projTasks.filter(t=>t.approvalStatus==="superadmin-approved").length;
              return { label:p.name?.slice(0,6)||"—", value:done, color:G.success };
            });

            // Pending per user
            const pendingMap: Record<string,number> = {};
            (tasks as Task[]).filter(t=>t.approvalStatus!=="superadmin-approved").forEach(t=>{pendingMap[t.assignedTo]=(pendingMap[t.assignedTo]||0)+1;});
            const pendingBars = Object.entries(pendingMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([email,val])=>({
              label:(teamMembers as any[]).find(m=>m.email===email)?.name?.split(" ")[0]||email.split("@")[0], value:val, color:G.amber
            }));

            const card = (children: React.ReactNode, delay=0) => (
              <div style={{ background:"linear-gradient(145deg,rgba(8,6,22,0.76),rgba(18,12,6,0.72))", backdropFilter:"blur(14px)",
                border:"1px solid rgba(212,175,55,0.14)", borderRadius:16, padding:24, animationDelay:`${delay}ms`,
                boxShadow:"0 4px 28px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.04)" }} className="sa-fade-up">
                {children}
              </div>
            );
            const cardTitle = (icon:string, title:string, sub?:string) => (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:9, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"1.2px", color:G.textMuted, marginBottom:4 }}>{icon} {title}</div>
                {sub && <div style={{ fontSize:12, color:G.textSecondary }}>{sub}</div>}
              </div>
            );

            return (
              <div className="sa-page sa-fade-in">
                <div className="sa-page-header">
                  <div>
                    <h1 className="sa-page-title">Command <em>Centre</em></h1>
                    <p className="sa-page-sub">Real-time analytics, charts and full platform visibility</p>
                  </div>
                  <button className="sa-btn sa-btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={15} /> Assign Task
                  </button>
                </div>

                {/* Stat strip */}
                <div className="sa-stats-grid" style={{ marginBottom:28 }}>
                  {[
                    { icon:"⏳", num:pendingApprovals.length,  label:"Pending SA",      color:G.amber },
                    { icon:"✓",  num:fullyApproved.length,     label:"Fully Approved",  color:G.success },
                    { icon:"◈",  num:inReview.length,          label:"In Review",       color:G.cyan },
                    { icon:"⚠",  num:tatBreached.length,       label:"TAT Breached",    color:G.danger },
                    { icon:"🔒", num:frozenTasks.length,       label:"Frozen",          color:"#b06af3" },
                    { icon:"🎫", num:allAssistTickets.length,  label:"Tickets",         color:G.magenta },
                    { icon:"👥", num:teamMembers.length,       label:"Team",            color:G.gold },
                    { icon:"🏗",  num:projects.length,          label:"Projects",        color:G.purple },
                  ].map((s,i) => (
                    <div className="sa-stat-card sa-fade-up" key={i} style={{ animationDelay:`${i*40}ms` }}>
                      <div className="sa-stat-dot" style={{ background:s.color }} />
                      <div className="sa-stat-icon">{s.icon}</div>
                      <div className="sa-stat-num" style={{ background:`linear-gradient(135deg,${s.color},${s.color}99)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{s.num}</div>
                      <div className="sa-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ROW 1: Pie charts */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                  {card(
                    <>
                      {cardTitle("🥧","Task Status Distribution","By approval stage")}
                      <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" as const }}>
                        <PieChart slices={statusSlices} size={160} />
                        <div style={{ flex:1, display:"flex", flexDirection:"column" as const, gap:8 }}>
                          {statusSlices.map((s,i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, flexShrink:0 }} />
                              <span style={{ fontSize:11, color:G.textSecondary, flex:1 }}>{s.label}</span>
                              <span style={{ fontSize:13, fontWeight:700, color:s.color, fontFamily:"'Oswald',sans-serif" }}>{s.value}</span>
                              <span style={{ fontSize:10, color:G.textMuted, width:30, textAlign:"right" as const }}>
                                {tasks.length ? Math.round(s.value/tasks.length*100) : 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>, 50
                  )}
                  {card(
                    <>
                      {cardTitle("🎯","Risk Distribution","On-track vs at-risk tasks")}
                      <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" as const }}>
                        <PieChart slices={riskSlices} size={160} />
                        <div style={{ flex:1, display:"flex", flexDirection:"column" as const, gap:8 }}>
                          {riskSlices.map((s,i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, flexShrink:0 }} />
                              <span style={{ fontSize:11, color:G.textSecondary, flex:1 }}>{s.label}</span>
                              <span style={{ fontSize:13, fontWeight:700, color:s.color, fontFamily:"'Oswald',sans-serif" }}>{s.value}</span>
                            </div>
                          ))}
                          <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(212,175,55,0.08)" }}>
                            <div style={{ fontSize:10, color:G.textMuted, marginBottom:4 }}>Assist. tickets by status</div>
                            {[
                              { label:"Open",     value:(allAssistTickets as any[]).filter(t=>t.status==="open").length,           color:G.cyan },
                              { label:"Pending",  value:(allAssistTickets as any[]).filter(t=>t.status==="pending-admin").length,  color:G.amber },
                              { label:"Resolved", value:(allAssistTickets as any[]).filter(t=>t.status==="resolved").length,       color:G.success },
                            ].map((row,i)=>(
                              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                                <span style={{ fontSize:11, color:G.textSecondary }}>{row.label}</span>
                                <span style={{ fontSize:11, fontWeight:700, color:row.color }}>{row.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>, 80
                  )}
                </div>

                {/* ROW 2: Bar charts */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                  {tatBars.length > 0 ? card(
                    <>
                      {cardTitle("⚠","TAT Breach by User","Who has the most deadline misses")}
                      <BarChart bars={tatBars} height={110} />
                    </>, 100
                  ) : card(
                    <>
                      {cardTitle("⚠","TAT Breach Analysis","")}
                      <div style={{ textAlign:"center" as const, padding:"30px 0", color:G.success, fontSize:13 }}>✓ No TAT breaches — all on track!</div>
                    </>, 100
                  )}
                  {card(
                    <>
                      {cardTitle("📊","Pending Tasks per User","Active workload distribution")}
                      {pendingBars.length > 0 ? <BarChart bars={pendingBars} height={110} /> : (
                        <div style={{ textAlign:"center" as const, padding:"30px 0", color:G.success, fontSize:13 }}>✓ No pending tasks</div>
                      )}
                    </>, 130
                  )}
                </div>

                {/* ROW 3: Project completion + team breakdown */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                  {card(
                    <>
                      {cardTitle("✅","Completion per Project","Fully approved tasks by project")}
                      {projCompletionBars.length > 0 ? <BarChart bars={projCompletionBars} height={100} /> : (
                        <div style={{ textAlign:"center" as const, padding:"20px 0", color:G.textMuted, fontSize:12 }}>No projects yet</div>
                      )}
                    </>, 160
                  )}
                  {card(
                    <>
                      {cardTitle("👥","Team Breakdown",`${teamMembers.length} members across all roles`)}
                      <BarChart bars={[
                        { label:"Superadmin", value:(teamMembers as any[]).filter(m=>m.role==="superadmin").length, color:G.gold },
                        { label:"Admin",      value:(teamMembers as any[]).filter(m=>m.role==="admin").length,      color:G.cyan },
                        { label:"Staff",      value:(teamMembers as any[]).filter(m=>m.role==="staff").length,      color:G.purple },
                      ]} height={100} />
                      <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid rgba(212,175,55,0.08)" }}>
                        <div style={{ fontSize:10, color:G.textMuted, marginBottom:4 }}>Avg tasks per staff member</div>
                        <div style={{ fontSize:22, fontWeight:900, color:G.gold, fontFamily:"'Oswald',sans-serif" }}>
                          {(teamMembers as any[]).filter(m=>m.role==="staff").length > 0
                            ? ((tasks as Task[]).length / (teamMembers as any[]).filter(m=>m.role==="staff").length).toFixed(1) : "—"}
                          <span style={{ fontSize:12, color:G.textMuted, marginLeft:4 }}>avg</span>
                        </div>
                      </div>
                    </>, 190
                  )}
                </div>

                {/* Full task table */}
                <div className="sa-section-label">📋 All Tasks ({tasks.length})</div>
                {tasks.length === 0 ? (
                  <div className="sa-empty"><div className="sa-empty-icon">📋</div><div className="sa-empty-text">No tasks yet</div></div>
                ) : (
                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead><tr>
                        <th>Task</th><th>Assigned To</th><th>Assigned By</th><th>Progress</th><th>Approval</th><th>Start Date</th><th>Due Date</th><th>Completed On</th><th>Score</th><th>Action</th>
                      </tr></thead>
                      <tbody>
                        {(tasks as Task[]).map((task: Task) => {
                          const progressMap: Record<string,number> = {"assigned":20,"in-review":50,"admin-approved":75,"superadmin-approved":100,"rejected":10};
                          const sc: Record<string,string> = {"assigned":G.textMuted,"in-review":G.cyan,"admin-approved":G.amber,"superadmin-approved":G.success,"rejected":G.danger};
                          const p = progressMap[task.approvalStatus] || 0;
                          const c = sc[task.approvalStatus] || G.textMuted;
                          const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"}) : "—";
                          const completedOn = task.approvalStatus === "superadmin-approved"
                            ? ((task as any).completedAt || (task as any).approvedAt || (task as any).reviewHistory?.slice(-1)[0]?.at || null)
                            : null;
                          const scoreColor = (s: number) => s >= 75 ? G.success : s >= 55 ? G.amber : G.danger;
                          return (
                            <tr key={task.id}>
                              <td style={{ color:G.textPrimary, fontWeight:500, maxWidth:200 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  {(task as any).tatBreached && <span style={{ fontSize:8, color:G.danger }}>⚠</span>}
                                  {(task as any).isFrozen && <span style={{ fontSize:8, color:"#b06af3" }}>🔒</span>}
                                  {task.title}
                                </div>
                              </td>
                              <td style={{ fontSize:12 }}>{getStaffName(task.assignedTo)}</td>
                              <td style={{ fontSize:11, color:"#c9a96e" }}>{(task as any).assignedBy ? getStaffName((task as any).assignedBy) : "—"}</td>
                              <td style={{ minWidth:100 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                  <div style={{ flex:1, height:5, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
                                    <div style={{ height:"100%", width:`${p}%`, background:`linear-gradient(90deg,${c},${c}88)`, borderRadius:2 }} />
                                  </div>
                                  <span style={{ fontSize:10, color:c, width:26, flexShrink:0 }}>{p}%</span>
                                </div>
                              </td>
                              <td>
                                <span className={`sa-badge sa-badge-${task.approvalStatus==="superadmin-approved"?"success":task.approvalStatus==="admin-approved"?"gold":task.approvalStatus==="rejected"?"danger":"warning"}`} style={{ fontSize:9 }}>
                                  {task.approvalStatus?.replace(/-/g," ")}
                                </span>
                              </td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:G.textMuted }}>{fmtD((task as any).createdAt)}</td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10 }}>{fmtD(task.dueDate)}</td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color: completedOn ? G.success : G.textMuted }}>{fmtD(completedOn)}</td>
                              <td style={{ textAlign:"center" }}>
                                {(task as any).scoreData ? (
                                  <span style={{ fontSize:11, fontWeight:700, color:scoreColor((task as any).scoreData.percentScore) }}>
                                    {(task as any).scoreData.percentScore}/100
                                    <span style={{ display:"block", fontSize:9, color:"#7e84a3" }}>{(task as any).scoreData.grade}</span>
                                  </span>
                                ) : <span style={{ color:"#7e84a3", fontSize:10 }}>—</span>}
                              </td>
                              <td>
                                <button className="sa-btn sa-btn-secondary" style={{ padding:"5px 10px", fontSize:10 }} onClick={()=>openTaskDetail(task)}>
                                  <Eye size={11} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── APPROVALS TAB ─────────────────────────────────────────────── */}
          {activeTab === "approvals" && (
            <div className="sa-page sa-fade-in">
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Final <em>Approvals</em></h1>
                  <p className="sa-page-sub">Tasks approved by admin — awaiting your sign-off</p>
                </div>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="sa-empty"><div className="sa-empty-icon">✓</div><div className="sa-empty-text">All tasks reviewed — nothing pending</div></div>
              ) : (
                pendingApprovals.map((task: Task, idx: number) => (
                  <div className="sa-task-card sa-fade-up" key={task.id} style={{ animationDelay:`${idx*55}ms` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                      <div style={{ flex:1 }}>
                        <div className="sa-task-title">{task.title}</div>
                        <div className="sa-task-desc">{task.description}</div>
                      </div>
                      <button className="sa-btn sa-btn-primary" style={{ flexShrink:0 }} onClick={() => openReviewModal(task)}>
                        <Eye size={14} /> Review
                      </button>
                    </div>
                    <div className="sa-task-meta">
                      <span className="sa-badge sa-badge-gold">Admin Approved</span>
                      {task.priority && <span className={priClass(task.priority)}><Flag size={10} /> {task.priority}</span>}
                      {(task as any).attachments?.length > 0 && (
                        <span className="sa-badge sa-badge-cyan">📎 {(task as any).attachments.length}</span>
                      )}
                    </div>
                  </div>
                ))
              )}

              {fullyApproved.length > 0 && (
                <>
                  <div className="sa-section-label">✓ Previously Approved ({fullyApproved.length})</div>
                  {fullyApproved.map((task: Task) => (
                    <div className="sa-task-card" key={task.id} style={{ opacity:0.55 }}>
                      <div className="sa-task-title">{task.title}</div>
                      <div style={{ marginTop:10 }}><span className="sa-badge sa-badge-success">✓ Fully Approved</span></div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── PROJECTS TAB ──────────────────────────────────────────────── */}
          {activeTab === "projects" && !selectedProject && (
            <div className="sa-page sa-fade-in">
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Project <em>Portfolio</em></h1>
                  <p className="sa-page-sub">{projects.length} project{projects.length!==1?"s":""} in the system</p>
                </div>
                <button className="sa-btn sa-btn-primary" onClick={() => setShowProjectModal(true)}>
                  <FolderPlus size={15} /> New Project
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="sa-empty">
                  <div className="sa-empty-icon">📁</div>
                  <div className="sa-empty-text">No projects yet</div>
                  <button className="sa-btn sa-btn-primary" style={{ marginTop:20 }} onClick={() => setShowProjectModal(true)}>
                    <FolderPlus size={14} /> Create First Project
                  </button>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:20 }}>
                  {projects.map((project: any, idx: number) => {
                    const projTasks = (tasks as Task[]).filter(t => t.projectId === project.id);
                    const done      = projTasks.filter(t => t.approvalStatus === "superadmin-approved").length;
                    const pending   = projTasks.filter(t => t.approvalStatus !== "superadmin-approved").length;
                    const pct       = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
                    return (
                      <div
                        className="sa-project-card sa-fade-up"
                        key={project.id}
                        style={{ animationDelay:`${idx*55}ms`, cursor:"pointer" }}
                        onClick={() => setSelectedProject(project)}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                          <div style={{ width:12, height:12, borderRadius:"50%", background:project.color||G.gold, boxShadow:`0 0 12px ${project.color||G.gold}66`, flexShrink:0 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:700, color:G.textPrimary }}>{project.name}</div>
                            {project.projectCode && <div style={{ fontSize:10, color:G.textMuted, fontFamily:"'Space Mono',monospace", marginTop:2 }}>{project.projectCode}</div>}
                          </div>
                          <span className={`sa-badge sa-badge-${project.status==="active"?"success":"gold"}`} style={{ fontSize:9 }}>{project.status||"active"}</span>
                        </div>
                        {project.description && <p style={{ fontSize:13, color:G.textSecondary, lineHeight:1.55, marginBottom:14 }}>{project.description}</p>}

                        {/* Completion bar */}
                        <div style={{ marginBottom:14 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                            <span style={{ fontSize:10, color:G.textMuted, fontWeight:700 }}>Completion</span>
                            <span style={{ fontSize:10, color: pct===100 ? G.success : G.gold, fontWeight:700 }}>{pct}%</span>
                          </div>
                          <div style={{ height:5, background:"rgba(255,255,255,0.05)", borderRadius:3, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${project.color||G.gold},${project.color||G.gold}88)`, borderRadius:3, transition:"width 0.6s ease" }} />
                          </div>
                        </div>

                        {/* Task stats row */}
                        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                          {[
                            { label:"Total",     value: projTasks.length, color: G.cyan    },
                            { label:"Done",      value: done,             color: G.success  },
                            { label:"Pending",   value: pending,          color: G.amber    },
                          ].map(s => (
                            <div key={s.label} style={{ flex:1, textAlign:"center" as const, padding:"8px 0", background:`${s.color}10`, border:`1px solid ${s.color}25`, borderRadius:8 }}>
                              <div style={{ fontSize:18, fontWeight:900, color:s.color, fontFamily:"'Oswald',sans-serif" }}>{s.value}</div>
                              <div style={{ fontSize:9, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.5px" }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ paddingTop:12, borderTop:"1px solid rgba(212,175,55,0.08)", display:"flex", flexDirection:"column" as const, gap:6 }}>
                          {project.projectType && <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:G.textMuted }}><Building2 size={13} />{project.projectType}</div>}
                          {project.location    && <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:G.textMuted }}><MapPin size={13} />{project.location}</div>}
                          {project.sqft        && <div style={{ fontSize:12, color:G.textMuted }}>📐 {project.sqft} sq.ft</div>}
                          {project.priceRange  && <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:G.textMuted }}><DollarSign size={13} />{project.priceRange}</div>}
                        </div>

                        <div style={{ marginTop:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <span style={{ fontSize:11, color:G.gold, fontWeight:600 }}>Click to view details →</span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
                              fetch(`https://adaptable-patience-production-45da.up.railway.app/api/projects/${project._id || project.id}`, { method: "DELETE" })
                                .then(r => r.json())
                                .then(() => { showSuccess(`✓ Project "${project.name}" deleted`); window.location.reload(); })
                                .catch(() => showSuccess("✕ Failed to delete project"));
                            }}
                            style={{ background:"rgba(255,59,48,0.15)", border:"1px solid rgba(255,59,48,0.3)", color:"#ff3b30", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                            🗑 Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PROJECT DRILL-DOWN ─────────────────────────────────────────── */}
          {activeTab === "projects" && selectedProject && (() => {
            const proj      = selectedProject;
            const projTasks = (tasks as Task[]).filter(t => t.projectId === proj.id);
            const done      = projTasks.filter(t => t.approvalStatus === "superadmin-approved").length;
            const pending   = projTasks.filter(t => t.approvalStatus !== "superadmin-approved").length;
            const pct       = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;

            // Per-member breakdown
            const memberMap: Record<string, { name:string; total:number; done:number; pending:number; scores:number[] }> = {};
            projTasks.forEach((t: any) => {
              if (!memberMap[t.assignedTo]) {
                memberMap[t.assignedTo] = { name: getStaffName(t.assignedTo), total:0, done:0, pending:0, scores:[] };
              }
              memberMap[t.assignedTo].total++;
              if (t.approvalStatus === "superadmin-approved") memberMap[t.assignedTo].done++;
              else memberMap[t.assignedTo].pending++;
              if (t.scoreData?.percentScore != null) memberMap[t.assignedTo].scores.push(t.scoreData.percentScore);
            });
            const memberRows = Object.values(memberMap).sort((a,b) => b.total - a.total);

            const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" }) : "—";
            const scoreColor = (s: number) => s >= 75 ? G.success : s >= 55 ? G.amber : G.danger;

            return (
              <div className="sa-page sa-fade-in">
                {/* Back button + header */}
                <div className="sa-page-header">
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <button
                      onClick={() => setSelectedProject(null)}
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"6px 12px", color:G.textMuted, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
                      ← Back
                    </button>
                    <div>
                      <h1 className="sa-page-title" style={{ marginBottom:2 }}>
                        <span style={{ color:proj.color||G.gold }}>●</span> {proj.name}
                      </h1>
                      <p className="sa-page-sub">{proj.projectCode && `${proj.projectCode} · `}{proj.projectType||""}{proj.location ? ` · ${proj.location}` : ""}</p>
                    </div>
                  </div>
                  <span className={`sa-badge sa-badge-${proj.status==="active"?"success":"gold"}`}>{proj.status||"active"}</span>
                </div>

                {/* Summary pills */}
                <div style={{ display:"flex", flexWrap:"wrap" as const, gap:12, marginBottom:28 }}>
                  {[
                    { label:"Total Tasks",   value: projTasks.length, color: G.cyan    },
                    { label:"Completed",     value: done,             color: G.success  },
                    { label:"Pending",       value: pending,          color: G.amber    },
                    { label:"Completion",    value: `${pct}%`,        color: pct===100 ? G.success : G.gold },
                    { label:"Team Members",  value: memberRows.length, color: G.purple  },
                  ].map(s => (
                    <div key={s.label} style={{ padding:"12px 20px", background:`${s.color}10`, border:`1px solid ${s.color}30`, borderRadius:12 }}>
                      <div style={{ fontSize:22, fontWeight:900, color:s.color, fontFamily:"'Oswald',sans-serif" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.6px", marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Overall progress bar */}
                <div style={{ padding:"16px 20px", background:"rgba(8,6,22,0.7)", border:"1px solid rgba(212,175,55,0.12)", borderRadius:12, marginBottom:28 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.6px" }}>Overall Completion</span>
                    <span style={{ fontSize:13, fontWeight:800, color: pct===100 ? G.success : G.gold }}>{pct}%</span>
                  </div>
                  <div style={{ height:10, background:"rgba(255,255,255,0.05)", borderRadius:5, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${proj.color||G.gold},${proj.color||G.gold}88)`, borderRadius:5, transition:"width 0.7s ease", boxShadow:`0 0 12px ${proj.color||G.gold}55` }} />
                  </div>
                </div>

                {/* ── PER-MEMBER BREAKDOWN ── */}
                {memberRows.length > 0 && (
                  <>
                    <div className="sa-section-label">👥 Team Workload Breakdown</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14, marginBottom:28 }}>
                      {memberRows.map((m, i) => {
                        const memberPct = m.total ? Math.round((m.done/m.total)*100) : 0;
                        const avgScore  = m.scores.length ? Math.round(m.scores.reduce((a,b)=>a+b,0)/m.scores.length) : null;
                        return (
                          <div key={i} style={{ padding:"16px 18px", background:"rgba(8,6,22,0.7)", border:`1px solid rgba(212,175,55,0.12)`, borderRadius:12 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:G.textPrimary }}>{m.name}</div>
                              {avgScore !== null && (
                                <span style={{ fontSize:11, fontWeight:800, color:scoreColor(avgScore), padding:"2px 8px", borderRadius:5, background:`${scoreColor(avgScore)}18`, border:`1px solid ${scoreColor(avgScore)}44` }}>
                                  Avg {avgScore}/100
                                </span>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                              {[
                                { label:"Total",   value:m.total,   color:G.cyan    },
                                { label:"Done",    value:m.done,    color:G.success  },
                                { label:"Pending", value:m.pending, color:G.amber    },
                              ].map(s => (
                                <div key={s.label} style={{ flex:1, textAlign:"center" as const, padding:"6px 0", background:`${s.color}10`, borderRadius:6 }}>
                                  <div style={{ fontSize:16, fontWeight:800, color:s.color, fontFamily:"'Oswald',sans-serif" }}>{s.value}</div>
                                  <div style={{ fontSize:8, color:G.textMuted, textTransform:"uppercase" as const }}>{s.label}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ height:4, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${memberPct}%`, background:`linear-gradient(90deg,${G.success},${G.success}88)`, borderRadius:2 }} />
                            </div>
                            <div style={{ fontSize:10, color:G.textMuted, marginTop:4, textAlign:"right" as const }}>{memberPct}% complete</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── TASK TABLE ── */}
                <div className="sa-section-label">📋 All Tasks in this Project ({projTasks.length})</div>
                {projTasks.length === 0 ? (
                  <div className="sa-empty"><div className="sa-empty-icon">📋</div><div className="sa-empty-text">No tasks for this project yet</div></div>
                ) : (
                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead><tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Assigned By</th>
                        <th>Progress</th>
                        <th>Approval</th>
                        <th>Start Date</th>
                        <th>Due Date</th>
                        <th>Completed On</th>
                        <th>Score</th>
                        <th>Action</th>
                      </tr></thead>
                      <tbody>
                        {projTasks.map((task: any) => {
                          const progressMap: Record<string,number> = {"assigned":20,"in-review":50,"admin-approved":75,"superadmin-approved":100,"rejected":10};
                          const sc: Record<string,string>          = {"assigned":G.textMuted,"in-review":G.cyan,"admin-approved":G.amber,"superadmin-approved":G.success,"rejected":G.danger};
                          const p = progressMap[task.approvalStatus] || 0;
                          const c = sc[task.approvalStatus]          || G.textMuted;
                          const completedOn = task.approvalStatus === "superadmin-approved"
                            ? (task.completedAt || task.approvedAt || task.reviewHistory?.slice(-1)[0]?.at || null)
                            : null;
                          return (
                            <tr key={task.id}>
                              <td style={{ color:G.textPrimary, fontWeight:500, maxWidth:200 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  {task.tatBreached && <span style={{ fontSize:8, color:G.danger }}>⚠</span>}
                                  {task.isFrozen    && <span style={{ fontSize:8, color:"#b06af3" }}>🔒</span>}
                                  {task.title}
                                </div>
                              </td>
                              <td style={{ fontSize:12 }}>{getStaffName(task.assignedTo)}</td>
                              <td style={{ fontSize:11, color:"#c9a96e" }}>{task.assignedBy ? getStaffName(task.assignedBy) : "—"}</td>
                              <td style={{ minWidth:90 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <div style={{ flex:1, height:5, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
                                    <div style={{ height:"100%", width:`${p}%`, background:`linear-gradient(90deg,${c},${c}88)`, borderRadius:2 }} />
                                  </div>
                                  <span style={{ fontSize:10, color:c, width:26, flexShrink:0 }}>{p}%</span>
                                </div>
                              </td>
                              <td>
                                <span className={`sa-badge sa-badge-${task.approvalStatus==="superadmin-approved"?"success":task.approvalStatus==="admin-approved"?"gold":task.approvalStatus==="rejected"?"danger":"warning"}`} style={{ fontSize:9 }}>
                                  {task.approvalStatus?.replace(/-/g," ")}
                                </span>
                              </td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:G.textMuted }}>{fmtDate(task.createdAt)}</td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10 }}>{fmtDate(task.dueDate)}</td>
                              <td style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color: completedOn ? G.success : G.textMuted }}>
                                {completedOn ? fmtDate(completedOn) : "—"}
                              </td>
                              <td style={{ textAlign:"center" as const }}>
                                {task.scoreData ? (
                                  <span style={{ fontSize:11, fontWeight:700, color:scoreColor(task.scoreData.percentScore) }}>
                                    {task.scoreData.percentScore}/100
                                    <span style={{ display:"block", fontSize:9, color:G.textMuted }}>{task.scoreData.grade}</span>
                                  </span>
                                ) : <span style={{ color:G.textMuted, fontSize:10 }}>—</span>}
                              </td>
                              <td>
                                <button className="sa-btn sa-btn-secondary" style={{ padding:"5px 10px", fontSize:10 }} onClick={() => openTaskDetail(task)}>
                                  <Eye size={11} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── USERS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div className="sa-page sa-fade-in">
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Team <em>Directory</em></h1>
                  <p className="sa-page-sub">{teamMembers.length} members across all roles</p>
                </div>
              </div>
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>OTP / Password</th><th>Mobile</th></tr>
                  </thead>
                  <tbody>
                    {[...teamMembers]
                      .sort((a:any,b:any)=>(roleOrder[a.role]??9)-(roleOrder[b.role]??9))
                      .map((member: any) => (
                        <tr key={member.id}>
                          <td style={{ color:G.textPrimary, fontWeight:500 }}>{member.name}</td>
                          <td style={{ fontFamily:"'Space Mono',monospace", fontSize:11 }}>{member.email}</td>
                          <td>
                            <span className={`sa-badge sa-badge-${member.role==="superadmin"?"gold":member.role==="admin"?"cyan":"purple"}`} style={{ textTransform:"capitalize" }}>
                              {member.role}
                            </span>
                          </td>
                          <td style={{ fontFamily:"'Space Mono',monospace", fontSize:12 }}>
                            {user?.role==="superadmin" ? DEFAULT_PASSWORDS[member.email.toLowerCase()]??member.password??"—" : "••••••"}
                          </td>
                          <td>
                            {editPhoneId === member.id ? (
                              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                <input
                                  value={editPhoneVal}
                                  onChange={e => setEditPhoneVal(e.target.value)}
                                  placeholder="+91XXXXXXXXXX"
                                  style={{ background:"rgba(8,6,20,0.8)", border:`1px solid ${G.gold}55`, borderRadius:6, padding:"5px 9px", color:G.textPrimary, fontSize:12, fontFamily:"'Space Mono',monospace", width:148, outline:"none" }}
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === "Enter") {
                                      savePhoneToBackend(member, editPhoneVal);
                                    }
                                    if (e.key === "Escape") setEditPhoneId(null);
                                  }}
                                />
                                <button
                                  onClick={() => savePhoneToBackend(member, editPhoneVal)}
                                  style={{ padding:"5px 10px", background:`${G.success}22`, border:`1px solid ${G.success}55`, borderRadius:6, color:G.success, fontSize:11, fontWeight:700, cursor:"pointer" }}>✓</button>
                                <button
                                  onClick={() => setEditPhoneId(null)}
                                  style={{ padding:"5px 8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color:G.textMuted, fontSize:11, cursor:"pointer" }}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:12, color: member.phone ? G.textSecondary : G.textMuted }}>
                                  {member.phone || "—"}
                                </span>
                                <button
                                  onClick={() => { setEditPhoneId(member.id); setEditPhoneVal(member.phone || ""); }}
                                  style={{ padding:"3px 9px", background:`${G.gold}12`, border:`1px solid ${G.gold}35`, borderRadius:5, color:G.gold, fontSize:10, fontWeight:700, cursor:"pointer", opacity:0.75 }}>
                                  {member.phone ? "Edit" : "+ Add"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ADD USER TAB ──────────────────────────────────────────────── */}
          {activeTab === "addUser" && (
            <div className="sa-page sa-fade-in">
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Add <em>Member</em></h1>
                  <p className="sa-page-sub">Onboard a new team member to the workspace</p>
                </div>
              </div>
              <div className="sa-card" style={{ maxWidth:520 }}>
                <div className="sa-form-group">
                  <label className="sa-form-label">Full Name</label>
                  <input className="sa-form-input" placeholder="e.g., Arjun Mehta" value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-form-label">Email Address</label>
                  <input className="sa-form-input" type="email" placeholder="arjun@roswalt.com" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-form-label">Mobile Number <span style={{ fontSize:10, color:G.textMuted, fontWeight:400 }}>(optional)</span></label>
                  <input className="sa-form-input" type="tel" placeholder="+91XXXXXXXXXX" value={newUser.phone} onChange={e=>setNewUser({...newUser,phone:e.target.value})} />
                </div>
                <div className="sa-form-group">
                  <label className="sa-form-label">Access Role</label>
                  <select className="sa-form-select" value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="sa-form-group">
                  <label className="sa-form-label" style={{ display:"flex", alignItems:"center", gap:8 }}>
                    Auto-generated OTP / Password
                    <span style={{ padding:"2px 8px", borderRadius:4, background:`${G.success}18`, border:`1px solid ${G.success}44`, fontSize:9, color:G.success, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px" }}>Auto</span>
                  </label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input
                      className="sa-form-input"
                      value={newUser.password}
                      onChange={e=>setNewUser({...newUser,password:e.target.value})}
                      style={{ fontFamily:"'Space Mono',monospace", letterSpacing:"2px", fontSize:15, color:G.gold, flex:1 }}
                    />
                    <button
                      type="button"
                      onClick={() => setNewUser(prev => ({ ...prev, password: (getNextOTP as any)() }))}
                      style={{ padding:"0 14px", background:`${G.gold}12`, border:`1px solid ${G.gold}35`, borderRadius:8, color:G.gold, fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ↺ Refresh
                    </button>
                  </div>
                  <div style={{ fontSize:10, color:G.textMuted, marginTop:5 }}>Generated automatically — you may override if needed.</div>
                </div>
                <button className="sa-btn sa-btn-primary" style={{ width:"100%" }} onClick={handleAddUser} disabled={!newUser.name.trim()||!newUser.email.trim()||!newUser.password.trim()}>
                  <Plus size={14} /> Add Member
                </button>
              </div>
            </div>
          )}


          {/* ── TICKET OVERSIGHT TAB ───────────────────────────────────────── */}
          {activeTab === "tickets" && (
            <div className="sa-page sa-fade-in">
              <div className="sa-page-header" style={{ marginBottom: 24 }}>
                <div>
                  <h1 className="sa-page-title">Ticket <em>Oversight</em></h1>
                  <p className="sa-page-sub">All assistance tickets · delete requests require your approval</p>
                </div>
                {deleteRequestTickets.length > 0 && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", background:"rgba(255,51,102,0.08)", border:"1px solid rgba(255,51,102,0.3)", borderRadius:10 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:"#ff3366", boxShadow:"0 0 8px #ff3366", display:"inline-block" }} />
                    <span style={{ fontSize:11, fontWeight:800, color:"#ff3366", fontFamily:"'IBM Plex Mono',monospace" }}>{deleteRequestTickets.length} DELETE REQUEST{deleteRequestTickets.length > 1 ? "S" : ""} PENDING</span>
                  </div>
                )}
              </div>

              {/* Summary cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:28 }}>
                {[
                  { label:"Total",           value:(allAssistTickets as any[]).length,                                                        color:G.cyan    },
                  { label:"Delete Requests", value:deleteRequestTickets.length,                                                                color:"#ff3366", urgent: deleteRequestTickets.length > 0 },
                  { label:"Open",            value:(allAssistTickets as any[]).filter((t:any)=>t.status==="open").length,                     color:G.amber   },
                  { label:"Pending Admin",   value:(allAssistTickets as any[]).filter((t:any)=>t.status==="pending-admin").length,            color:"#b06af3" },
                  { label:"SA Pending",      value:(allAssistTickets as any[]).filter((t:any)=>t.status==="superadmin-pending").length,       color:G.cyan    },
                  { label:"Resolved",        value:(allAssistTickets as any[]).filter((t:any)=>t.status==="resolved"||t.status==="superadmin-approved"||t.status==="admin-approved").length, color:G.success },
                ].map(c => (
                  <div key={c.label} style={{ padding:"14px 16px", background: c.urgent ? "rgba(255,51,102,0.07)" : "rgba(8,14,32,0.7)", border:`1px solid ${c.urgent ? "rgba(255,51,102,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius:12, textAlign:"center" as const }}>
                    <div style={{ fontSize:22, fontWeight:800, color:c.color, fontFamily:"'Oswald',sans-serif" }}>{c.value}</div>
                    <div style={{ fontSize:10, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.7px", marginTop:2 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" as const }}>
                {(["all","delete-request","small-activity","general-query","task-delegation"] as const).map(f => (
                  <button key={f} onClick={() => setSaTicketFilter(f)}
                    style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${saTicketFilter===f ? G.amber : "rgba(255,255,255,0.1)"}`, background: saTicketFilter===f ? "rgba(212,175,55,0.1)" : "transparent", color: saTicketFilter===f ? G.amber : G.textMuted, fontSize:11, fontWeight:700, cursor:"pointer", textTransform:"capitalize" as const }}>
                    {f === "all" ? "All Tickets" : f.replace(/-/g," ")}
                    {f === "delete-request" && deleteRequestTickets.length > 0 && (
                      <span style={{ marginLeft:6, background:"#ff3366", color:"#fff", borderRadius:"50%", padding:"1px 5px", fontSize:9, fontWeight:900 }}>{deleteRequestTickets.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Ticket list */}
              {(() => {
                const filtered = (allAssistTickets as any[]).filter((t:any) =>
                  saTicketFilter === "all" ? true : t.ticketType === saTicketFilter
                ).sort((a:any,b:any) => {
                  // Delete requests first, then by date
                  if (a.ticketType === "delete-request" && b.ticketType !== "delete-request") return -1;
                  if (b.ticketType === "delete-request" && a.ticketType !== "delete-request") return 1;
                  return new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime();
                });

                if (filtered.length === 0) return (
                  <div style={{ textAlign:"center" as const, padding:"60px 24px", background:"rgba(8,14,32,0.6)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16 }}>
                    <div style={{ fontSize:36, marginBottom:12, opacity:0.25 }}>🎫</div>
                    <div style={{ fontSize:18, fontWeight:700, color:G.textPrimary, fontFamily:"'Oswald',sans-serif" }}>No Tickets</div>
                    <div style={{ fontSize:12, color:G.textMuted, marginTop:6 }}>No assistance tickets match this filter.</div>
                  </div>
                );

                const statusColor: Record<string,string> = {
                  "open":"#ff9500","pending-admin":"#b06af3","admin-approved":"#00ff88",
                  "superadmin-pending":"#00d4ff","superadmin-approved":"#00ff88",
                  "rejected":"#ff3366","resolved":"#00d4ff",
                };
                const typeColor: Record<string,string> = {
                  "delete-request":"#ff3366","small-activity":"#ff9500",
                  "general-query":"#00d4ff","task-delegation":"#b06af3",
                };

                return (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
                    {filtered.map((ticket:any) => {
                      const isDeleteReq  = ticket.ticketType === "delete-request";
                      const isPending    = ticket.status === "superadmin-pending";
                      const raiserName   = teamMembers.find((m:any) => m.email?.toLowerCase() === ticket.assignedBy?.toLowerCase())?.name ?? ticket.raisedBy ?? ticket.assignedBy;
                      const assigneeName = teamMembers.find((m:any) => m.email?.toLowerCase() === ticket.assignedTo?.toLowerCase())?.name ?? ticket.assignedTo;
                      const linkedTask   = tasks.find((t:any) => t.id === (ticket.targetTaskId || ticket.taskId));
                      return (
                        <div key={ticket.id} onClick={() => { if (isPending || isDeleteReq) { setSelectedSaTicket(ticket); setSaTicketNote(""); setShowSaTicketModal(true); } }}
                          style={{ padding:"16px 20px", background: isPending && isDeleteReq ? "rgba(255,51,102,0.05)" : "rgba(8,14,32,0.7)", border:`1px solid ${isPending && isDeleteReq ? "rgba(255,51,102,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius:14, cursor: (isPending || isDeleteReq) ? "pointer" : "default", transition:"all 0.2s" }}>
                          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" as const }}>
                            <div style={{ flex:1, minWidth:200 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" as const }}>
                                <span style={{ fontSize:9, padding:"2px 8px", borderRadius:4, background:`${typeColor[ticket.ticketType]??G.amber}18`, color:typeColor[ticket.ticketType]??G.amber, fontWeight:800, textTransform:"uppercase" as const, border:`1px solid ${typeColor[ticket.ticketType]??G.amber}35`, fontFamily:"'IBM Plex Mono',monospace" }}>
                                  {ticket.ticketType?.replace(/-/g," ")}
                                </span>
                                <span style={{ fontSize:9, padding:"2px 8px", borderRadius:4, background:`${statusColor[ticket.status]??G.amber}18`, color:statusColor[ticket.status]??G.amber, fontWeight:700, textTransform:"uppercase" as const, border:`1px solid ${statusColor[ticket.status]??G.amber}35`, fontFamily:"'IBM Plex Mono',monospace" }}>
                                  {ticket.status?.replace(/-/g," ")}
                                </span>
                                <span style={{ fontSize:9, color:G.textMuted, fontFamily:"'IBM Plex Mono',monospace" }}>{ticket.id}</span>
                              </div>
                              <div style={{ fontSize:15, fontWeight:700, color:G.textPrimary, marginBottom:4 }}>{ticket.taskTitle}</div>
                              <div style={{ fontSize:11, color:G.textMuted, display:"flex", gap:16, flexWrap:"wrap" as const }}>
                                <span>👤 Raised by: <span style={{ color:G.textSecondary }}>{raiserName}</span></span>
                                <span>📨 Assigned to: <span style={{ color:G.textSecondary }}>{assigneeName}</span></span>
                                <span>🕐 {new Date(ticket.raisedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                              </div>
                              {ticket.reason && (
                                <div style={{ marginTop:8, fontSize:12, color:G.textSecondary, lineHeight:1.6, borderLeft:`2px solid ${typeColor[ticket.ticketType]??G.amber}44`, paddingLeft:10 }}>
                                  {ticket.reason.length > 140 ? ticket.reason.slice(0,140)+"…" : ticket.reason}
                                </div>
                              )}
                              {ticket.rejectionReason && (
                                <div style={{ marginTop:8, fontSize:11, color:"#ff3366", background:"rgba(255,51,102,0.06)", border:"1px solid rgba(255,51,102,0.2)", borderRadius:8, padding:"6px 10px" }}>
                                  ✗ Rejected: {ticket.rejectionReason}
                                </div>
                              )}
                            </div>
                            {(isPending || (isDeleteReq && ticket.status !== "superadmin-approved" && ticket.status !== "rejected")) && (
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedSaTicket(ticket); setSaTicketNote(""); setShowSaTicketModal(true); }}
                                style={{ padding:"8px 16px", background:"rgba(212,175,55,0.1)", border:"1px solid rgba(212,175,55,0.35)", borderRadius:10, color:G.amber, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
                                {isDeleteReq ? "Review Delete" : "Review"}
                              </button>
                            )}
                          </div>
                          {ticket.attachments?.length > 0 && (
                            <div style={{ marginTop:8, fontSize:10, color:G.textMuted }}>📎 {ticket.attachments.length} attachment{ticket.attachments.length > 1 ? "s" : ""}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* SA Ticket Review Modal */}
              {showSaTicketModal && selectedSaTicket && (
                <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
                  onClick={e => { if (e.target === e.currentTarget) setShowSaTicketModal(false); }}>
                  <div style={{ background:"#0d1020", border:`1px solid ${selectedSaTicket.ticketType==="delete-request" ? "rgba(255,51,102,0.4)" : "rgba(212,175,55,0.3)"}`, borderRadius:18, padding:32, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" as const }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:900, color: selectedSaTicket.ticketType==="delete-request" ? "#ff3366" : G.amber, textTransform:"uppercase" as const, letterSpacing:"1px", marginBottom:4 }}>
                          {selectedSaTicket.ticketType==="delete-request" ? "🗑 Delete Request — Superadmin Review" : "🎫 Assistance Ticket Review"}
                        </div>
                        <div style={{ fontSize:18, fontWeight:800, color:G.textPrimary, fontFamily:"'Oswald',sans-serif" }}>{selectedSaTicket.taskTitle}</div>
                      </div>
                      <button onClick={() => setShowSaTicketModal(false)} style={{ background:"none", border:"none", color:G.textMuted, cursor:"pointer", fontSize:20 }}>✕</button>
                    </div>

                    {selectedSaTicket.ticketType === "delete-request" && (
                      <div style={{ padding:"10px 14px", background:"rgba(255,51,102,0.07)", border:"1px solid rgba(255,51,102,0.25)", borderRadius:10, marginBottom:16, fontSize:11, color:"rgba(255,100,120,0.9)", lineHeight:1.7 }}>
                        ⚠ An admin has requested permanent deletion of this task. This action <strong>cannot be undone</strong>. Review the reason carefully before approving.
                      </div>
                    )}

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                      {[
                        ["Ticket ID",   selectedSaTicket.id],
                        ["Type",        selectedSaTicket.ticketType?.replace(/-/g," ")],
                        ["Raised By",   teamMembers.find((m:any)=>m.email?.toLowerCase()===selectedSaTicket.assignedBy?.toLowerCase())?.name ?? selectedSaTicket.raisedBy ?? selectedSaTicket.assignedBy],
                        ["Raised",      new Date(selectedSaTicket.raisedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})],
                      ].map(([label, val]) => (
                        <div key={label} style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10 }}>
                          <div style={{ fontSize:9, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.7px", marginBottom:4 }}>{label}</div>
                          <div style={{ fontSize:12, color:G.textPrimary, fontWeight:600, textTransform:"capitalize" as const }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {selectedSaTicket.reason && (
                      <div style={{ marginBottom:16, padding:"12px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12 }}>
                        <div style={{ fontSize:9, fontWeight:800, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.8px", marginBottom:8 }}>Reason / Description</div>
                        <div style={{ fontSize:12, color:G.textSecondary, lineHeight:1.7 }}>{selectedSaTicket.reason}</div>
                      </div>
                    )}

                    {selectedSaTicket.attachments?.length > 0 && (
                      <div style={{ marginBottom:16, padding:"10px 14px", background:"rgba(0,212,255,0.04)", border:"1px solid rgba(0,212,255,0.15)", borderRadius:10 }}>
                        <div style={{ fontSize:9, fontWeight:800, color:G.cyan, textTransform:"uppercase" as const, letterSpacing:"0.8px", marginBottom:8 }}>📎 Attachments ({selectedSaTicket.attachments.length})</div>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                          {selectedSaTicket.attachments.map((a:string, i:number) => (
                            <a key={i} href={a} target="_blank" rel="noreferrer"
                              style={{ padding:"5px 12px", background:"rgba(0,212,255,0.08)", border:"1px solid rgba(0,212,255,0.25)", borderRadius:8, color:G.cyan, fontSize:11, textDecoration:"none", fontWeight:700 }}>
                              File {i+1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom:20 }}>
                      <div style={{ fontSize:9, fontWeight:800, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.8px", marginBottom:8 }}>
                        Your Decision Note <span style={{ color:"#ff3366" }}>*</span>
                      </div>
                      <textarea value={saTicketNote} onChange={e => setSaTicketNote(e.target.value)}
                        placeholder={selectedSaTicket.ticketType === "delete-request" ? "State your reason for approving or denying this deletion…" : "Provide your feedback or instructions…"}
                        style={{ width:"100%", padding:"12px 14px", background:"rgba(255,255,255,0.04)", border:`1px solid ${G.amber}33`, borderRadius:10, color:G.textPrimary, fontSize:12, resize:"vertical" as const, outline:"none", minHeight:80, lineHeight:1.6, fontFamily:"inherit", boxSizing:"border-box" as const }}
                        onFocus={e=>e.target.style.borderColor=`${G.amber}66`}
                        onBlur={e=>e.target.style.borderColor=`${G.amber}33`}
                      />
                    </div>

                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={() => setShowSaTicketModal(false)}
                        style={{ flex:1, padding:"12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:G.textMuted, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        Cancel
                      </button>
                      <button
                        disabled={saTicketNote.trim().length < 5}
                        onClick={() => {
                          if (saTicketNote.trim().length < 5) return;
                          superadminApproveTicket(selectedSaTicket.id, false, saTicketNote.trim());
                          speakText(`Ticket ${selectedSaTicket.id} has been rejected.`);
                          showSuccess("✗ Ticket rejected");
                          setShowSaTicketModal(false); setSelectedSaTicket(null); setSaTicketNote("");
                        }}
                        style={{ flex:1, padding:"12px", background: saTicketNote.trim().length >= 5 ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.04)", border: saTicketNote.trim().length >= 5 ? "1px solid rgba(255,51,102,0.4)" : "1px solid rgba(255,255,255,0.08)", borderRadius:10, color: saTicketNote.trim().length >= 5 ? "#ff3366" : G.textMuted, fontSize:12, fontWeight:800, cursor: saTicketNote.trim().length >= 5 ? "pointer" : "not-allowed", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        ✗ Reject
                      </button>
                      <button
                        disabled={saTicketNote.trim().length < 5}
                        onClick={() => {
                          if (saTicketNote.trim().length < 5) return;
                          superadminApproveTicket(selectedSaTicket.id, true, saTicketNote.trim());
                          const msg = selectedSaTicket.ticketType === "delete-request"
                            ? `Delete request approved. Task ${selectedSaTicket.taskTitle} will be permanently deleted.`
                            : `Ticket ${selectedSaTicket.id} approved.`;
                          speakText(msg);
                          showSuccess(selectedSaTicket.ticketType === "delete-request" ? "✓ Approved — task deleted" : "✓ Ticket approved");
                          setShowSaTicketModal(false); setSelectedSaTicket(null); setSaTicketNote("");
                        }}
                        style={{ flex:2, padding:"12px", background: saTicketNote.trim().length >= 5 ? "linear-gradient(135deg,rgba(0,255,136,0.18),rgba(0,200,100,0.12))" : "rgba(255,255,255,0.04)", border: saTicketNote.trim().length >= 5 ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.08)", borderRadius:10, color: saTicketNote.trim().length >= 5 ? G.success : G.textMuted, fontSize:12, fontWeight:800, cursor: saTicketNote.trim().length >= 5 ? "pointer" : "not-allowed", fontFamily:"inherit", letterSpacing:"0.04em", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        <CheckCircle size={14} /> {selectedSaTicket.ticketType === "delete-request" ? "Approve & Delete Task" : "Approve"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ACTIVITY MONITOR TAB ──────────────────────────────────────── */}
          {activeTab === "activity" && (() => {
            // Category colours
            const catColor: Record<string, string> = {
              task: G.cyan, ticket: G.amber, project: G.magenta,
              user: "#b06af3", auth: G.textMuted, approval: G.success,
            };
            const catIcon: Record<string, string> = {
              task:"📋", ticket:"🎫", project:"📁", user:"👤", auth:"🔐", approval:"✅",
            };

            // Filter activityLog
            const filtered = (activityLog as any[]).filter((e: any) => {
              const matchCat  = activityCategory === "all" || e.category === activityCategory;
              const q = activitySearch.toLowerCase();
              const matchSearch = !q ||
                e.action?.toLowerCase().includes(q) ||
                e.actorName?.toLowerCase().includes(q) ||
                e.actorEmail?.toLowerCase().includes(q) ||
                e.targetName?.toLowerCase().includes(q);
              return matchCat && matchSearch;
            });

            const totalPages = Math.ceil(filtered.length / ACTIVITY_PAGE_SIZE);
            const pageEntries = filtered.slice(
              activityPage * ACTIVITY_PAGE_SIZE,
              (activityPage + 1) * ACTIVITY_PAGE_SIZE
            );

            // Summary counts per category
            const counts: Record<string, number> = {};
            (activityLog as any[]).forEach((e: any) => {
              counts[e.category] = (counts[e.category] ?? 0) + 1;
            });

            return (
              <div className="sa-page sa-fade-in">
                {/* Header */}
                <div className="sa-page-header" style={{ marginBottom: 24 }}>
                  <div>
                    <h1 className="sa-page-title">Activity <em>Monitor</em></h1>
                    <p className="sa-page-sub">Complete portal audit trail · {(activityLog as any[]).length} total events</p>
                  </div>
                  <button
                    onClick={() => { if (window.confirm("Clear all activity logs? This cannot be undone.")) { fetch("https://adaptable-patience-production-45da.up.railway.app/api/activity", { method: "DELETE" }).then(() => window.location.reload()); } }}
                    style={{ padding:"8px 16px", background:"rgba(255,51,102,0.08)", border:"1px solid rgba(255,51,102,0.25)", borderRadius:10, color:"#ff3366", fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                    <Trash2 size={12} /> Clear Log
                  </button>
                </div>

                {/* Summary cards */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:10, marginBottom:24 }}>
                  {(["task","ticket","approval","project","user","auth"] as const).map(cat => (
                    <div key={cat} onClick={() => { setActivityCategory(cat); setActivityPage(0); }}
                      style={{ padding:"12px 14px", background: activityCategory === cat ? `${catColor[cat]}12` : "rgba(8,14,32,0.7)", border:`1px solid ${activityCategory === cat ? catColor[cat]+"44" : "rgba(255,255,255,0.07)"}`, borderRadius:12, cursor:"pointer", textAlign:"center" as const, transition:"all 0.2s" }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{catIcon[cat]}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:catColor[cat], fontFamily:"'Oswald',sans-serif" }}>{counts[cat] ?? 0}</div>
                      <div style={{ fontSize:9, color:G.textMuted, textTransform:"capitalize" as const, letterSpacing:"0.7px", marginTop:2 }}>{cat}</div>
                    </div>
                  ))}
                </div>

                {/* Search + filter bar */}
                <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" as const, alignItems:"center" }}>
                  <div style={{ flex:1, minWidth:200, position:"relative" as const }}>
                    <Search size={13} style={{ position:"absolute" as const, left:12, top:"50%", transform:"translateY(-50%)", color:G.textMuted, pointerEvents:"none" as const }} />
                    <input
                      value={activitySearch}
                      onChange={e => { setActivitySearch(e.target.value); setActivityPage(0); }}
                      placeholder="Search by action, name, task…"
                      style={{ width:"100%", padding:"9px 14px 9px 34px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:G.textPrimary, fontSize:12, outline:"none", boxSizing:"border-box" as const }}
                    />
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
                    {(["all","task","ticket","approval","project","user","auth"] as const).map(cat => (
                      <button key={cat} onClick={() => { setActivityCategory(cat); setActivityPage(0); }}
                        style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${activityCategory===cat ? (catColor[cat]??G.amber) : "rgba(255,255,255,0.1)"}`, background: activityCategory===cat ? `${catColor[cat]??G.amber}15` : "transparent", color: activityCategory===cat ? (catColor[cat]??G.amber) : G.textMuted, fontSize:10, fontWeight:700, cursor:"pointer", textTransform:"capitalize" as const }}>
                        {cat === "all" ? "All" : catIcon[cat] + " " + cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activity feed */}
                {pageEntries.length === 0 ? (
                  <div style={{ textAlign:"center" as const, padding:"60px 24px", background:"rgba(8,14,32,0.6)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16 }}>
                    <div style={{ fontSize:36, marginBottom:12, opacity:0.2 }}>📋</div>
                    <div style={{ fontSize:18, fontWeight:700, color:G.textPrimary, fontFamily:"'Oswald',sans-serif" }}>No Activity</div>
                    <div style={{ fontSize:12, color:G.textMuted, marginTop:6 }}>
                      {activitySearch || activityCategory !== "all" ? "No events match your filter." : "Activity will appear here as the team uses the portal."}
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:6 }}>
                    {pageEntries.map((entry: any, idx: number) => {
                      const color = catColor[entry.category] ?? G.textMuted;
                      const icon  = catIcon[entry.category]  ?? "📋";
                      const ts    = new Date(entry.timestamp);
                      const timeStr = ts.toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
                      return (
                        <div key={entry.id ?? idx} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"12px 16px", background:"rgba(8,14,32,0.65)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, transition:"background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(8,14,32,0.65)")}>
                          {/* Category dot + icon */}
                          <div style={{ flexShrink:0, width:32, height:32, borderRadius:"50%", background:`${color}15`, border:`1px solid ${color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, marginTop:1 }}>
                            {icon}
                          </div>
                          {/* Content */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const, marginBottom:3 }}>
                              <span style={{ fontSize:13, fontWeight:700, color:G.textPrimary }}>{entry.action}</span>
                              <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:`${color}15`, color, fontWeight:700, textTransform:"uppercase" as const, border:`1px solid ${color}30`, fontFamily:"'IBM Plex Mono',monospace" }}>
                                {entry.category}
                              </span>
                            </div>
                            <div style={{ display:"flex", gap:12, flexWrap:"wrap" as const, fontSize:11, color:G.textMuted }}>
                              <span>👤 <span style={{ color:G.textSecondary }}>{entry.actorName || entry.actorEmail || "System"}</span></span>
                              {entry.targetName && <span>🎯 <span style={{ color:G.textSecondary }}>{entry.targetName}</span></span>}
                              {entry.meta?.assignedTo && <span>→ <span style={{ color:G.textSecondary }}>{entry.meta.assignedTo}</span></span>}
                            </div>
                            {entry.meta && Object.keys(entry.meta).filter(k => k !== "assignedTo").length > 0 && (
                              <div style={{ marginTop:4, display:"flex", gap:8, flexWrap:"wrap" as const }}>
                                {Object.entries(entry.meta).filter(([k]) => k !== "assignedTo" && entry.meta[k]).map(([k, v]) => (
                                  <span key={k} style={{ fontSize:9, padding:"1px 6px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:4, color:G.textMuted, fontFamily:"'IBM Plex Mono',monospace" }}>
                                    {k}: {String(v).slice(0, 40)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Timestamp */}
                          <div style={{ flexShrink:0, fontSize:10, color:G.textMuted, fontFamily:"'IBM Plex Mono',monospace", marginTop:2, textAlign:"right" as const }}>
                            {timeStr}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginTop:20 }}>
                    <button onClick={() => setActivityPage(p => Math.max(0, p-1))} disabled={activityPage === 0}
                      style={{ padding:"7px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color: activityPage === 0 ? G.textMuted : G.textPrimary, fontSize:12, fontWeight:700, cursor: activityPage === 0 ? "not-allowed" : "pointer" }}>
                      ← Prev
                    </button>
                    <span style={{ fontSize:11, color:G.textMuted, fontFamily:"'IBM Plex Mono',monospace" }}>
                      Page {activityPage + 1} / {totalPages} · {filtered.length} events
                    </span>
                    <button onClick={() => setActivityPage(p => Math.min(totalPages-1, p+1))} disabled={activityPage >= totalPages-1}
                      style={{ padding:"7px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color: activityPage >= totalPages-1 ? G.textMuted : G.textPrimary, fontSize:12, fontWeight:700, cursor: activityPage >= totalPages-1 ? "not-allowed" : "pointer" }}>
                      Next →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── CLAUDE AI TAB ─────────────────────────────────────────────── */}
          {activeTab === "ai" && (
            <div className="sa-page sa-fade-in">
              <div className="sa-page-header">
                <div>
                  <h1 className="sa-page-title">Claude <em>AI</em></h1>
                  <p className="sa-page-sub">Your AI assistant for workspace management</p>
                </div>
              </div>
              <div style={{ height:"calc(100vh - 240px)", background:"rgba(4,6,18,0.8)", borderRadius:16, border:"1px solid rgba(212,175,55,0.15)", overflow:"hidden", backdropFilter:"blur(10px)" }}>
                <ClaudeChat theme="amber" />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: CREATE TASK ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="sa-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowCreateModal(false); }}>
          <div className="sa-modal">
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-sub">Assign New Task</div>
                <div className="sa-modal-title">Create & Assign Task</div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowCreateModal(false)}><X size={17} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-grid-2">
                <div className="sa-grid-full">
                  <div className="sa-form-group">
                    <label className="sa-form-label">Task Title *</label>
                    <input className="sa-form-input" value={newTask.title} onChange={e=>setNewTask({...newTask,title:e.target.value})} placeholder="e.g., Redesign onboarding flow" />
                  </div>
                </div>
                <div className="sa-grid-full">
                  <div className="sa-form-group">
                    <label className="sa-form-label">Assign to *</label>
                    <select className="sa-form-select" value={newTask.assignedTo} onChange={e=>setNewTask({...newTask,assignedTo:e.target.value})}>
                      <option value="">Select a person...</option>
                      {assignableAdmins.length > 0 && (
                        <optgroup label="── ADMINS ──">
                          {assignableAdmins.map((m: any) => <option key={m.id} value={m.email}>{m.name}</option>)}
                        </optgroup>
                      )}
                      {assignableStaff.length > 0 && (
                        <optgroup label="── STAFF ──">
                          {assignableStaff.map((m: any) => <option key={m.id} value={m.email}>{m.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Due Date *</label>
                    <input className="sa-form-input" type="date" value={newTask.dueDate} onChange={e=>setNewTask({...newTask,dueDate:e.target.value})} style={{ colorScheme:"dark" }} />
                  </div>
                </div>
                <div>
                  <div className="sa-form-group">
                    <label className="sa-form-label">Priority</label>
                    <select className="sa-form-select" value={newTask.priority} onChange={e=>setNewTask({...newTask,priority:e.target.value as any})}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="sa-grid-full">
                  <div className="sa-form-group">
                    <label className="sa-form-label">Project *</label>
                    {activeProjects.length === 0 ? (
                      <div style={{ padding:"12px 14px", background:"rgba(245,158,11,0.08)", border:"1px solid var(--sa-amber)", borderRadius:9, color:"var(--sa-amber)", fontSize:13 }}>⚠ No active projects. Create one first.</div>
                    ) : (
                      <select className="sa-form-select" value={newTask.projectId} onChange={e=>setNewTask({...newTask,projectId:e.target.value})}>
                        <option value="">— Select a project —</option>
                        {activeProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.projectCode?` · ${p.projectCode}`:""}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div className="sa-grid-full">
                  <div className="sa-form-group">
                    <label className="sa-form-label">Description *</label>
                    <textarea className="sa-form-textarea" value={newTask.description} onChange={e=>setNewTask({...newTask,description:e.target.value})} placeholder="Detailed description of the task…" />
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:8 }}>
                <button className="sa-btn sa-btn-primary" onClick={handleCreateTask} style={{ flex:1 }}><CheckCircle size={14} /> Assign Task</button>
                <button className="sa-btn sa-btn-secondary" onClick={()=>setShowCreateModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE PROJECT ─────────────────────────────────────────── */}
      {showProjectModal && (
        <div className="sa-overlay" onClick={e=>{ if(e.target===e.currentTarget) setShowProjectModal(false); }}>
          <div className="sa-modal">
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-sub">New Project</div>
                <div className="sa-modal-title">Create Project</div>
              </div>
              <button className="sa-modal-close" onClick={()=>setShowProjectModal(false)}><X size={17} /></button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-grid-2">
                <div className="sa-grid-full"><div className="sa-form-group"><label className="sa-form-label">Project Name *</label><input className="sa-form-input" value={newProject.name} onChange={e=>setNewProject({...newProject,name:e.target.value})} placeholder="e.g., Skyline Residences" /></div></div>
                <div><div className="sa-form-group"><label className="sa-form-label">Project Code</label><input className="sa-form-input" value={newProject.projectCode} onChange={e=>setNewProject({...newProject,projectCode:e.target.value.toUpperCase()})} placeholder="e.g., SKY-001" maxLength={10} /></div></div>
                <div><div className="sa-form-group"><label className="sa-form-label">Type</label><select className="sa-form-select" value={newProject.projectType} onChange={e=>setNewProject({...newProject,projectType:e.target.value})}>{PROJECT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div></div>
                <div className="sa-grid-full"><div className="sa-form-group"><label className="sa-form-label">Location</label><input className="sa-form-input" value={newProject.location} onChange={e=>setNewProject({...newProject,location:e.target.value})} placeholder="e.g., Bandra West, Mumbai" /></div></div>
                <div className="sa-grid-full"><div className="sa-form-group"><label className="sa-form-label">Full Address</label><textarea className="sa-form-textarea" value={newProject.address} onChange={e=>setNewProject({...newProject,address:e.target.value})} placeholder="Complete address" /></div></div>
                <div><div className="sa-form-group"><label className="sa-form-label">Total Sq.ft</label><input className="sa-form-input" value={newProject.sqft} onChange={e=>setNewProject({...newProject,sqft:e.target.value})} placeholder="e.g., 150,000" /></div></div>
                <div><div className="sa-form-group"><label className="sa-form-label">Launch Date</label><input className="sa-form-input" type="date" value={newProject.launchDate} onChange={e=>setNewProject({...newProject,launchDate:e.target.value})} style={{ colorScheme:"dark" }} /></div></div>
                <div><div className="sa-form-group"><label className="sa-form-label">Price Range</label><input className="sa-form-input" value={newProject.priceRange} onChange={e=>setNewProject({...newProject,priceRange:e.target.value})} placeholder="e.g., ₹2.5Cr - ₹5Cr" /></div></div>
                <div><div className="sa-form-group"><label className="sa-form-label">Inventory</label><input className="sa-form-input" value={newProject.inventory} onChange={e=>setNewProject({...newProject,inventory:e.target.value})} placeholder="e.g., 120 units" /></div></div>
                <div className="sa-grid-full"><div className="sa-form-group"><label className="sa-form-label">USP</label><textarea className="sa-form-textarea" value={newProject.usp} onChange={e=>setNewProject({...newProject,usp:e.target.value})} placeholder="Unique selling points..." /></div></div>
                <div className="sa-grid-full"><div className="sa-form-group"><label className="sa-form-label">Target Audience</label><input className="sa-form-input" value={newProject.targetAudience} onChange={e=>setNewProject({...newProject,targetAudience:e.target.value})} placeholder="e.g., Young professionals, Luxury buyers" /></div></div>
                <div className="sa-grid-full"><div className="sa-form-group"><label className="sa-form-label">Description</label><textarea className="sa-form-textarea" value={newProject.description} onChange={e=>setNewProject({...newProject,description:e.target.value})} placeholder="Brief project description…" /></div></div>
                <div className="sa-grid-full">
                  <div className="sa-form-group">
                    <label className="sa-form-label">Project Colour</label>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      {PROJECT_COLORS.map(color => (
                        <button key={color} style={{ width:36, height:36, borderRadius:"50%", background:color, border:newProject.color===color?"3px solid #fff":"2px solid transparent", cursor:"pointer", transition:"all 0.2s", boxShadow:newProject.color===color?`0 0 14px ${color}`:"none" }} onClick={()=>setNewProject({...newProject,color})} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:8 }}>
                <button className="sa-btn sa-btn-primary" onClick={handleCreateProject} disabled={!newProject.name.trim()} style={{ flex:1 }}><FolderPlus size={14} /> Create Project</button>
                <button className="sa-btn sa-btn-secondary" onClick={()=>setShowProjectModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REVIEW TASK ─────────────────────────────────────────────── */}
      {showReviewModal && selectedTask && (
        <div className="sa-overlay" onClick={e=>{ if(e.target===e.currentTarget){setShowReviewModal(false);setSelectedTask(null);setReviewComments("");setAiReviewResults(null);} }}>
          <div className="sa-modal">
            <div className="sa-modal-header">
              <div>
                <div className="sa-modal-sub">Task Review</div>
                <div className="sa-modal-title">{selectedTask.title}</div>
              </div>
              <button className="sa-modal-close" onClick={()=>{setShowReviewModal(false);setSelectedTask(null);setReviewComments("");setAiReviewResults(null);}}><X size={17} /></button>
            </div>
            <div className="sa-modal-body">
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:20 }}>
                <span className={`sa-badge sa-badge-${selectedTask.priority==="high"?"danger":selectedTask.priority==="low"?"success":"warning"}`}>
                  <Flag size={11} /> {selectedTask.priority}
                </span>
                <span className="sa-badge sa-badge-gold"><User size={11} /> {getStaffName(selectedTask.assignedTo)}</span>
                <span className="sa-badge sa-badge-cyan"><Calendar size={11} /> Due {new Date(selectedTask.dueDate).toLocaleDateString()}</span>
              </div>

              <div style={{ padding:"14px 18px", background:"rgba(4,6,18,0.85)", border:"1px solid rgba(212,175,55,0.12)", borderRadius:10, marginBottom:20, fontSize:13, color:G.textSecondary, lineHeight:1.65 }}>
                {selectedTask.description}
              </div>

              {(selectedTask as any).attachments?.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <label className="sa-form-label">Attachments ({(selectedTask as any).attachments.length})</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                    {(selectedTask as any).attachments.map((url: string, i: number) => (
                      <div key={i} onClick={()=>openLightbox((selectedTask as any).attachments,i)}
                        style={{ width:96, height:96, borderRadius:10, overflow:"hidden", border:"1px solid rgba(212,175,55,0.2)", cursor:"pointer", background:"rgba(4,6,18,0.8)" }}>
                        <img src={url} alt={`att-${i}`} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="sa-form-group">
                <label className="sa-form-label">Your Review Notes</label>
                <textarea className="sa-form-textarea" value={reviewComments} onChange={e=>setReviewComments(e.target.value)} placeholder="Feedback or reason for rejection…" />
              </div>

              <div style={{ display:"flex", gap:12 }}>
                <button className="sa-btn sa-btn-success" onClick={()=>handleApprove(selectedTask.id)} style={{ flex:1 }}><CheckCircle size={14} /> Approve</button>
                <button className="sa-btn sa-btn-danger" onClick={()=>handleReject(selectedTask.id)} style={{ flex:1 }}><RotateCw size={14} /> Send Back</button>
                <button className="sa-btn sa-btn-secondary" onClick={()=>{setShowReviewModal(false);setSelectedTask(null);setReviewComments("");}}>
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── MODAL: TASK DETAIL (full lifecycle) ───────────────────────────── */}
      {showTaskDetail && detailTask && (() => {
        const attachments = (detailTask as any).attachments || [];
        const history     = (detailTask as any).activityLog || (detailTask as any).history || [];
        const reviewHist  = (detailTask as any).reviewHistory || [];
        const isFrozen    = (detailTask as any).isFrozen;
        const isTat       = (detailTask as any).tatBreached;
        const proj        = (projects as any[]).find((p:any)=>p.id===detailTask.projectId);
        const progressMap: Record<string,number> = {
          "assigned":20,"in-review":50,"admin-approved":75,"superadmin-approved":100,"rejected":10
        };
        const statusColor: Record<string,string> = {
          "assigned":G.textMuted,"in-review":G.cyan,"admin-approved":G.amber,
          "superadmin-approved":G.success,"rejected":G.danger,
        };
        const progress = progressMap[detailTask.approvalStatus] || 0;
        const sc = statusColor[detailTask.approvalStatus] || G.textMuted;
        return (
          <div className="sa-overlay" onClick={e=>{if(e.target===e.currentTarget){setShowTaskDetail(false);setDetailTask(null);}}}>
            <div className="sa-modal" style={{ maxWidth:720, maxHeight:"90vh", overflowY:"auto" }}>
              <div className="sa-modal-header">
                <div>
                  <div className="sa-modal-sub">Task Lifecycle — Full View</div>
                  <div className="sa-modal-title">{detailTask.title}</div>
                </div>
                <button className="sa-modal-close" onClick={()=>{setShowTaskDetail(false);setDetailTask(null);}}><X size={17} /></button>
              </div>
              <div className="sa-modal-body">
                {/* Status + progress */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:sc, textTransform:"uppercase" as const, letterSpacing:"0.6px" }}>
                      {detailTask.approvalStatus?.replace(/-/g," ")} · {progress}% complete
                    </span>
                    <div style={{ display:"flex", gap:8 }}>
                      {isFrozen && <span style={{ fontSize:9, padding:"3px 9px", borderRadius:4, background:"#b06af322", color:"#b06af3", border:"1px solid #b06af355", fontWeight:700 }}>🔒 FROZEN</span>}
                      {isTat    && <span style={{ fontSize:9, padding:"3px 9px", borderRadius:4, background:`${G.danger}18`, color:G.danger, border:`1px solid ${G.danger}44`, fontWeight:700 }}>⚠ TAT BREACH</span>}
                    </div>
                  </div>
                  <div style={{ height:8, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${sc},${sc}88)`, borderRadius:4, boxShadow:`0 0 12px ${sc}55`, transition:"width 0.7s ease" }} />
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display:"flex", flexWrap:"wrap" as const, gap:8, marginBottom:20 }}>
                  <span className="sa-badge sa-badge-purple"><User size={11} /> {getStaffName(detailTask.assignedTo)}</span>
                  {detailTask.priority && <span className={priClass(detailTask.priority)}><Flag size={11} /> {detailTask.priority}</span>}
                  <span className="sa-badge sa-badge-cyan"><Calendar size={11} /> Due {detailTask.dueDate ? new Date(detailTask.dueDate).toLocaleDateString() : "—"}</span>
                  {proj && <span className="sa-badge sa-badge-gold">📁 {proj.name}</span>}
                  {(detailTask as any).assignedBy && <span className="sa-badge" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:G.textMuted, fontSize:10 }}>📤 by {getStaffName((detailTask as any).assignedBy)}</span>}
                </div>

                {/* Description */}
                <div style={{ padding:"14px 18px", background:"rgba(4,6,18,0.7)", border:"1px solid rgba(212,175,55,0.12)", borderRadius:10, marginBottom:20, fontSize:13, color:G.textSecondary, lineHeight:1.65 }}>
                  {detailTask.description || "No description provided."}
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.8px", marginBottom:10 }}>
                      📎 Attachments ({attachments.length})
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap" as const, gap:10 }}>
                      {attachments.map((url: string, i: number) => (
                        <div key={i} onClick={()=>openLightbox(attachments,i)}
                          style={{ width:88, height:88, borderRadius:10, overflow:"hidden", border:"1px solid rgba(212,175,55,0.2)", cursor:"pointer", background:"rgba(4,6,18,0.8)" }}>
                          <img src={url} alt={`att-${i}`} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review history */}
                {reviewHist.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.8px", marginBottom:10 }}>
                      🔍 Review History
                    </div>
                    <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                      {reviewHist.map((r: any, i: number) => (
                        <div key={i} style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ fontSize:11, fontWeight:600, color: r.action==="approved"?G.success:r.action==="rejected"?G.danger:G.amber }}>
                              {r.action === "approved" ? "✓ Approved" : r.action === "rejected" ? "✕ Rejected" : "📝 Reviewed"}
                            </span>
                            <span style={{ fontSize:10, color:G.textMuted }}>{r.by || "—"} · {r.at ? new Date(r.at).toLocaleString() : ""}</span>
                          </div>
                          {r.comment && <div style={{ fontSize:12, color:G.textSecondary }}>{r.comment}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity log */}
                {history.length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:G.textMuted, textTransform:"uppercase" as const, letterSpacing:"0.8px", marginBottom:10 }}>
                      🕐 Activity Log
                    </div>
                    <div style={{ display:"flex", flexDirection:"column" as const, gap:6, maxHeight:200, overflowY:"auto" }}>
                      {history.slice().reverse().map((h: any, i: number) => (
                        <div key={i} style={{ display:"flex", gap:10, padding:"9px 12px", background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:7 }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:G.gold, flexShrink:0, marginTop:4 }} />
                          <div>
                            <div style={{ fontSize:12, color:G.textSecondary }}>{h.action || h.event || h.text || JSON.stringify(h)}</div>
                            {h.timestamp && <div style={{ fontSize:10, color:G.textMuted, marginTop:2 }}>{new Date(h.timestamp).toLocaleString()}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display:"flex", gap:10, marginTop:8 }}>
                  {detailTask.approvalStatus === "admin-approved" && (
                    <>
                      <button className="sa-btn sa-btn-success" style={{ flex:1 }} onClick={()=>{setShowTaskDetail(false);openReviewModal(detailTask);}}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button className="sa-btn sa-btn-danger" style={{ flex:1 }} onClick={()=>{setShowTaskDetail(false);openReviewModal(detailTask);}}>
                        <RotateCw size={14} /> Send Back
                      </button>
                    </>
                  )}
                  <button className="sa-btn sa-btn-secondary" onClick={()=>{setShowTaskDetail(false);setDetailTask(null);}}><X size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LIGHTBOX ──────────────────────────────────────────────────────── */}
      {showLightbox && lightboxPhotos.length > 0 && (
        <div className="sa-lightbox" onClick={()=>setShowLightbox(false)}>
          <button className="sa-lightbox-close" onClick={()=>setShowLightbox(false)}>✕</button>
          <button className="sa-lightbox-nav prev" onClick={e=>{e.stopPropagation();setLightboxIndex(i=>Math.max(i-1,0));}} disabled={lightboxIndex===0}>‹</button>
          <img src={lightboxPhotos[lightboxIndex]} alt={`attachment-${lightboxIndex+1}`} className="sa-lightbox-img" onClick={e=>e.stopPropagation()} />
          <button className="sa-lightbox-nav next" onClick={e=>{e.stopPropagation();setLightboxIndex(i=>Math.min(i+1,lightboxPhotos.length-1));}} disabled={lightboxIndex===lightboxPhotos.length-1}>›</button>
          {lightboxPhotos.length > 1 && <div className="sa-lightbox-count">{lightboxIndex+1} / {lightboxPhotos.length}</div>}
        </div>
      )}
    </>
  );
};

export default SADashboard;











