import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import {
  Plus, Upload, LogOut, CheckCircle, Eye, X,
  Zap, User, ChevronRight, Calendar, Flag,
  FileText, MessageSquare, Shield, Sparkles, Loader,
  TrendingUp, Clock, Activity, BarChart3,
  GitBranch, ListTree,
  AlertTriangle, History, Radio, Share2, RotateCw,
} from "lucide-react";
import ClaudeChat from "./ClaudeChat";
import HistoryTimeline from "./Historytimeline";
import SmartAssistModal from "./Smartassistmodal";
import ProgressTracker from "./Progresstracker";

// Suppress unused import warnings for icons kept for design consistency
void Sparkles; void RotateCw; void Radio;

// ── ForwardedTaskTree — graceful stub if missing ──────────────────────────────
let ForwardedTaskTree: React.FC<{
  tasks: Task[];
  getNameFn: (e: string) => string;
  isAdminFn: (e: string) => boolean;
  onSelectTask: (t: Task) => void;
}>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ForwardedTaskTree = require("./ForwardedTaskTree").default;
} catch {
  ForwardedTaskTree = () => (
    <div style={{ color: "#8a7355", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: 24 }}>
      ForwardedTaskTree component not found.
    </div>
  );
}

// ── TAT / SmartAssist service shims ──────────────────────────────────────────
// These lazy-require the real modules at runtime; if they're missing the
// inline fallbacks are used so the dashboard still compiles & runs.

import type { SmartAssistTicket } from "../services/SmartAssistService";
import type { TATTask } from "../services/TATEngine";

function computeExactDeadline(dueDate: string, timeSlot: string): string {
  if (!dueDate) return "";
  const d = new Date(dueDate + "T00:00:00");
  if (timeSlot === "AM") d.setHours(9, 0, 0, 0);
  else if (timeSlot === "Noon") d.setHours(12, 0, 0, 0);
  else d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function loadTickets(): SmartAssistTicket[] {
  try { return require("../services/SmartAssistService").loadTickets(); } catch { return []; }
}
function mergeTickets(prev: SmartAssistTicket[], next: SmartAssistTicket[]): SmartAssistTicket[] {
  try { return require("../services/SmartAssistService").mergeTickets(prev, next); }
  catch { return [...prev, ...next]; }
}
function resolveTicket(tickets: SmartAssistTicket[], taskId: string): SmartAssistTicket[] {
  try { return require("../services/SmartAssistService").resolveTicket(tickets, taskId); }
  catch { return tickets.filter((t) => t.taskId !== taskId); }
}
function submitRevision(
  tickets: SmartAssistTicket[],
  taskId: string,
  data: { revisedDate: string; revisedTimeSlot: string; delayReason: string }
): SmartAssistTicket[] {
  try { return require("../services/SmartAssistService").submitRevision(tickets, taskId, data); }
  catch { return tickets; }
}
function countActiveTickets(tickets: SmartAssistTicket[]): number {
  try { return require("../services/SmartAssistService").countActiveTickets(tickets); }
  catch { return tickets.filter((t) => t.status === "open").length; }
}
function getTicketForTask(tickets: SmartAssistTicket[], taskId: string): SmartAssistTicket | undefined {
  try { return require("../services/SmartAssistService").getTicketForTask(tickets, taskId); }
  catch { return tickets.find((t) => t.taskId === taskId); }
}
function startTATMonitor(
  getTasksFn: () => TATTask[],
  getNameFn: (e: string) => string,
  cb: (tasks: TATTask[], tickets: SmartAssistTicket[]) => void,
  interval: number
): () => void {
  try { return require("../services/TATEngine").startTATMonitor(getTasksFn, getNameFn, cb, interval); }
  catch { return () => {}; }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  by: string;
  to?: string;
  notes?: string;
}

interface AIReviewResult {
  image: number;
  status: "CLEAN" | "MINOR" | "ERROR";
  issues: string[];
  recommendations: string;
}

interface AIReviewResults {
  results: AIReviewResult[];
  hasErrors: boolean;
  timestamp: string;
}

// Extends the context Task type with the extra fields used by the dashboard
interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: "high" | "medium" | "low";
  approvalStatus:
    | "assigned"
    | "rejected"
    | "in-review"
    | "admin-approved"
    | "superadmin-approved"
    | "in-progress"
    | "completed"
    | "pending";
  dueDate: string;
  assignedTo: string;
  assignedBy?: string;
  projectId?: string;
  timeSlot?: string;
  exactDeadline?: string;
  history?: HistoryEntry[];
  completionNotes?: string;
  adminComments?: string;
  attachments?: string[];
  tatBreached?: boolean;
  smartAssist?: { delayDuration?: string; reminderCount?: number };
  completedAt?: string;
  createdAt?: string;
  forwardedFrom?: string;
}

type TeamMember = { id: string; name: string; email: string; role: string };
type Project    = { id: string; name: string; status?: string; projectCode?: string };

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  bg:           "#080600", bgDeep:"#050400", surface:"#0f0d08",
  surfaceMid:   "#171308", surfaceHigh:"#211a0a",
  gold:         "#c9a96e", goldBright:"#e8c84a",
  goldDim:      "rgba(201,169,110,0.15)", goldGlow:"rgba(201,169,110,0.25)",
  goldBorder:   "rgba(201,169,110,0.2)",  goldBorderHi:"rgba(201,169,110,0.45)",
  border:       "rgba(201,169,110,0.1)",  borderHi:"rgba(201,169,110,0.22)",
  success:      "#6ee7b7", successDim:"rgba(110,231,183,0.12)", successBorder:"rgba(110,231,183,0.25)",
  danger:       "#f87171", dangerDim:"rgba(248,113,113,0.12)",  dangerBorder:"rgba(248,113,113,0.25)",
  amber:        "#f59e0b", amberDim:"rgba(245,158,11,0.12)",
  textPrimary:  "#f0e6d3", textSecondary:"#8a7355", textMuted:"#4a3f2a",
  purple:       "#a78bfa", purpleDim:"rgba(167,139,250,0.12)",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${G.bg}; color: ${G.textPrimary}; font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${G.textMuted}; border-radius: 99px; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes scaleIn  { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
  @keyframes shimmer  { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
  @keyframes spin     { to { transform:rotate(360deg); } }
  @keyframes progressBar { 0%{width:0%} 50%{width:100%} 100%{width:0%} }
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes tatPulse { 0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,0.4);} 50%{box-shadow:0 0 0 6px rgba(248,113,113,0);} }
  .fade-up  { animation: fadeUp  0.5s ease both; }
  .fade-in  { animation: fadeIn  0.35s ease both; }
  .scale-in { animation: scaleIn 0.3s  ease both; }
  .spin     { animation: spin 1s linear infinite; }
  .shimmer  { animation: shimmer 2s ease infinite; }
  .pulse    { animation: pulse 2s ease infinite; }
  .tat-pulse{ animation: tatPulse 2s ease infinite; }
  input:focus, textarea:focus, select:focus { outline: none; }
  input::placeholder, textarea::placeholder { color: ${G.textMuted}; }
  select option { background: ${G.surfaceMid}; color: ${G.textPrimary}; }
  optgroup { color: ${G.textSecondary}; font-family: 'DM Sans', sans-serif; font-size: 11px; }
  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8) brightness(1.2) hue-rotate(200deg); cursor: pointer; opacity: 0.85; }
  input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
  .g-btn-gold { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #c9a96e 0%, #e8c84a 60%, #c9a96e 100%); color: #000; font-weight:700; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; border:none; border-radius:8px; font-family:'DM Sans',sans-serif; cursor:pointer; transition: all 0.2s ease; box-shadow: 0 2px 16px rgba(201,169,110,0.3); }
  .g-btn-gold:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 28px rgba(201,169,110,0.45); }
  .g-btn-gold:disabled { opacity:0.45; cursor:not-allowed; }
  .g-btn-ghost { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: ${G.surfaceHigh}; color: ${G.textPrimary}; border: 1px solid ${G.border}; border-radius:8px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition: all 0.2s ease; }
  .g-btn-ghost:hover { border-color:${G.borderHi}; background:${G.surfaceMid}; }
  .g-btn-success { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #059669, #34d399); color:#fff; border:none; border-radius:8px; font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s ease; }
  .g-btn-success:hover { transform:translateY(-1px); }
  .g-btn-danger { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #dc2626, #f87171); color:#fff; border:none; border-radius:8px; font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s ease; }
  .g-btn-danger:hover { transform:translateY(-1px); }
  .g-btn-ai { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 16px; background: rgba(232,200,74,0.08); color:${G.goldBright}; border: 1px solid rgba(232,200,74,0.25); border-radius:8px; font-family:'DM Mono',monospace; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
  .g-btn-ai:hover:not(:disabled) { background:rgba(232,200,74,0.15); border-color:rgba(232,200,74,0.5); transform:translateY(-1px); }
  .g-btn-ai:disabled { opacity:0.4; cursor:not-allowed; }
  .g-btn-review-att { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 16px; background: rgba(110,231,183,0.08); color:${G.success}; border: 1px solid rgba(110,231,183,0.25); border-radius:8px; font-family:'DM Mono',monospace; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
  .g-btn-review-att:hover:not(:disabled) { background:rgba(110,231,183,0.14); border-color:rgba(110,231,183,0.45); transform:translateY(-1px); }
  .g-btn-review-att:disabled { opacity:0.4; cursor:not-allowed; }
  .g-input { width:100%; background:${G.bgDeep}; border:1px solid ${G.border}; border-radius:8px; padding:12px 14px; color:${G.textPrimary}; font-size:14px; font-family:'DM Sans',sans-serif; transition: border-color 0.2s, box-shadow 0.2s; }
  .g-input:focus { border-color:${G.goldBorder}; box-shadow:0 0 0 3px ${G.goldDim}; }
  .g-label { display:block; font-size:10px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:${G.textSecondary}; margin-bottom:8px; font-family:'DM Mono',monospace; }
  .g-card { background:${G.surface}; border:1px solid ${G.border}; border-radius:14px; transition: border-color 0.2s, background 0.2s; }
  .g-card:hover { border-color:${G.borderHi}; background:${G.surfaceMid}; }
  .g-stat-card { background: linear-gradient(135deg, ${G.surface} 0%, ${G.surfaceMid} 100%); border:1px solid ${G.border}; border-radius:14px; padding:22px 24px; position:relative; overflow:hidden; transition: border-color 0.2s, transform 0.2s; }
  .g-stat-card:hover { border-color:${G.goldBorder}; transform:translateY(-2px); }
  .g-stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, transparent, ${G.gold}, transparent); opacity:0.6; }
  .g-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(14px); z-index:100; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.25s ease; }
  .g-modal { background: linear-gradient(160deg, ${G.surfaceMid} 0%, ${G.surface} 100%); border:1px solid ${G.border}; border-radius:20px; width:100%; max-width:600px; max-height:90vh; overflow-y:auto; animation:scaleIn 0.3s ease; box-shadow: 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,169,110,0.12); }
  .g-modal-wide { max-width: 900px; }
  .g-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:600; letter-spacing:0.07em; font-family:'DM Mono',monospace; text-transform:uppercase; }
  .g-badge-gold  { background:${G.goldDim};   color:${G.gold};    border:1px solid ${G.goldBorder}; }
  .g-badge-green { background:${G.successDim}; color:${G.success}; border:1px solid ${G.successBorder}; }
  .g-badge-red   { background:${G.dangerDim};  color:${G.danger};  border:1px solid ${G.dangerBorder}; }
  .g-badge-muted { background:rgba(255,255,255,0.04); color:${G.textSecondary}; border:1px solid ${G.border}; }
  .pri-high   { background:${G.dangerDim}; color:${G.danger}; border:1px solid ${G.dangerBorder}; }
  .pri-medium { background:rgba(201,169,110,0.1); color:${G.gold}; border:1px solid ${G.goldBorder}; }
  .pri-low    { background:${G.successDim}; color:${G.success}; border:1px solid ${G.successBorder}; }
  .g-drop { border:2px dashed ${G.border}; border-radius:12px; padding:24px 16px; text-align:center; cursor:pointer; transition:all 0.2s ease; background:transparent; }
  .g-drop:hover, .g-drop.drag-over { border-color:${G.goldBorder}; background:${G.goldDim}; }
  .ai-progress-fill { height:100%; border-radius:3px; background: linear-gradient(90deg, ${G.gold}, ${G.goldBright}, ${G.gold}); animation: progressBar 1.6s ease-in-out infinite; }
  .glow-dot { width:6px; height:6px; border-radius:50%; animation:shimmer 2s ease infinite; }
  .g-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background: linear-gradient(135deg, ${G.surfaceHigh}, ${G.surfaceMid}); border:1px solid ${G.goldBorder}; border-radius:99px; padding:12px 24px; font-family:'DM Mono',monospace; font-size:12px; color:${G.textPrimary}; z-index:9999; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${G.goldGlow}; animation:fadeUp 0.3s ease; }
  .g-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  .g-lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 12px; object-fit: contain; box-shadow: 0 40px 80px rgba(0,0,0,0.8); animation: scaleIn 0.25s ease; }
  .g-lightbox-close { position: absolute; top: 20px; right: 24px; width: 40px; height: 40px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 50%; color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; }
  .g-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 50%; color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .g-lightbox-nav.prev { left: 20px; } .g-lightbox-nav.next { right: 20px; }
  .g-lightbox-nav:disabled { opacity: 0.2; cursor: not-allowed; }
  .g-lightbox-counter { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); font-family: 'DM Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.1em; }
  .tat-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:600; letter-spacing:0.07em; font-family:'DM Mono',monospace; text-transform:uppercase; background:${G.dangerDim}; color:${G.danger}; border:1px solid ${G.dangerBorder}; animation:tatPulse 2s ease infinite; }
  .g-dt-row { display:flex; gap:0; align-items:stretch; border:1px solid ${G.border}; border-radius:8px; overflow:hidden; background:${G.bgDeep}; }
  .g-dt-row input[type="date"] { flex:1; background:transparent; border:none; padding:12px 14px; color:${G.textPrimary}; font-size:14px; font-family:'DM Sans',sans-serif; min-width:0; }
  .g-dt-row input[type="date"]:focus { outline:none; box-shadow: inset 0 0 0 2px ${G.goldBorder}; }
  .g-slot-group { display:flex; flex-shrink:0; }
  .g-slot-btn { padding:0 13px; background:transparent; border:none; border-left:1px solid ${G.border}; color:${G.textMuted}; font-family:'DM Mono',monospace; font-size:10px; font-weight:600; letter-spacing:0.09em; cursor:pointer; transition:all 0.15s ease; white-space:nowrap; }
  .g-slot-btn:first-child { border-left: none; }
  .g-slot-btn.active { background:${G.goldDim}; color:${G.gold}; }
  .g-slot-btn:hover:not(.active) { color:${G.textSecondary}; background:rgba(255,255,255,0.03); }
`;

const priClass = (p: string) =>
  p === "high" ? "g-badge pri-high" : p === "low" ? "g-badge pri-low" : "g-badge pri-medium";

const APPROVAL_COLORS: Record<string, string> = {
  assigned: G.gold, rejected: G.danger, "in-review": G.amber,
  "admin-approved": G.amber, "superadmin-approved": G.success,
  "in-progress": G.purple, completed: G.success, pending: G.textMuted,
};
const APPROVAL_LABELS: Record<string, string> = {
  assigned: "Assigned", rejected: "Needs Rework", "in-review": "Under Review",
  "admin-approved": "Admin Approved", "superadmin-approved": "Fully Approved",
  "in-progress": "In Progress", completed: "Completed", pending: "Pending",
};

const TIME_SLOTS = ["AM", "Noon", "PM"] as const;

// ── DateTimePicker ─────────────────────────────────────────────────────────────
interface DateTimePickerProps {
  label?: string;
  required?: boolean;
  dateValue: string;
  timeSlot: string;
  onDateChange: (v: string) => void;
  onTimeSlotChange: (v: string) => void;
  hideDateInput?: boolean;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label, required, dateValue, timeSlot, onDateChange, onTimeSlotChange, hideDateInput,
}) => (
  <div>
    {label && <label className="g-label">{label}{required ? " *" : ""}</label>}
    <div className="g-dt-row">
      {!hideDateInput && (
        <input
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          style={{ colorScheme: "dark" } as React.CSSProperties}
        />
      )}
      {hideDateInput && (
        <div style={{ flex: 1, padding: "12px 14px", fontSize: 13, color: G.textSecondary, fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center" }}>
          Select time slot →
        </div>
      )}
      <div className="g-slot-group">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            className={`g-slot-btn${timeSlot === slot ? " active" : ""}`}
            onClick={() => onTimeSlotChange(slot)}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const {
    getTasksForAdminReview, getAssignedTasks, submitTaskCompletion,
    adminReviewTask, logout, user, teamMembers, addTask, projects, updateTask,
  } = useUser();
  const navigate = useNavigate();

  const allMembers     = teamMembers as TeamMember[];
  const activeProjects = (projects as Project[]).filter((p) => !p.status || p.status === "active");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState("overview");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIPanel,     setShowAIPanel]     = useState(false);
  const [toastMsg,        setToastMsg]        = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Smart Assist ──────────────────────────────────────────────────────────
  const [smartAssistTickets, setSmartAssistTickets] = useState<SmartAssistTicket[]>(() => loadTickets());
  const [showSmartAssist,    setShowSmartAssist]    = useState(false);
  const [activeTicket,       setActiveTicket]       = useState<SmartAssistTicket | null>(null);

  // ── Global History ────────────────────────────────────────────────────────
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);

  // ── Lightbox ──────────────────────────────────────────────────────────────
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [showLightbox,   setShowLightbox]   = useState(false);

  // ── New task form ─────────────────────────────────────────────────────────
  const [newTask, setNewTask] = useState({
    title: "", description: "", priority: "medium", dueDate: "",
    assignedTo: "", projectId: "", timeSlot: "PM",
  });

  // ── Forward task ──────────────────────────────────────────────────────────
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTask,      setForwardTask]      = useState<Task | null>(null);
  const [forwardTo,        setForwardTo]        = useState("");
  const [forwardNotes,     setForwardNotes]     = useState("");

  // ── Task history modal ────────────────────────────────────────────────────
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTask,      setHistoryTask]      = useState<Task | null>(null);

  // ── Review queue ──────────────────────────────────────────────────────────
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask,    setSelectedTask]    = useState<Task | null>(null);
  const [reviewComments,  setReviewComments]  = useState("");

  // ── Submit task ───────────────────────────────────────────────────────────
  const [showSubmitModal,  setShowSubmitModal]  = useState(false);
  const [submitTask,       setSubmitTask]       = useState<Task | null>(null);
  const [submitNotes,      setSubmitNotes]      = useState("");
  const [submitPhotos,     setSubmitPhotos]     = useState<string[]>([]);
  const [submitTimeSlot,   setSubmitTimeSlot]   = useState("PM");
  const [submitDragOver,   setSubmitDragOver]   = useState(false);
  const [aiDrafting,       setAiDrafting]       = useState(false);
  const [aiReviewing,      setAiReviewing]      = useState(false);
  const [aiReviewResults,  setAiReviewResults]  = useState<AIReviewResults | null>(null);
  const [reviewPanelOpen,  setReviewPanelOpen]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  const tasksToReview    = getTasksForAdminReview() as unknown as Task[];
  const myAssignedTasks  = getAssignedTasks() as unknown as Task[];
  const myPendingTasks   = myAssignedTasks.filter(
    (t) => t.approvalStatus === "assigned" || t.approvalStatus === "rejected"
  );
  const mySubmittedTasks = myAssignedTasks.filter((t) =>
    (["in-review", "admin-approved", "superadmin-approved"] as string[]).includes(t.approvalStatus)
  );

  const assignableAdmins = allMembers.filter(
    (m) => m.role === "admin" && m.email.toLowerCase() !== (user?.email ?? "").toLowerCase()
  );
  const assignableStaff  = allMembers.filter((m) => m.role === "staff");
  const selectedMember   = allMembers.find((m) => m.email === newTask.assignedTo);

  const getName = useCallback(
    (email: string): string => allMembers.find((m) => m.email === email)?.name ?? email,
    [allMembers]
  );
  const isAdminEmail = (email: string): boolean =>
    allMembers.find((m) => m.email === email)?.role === "admin";

  // ── TAT Engine ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = startTATMonitor(
      () => [...(getTasksForAdminReview() as unknown as TATTask[]), ...(getAssignedTasks() as unknown as TATTask[])],
      getName,
      (_: TATTask[], newTickets: SmartAssistTicket[]) => {
        if (newTickets.length > 0) {
          setSmartAssistTickets((prev) => mergeTickets(prev, newTickets));
          toast(`⚠ ${newTickets.length} TAT breach${newTickets.length !== 1 ? "es" : ""} detected`);
        }
      },
      60_000
    );
    return cleanup;
  }, [getName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lightbox keyboard nav ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!showLightbox) return;
      if (e.key === "Escape")      setShowLightbox(false);
      if (e.key === "ArrowRight")  setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1));
      if (e.key === "ArrowLeft")   setLightboxIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLightbox, lightboxPhotos.length]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const allTasks = [...tasksToReview, ...myAssignedTasks];
    const totalTasks      = allTasks.length;
    const completedTasks  = allTasks.filter((t) => t.approvalStatus === "superadmin-approved").length;
    const pendingTasks    = allTasks.filter(
      (t) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending"
    ).length;
    const inProgressTasks = allTasks.filter((t) =>
      (["in-review", "admin-approved"] as string[]).includes(t.approvalStatus)
    ).length;
    const tatBreachedCount  = allTasks.filter((t) => t.tatBreached).length;
    const completionRate    = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const activeTicketCount = countActiveTickets(smartAssistTickets);

    const tasksPerStaff: Record<string, number> = {};
    allTasks.forEach((task) => {
      tasksPerStaff[task.assignedTo] = (tasksPerStaff[task.assignedTo] ?? 0) + 1;
    });

    const completedWithTime = allTasks.filter((t) => t.completedAt && t.createdAt);
    let avgMs = 0;
    if (completedWithTime.length > 0) {
      avgMs = completedWithTime.reduce(
        (acc, t) => acc + (new Date(t.completedAt!).getTime() - new Date(t.createdAt!).getTime()),
        0
      ) / completedWithTime.length;
    }
    const avgCompletionTime = avgMs > 0 ? `${(avgMs / (1000 * 60 * 60 * 24)).toFixed(1)}d` : "—";

    return {
      totalTasks, completedTasks, pendingTasks, inProgressTasks,
      completionRate, avgCompletionTime, tatBreachedCount, activeTicketCount,
      tasksByStatus: {
        approved:  allTasks.filter((t) => t.approvalStatus === "superadmin-approved").length,
        inProcess: inProgressTasks, pending: pendingTasks, completed: completedTasks,
      },
      tasksPerStaff,
    };
  }, [tasksToReview, myAssignedTasks, smartAssistTickets]);

  // ── Utility ───────────────────────────────────────────────────────────────
  const toast = (msg: string): void => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  };

  const openLightbox = (photos: string[], index = 0): void => {
    setLightboxPhotos(photos); setLightboxIndex(index); setShowLightbox(true);
  };

  const openSubmitModal = (task: Task): void => {
    setSubmitTask(task);
    setSubmitNotes(task.completionNotes ?? "");
    setSubmitPhotos(task.attachments ?? []);
    setSubmitTimeSlot(task.timeSlot ?? "PM");
    setAiReviewResults(null); setReviewPanelOpen(false);
    setShowSubmitModal(true);
  };

  const closeSubmitModal = (): void => {
    setShowSubmitModal(false); setSubmitTask(null); setSubmitNotes("");
    setSubmitPhotos([]); setAiReviewResults(null); setReviewPanelOpen(false);
  };

  const handlePhotoAdd = (files: FileList | null): void => {
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith("image/")) return;
      const r = new FileReader();
      r.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setSubmitPhotos((prev) => [...prev, result]);
          setAiReviewResults(null);
        }
      };
      r.readAsDataURL(file);
    });
    toast("Photo uploaded ✓");
  };

  const removePhoto = (i: number): void => {
    setSubmitPhotos((prev) => prev.filter((_, idx) => idx !== i));
    setAiReviewResults(null);
  };

  // ── Smart Assist handlers ─────────────────────────────────────────────────
  const openSmartAssist = (task: Task): void => {
    const ticket = getTicketForTask(smartAssistTickets, task.id);
    setActiveTicket(
      ticket ?? {
        id: `sa_${task.id}`,
        taskId: task.id,
        taskTitle: task.title,
        assignedTo: task.assignedTo,
        assignedToName: getName(task.assignedTo),
        assignedBy: task.assignedBy,
        assignedByName: getName(task.assignedBy ?? ""),
        delayDuration: task.smartAssist?.delayDuration ?? "Unknown",
        originalDeadline: task.exactDeadline ?? computeExactDeadline(task.dueDate, task.timeSlot ?? "PM"),
        timeSlot: task.timeSlot ?? "PM",
        reminderCount: task.smartAssist?.reminderCount ?? 1,
        status: "open",
        lastReminderAt: new Date().toISOString(),
      }
    );
    setShowSmartAssist(true);
  };

  const handleSmartAssistSubmit = ({
    revisedDate, revisedTimeSlot, delayReason,
  }: { revisedDate: string; revisedTimeSlot: string; delayReason: string }): void => {
    if (!activeTicket) return;
    const updated = submitRevision(smartAssistTickets, activeTicket.taskId, { revisedDate, revisedTimeSlot, delayReason });
    setSmartAssistTickets(updated);
    toast("✓ Revised timeline submitted");
  };

  // ── Submit task ───────────────────────────────────────────────────────────
  const handleSubmitTask = (): void => {
    if (!submitTask) return;
    if (!submitNotes.trim()) { toast("⚠ Please add completion notes."); return; }
    if (aiReviewResults?.hasErrors) { toast("⚠ Fix attachment errors before submitting."); return; }
    const histEntry: HistoryEntry = {
      id: `hist_${Date.now()}`, timestamp: new Date().toISOString(),
      action: "completed", by: user?.email ?? "", notes: submitNotes,
    };
    updateTask(submitTask.id, {
      ...submitTask,
      completionNotes: submitNotes,
      attachments: submitPhotos,
      timeSlot: submitTimeSlot,
      exactDeadline: computeExactDeadline(submitTask.dueDate, submitTimeSlot),
      history: [...(submitTask.history ?? []), histEntry],
      completedAt: new Date().toISOString(),
    } as never);
    setSmartAssistTickets(resolveTicket(smartAssistTickets, submitTask.id));
    submitTaskCompletion(submitTask.id, submitNotes);
    closeSubmitModal();
    toast("✓ Task submitted for review.");
  };

  const handleAIDraft = async (): Promise<void> => {
    if (!submitTask || !submitNotes.trim()) { toast("⚠ Write some notes first."); return; }
    setAiDrafting(true);
    try {
      const res = await fetch("http://localhost:5000/api/draft-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: submitTask.id, notes: submitNotes }),
      });
      if (!res.ok) { toast(`✕ ${(await res.json() as { message: string }).message}`); return; }
      const { improvedNotes } = await res.json() as { improvedNotes?: string };
      setSubmitNotes(improvedNotes || submitNotes);
      toast("✨ Notes improved by AI!");
    } catch { toast("✕ Backend not running. Run: npm start"); }
    finally { setAiDrafting(false); }
  };

  const handleAIReview = async (): Promise<void> => {
    if (!submitTask || submitPhotos.length === 0) { toast("⚠ Upload attachments first."); return; }
    setAiReviewing(true); setAiReviewResults(null);
    try {
      const contentArray: Array<Record<string, unknown>> = [
        { type: "text", text: `Review each image. Return ONLY JSON:[{"image":1,"status":"CLEAN|MINOR|ERROR","issues":[],"recommendations":"..."}]` },
      ];
      for (const photo of submitPhotos) {
        let base64 = photo, mime = "image/jpeg";
        if (photo.startsWith("data:")) {
          const m = photo.match(/data:([^;]+);base64,(.+)/);
          if (m) { mime = m[1]; base64 = m[2]; }
        }
        contentArray.push({ type: "image", source: { type: "base64", media_type: mime, data: base64 } });
      }
      const res = await fetch("http://localhost:5000/api/review-attachments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: submitTask.id, contentArray }),
      });
      if (!res.ok) { toast(`✕ ${(await res.json() as { message: string }).message}`); return; }
      const data = await res.json() as { results?: AIReviewResult[]; hasErrors?: boolean };
      setAiReviewResults({ results: data.results ?? [], hasErrors: data.hasErrors ?? false, timestamp: new Date().toISOString() });
      setReviewPanelOpen(true);
      toast(data.hasErrors ? "⚠ Errors found — fix before submitting." : "✓ All attachments clear!");
    } catch { toast("✕ Backend not running. Run: npm start"); }
    finally { setAiReviewing(false); }
  };

  const handleForwardTask = (): void => {
    if (!forwardTask || !forwardTo) { toast("⚠ Please select a team member."); return; }
    const h: HistoryEntry = {
      id: `hist_${Date.now()}`, timestamp: new Date().toISOString(),
      action: "forwarded", by: user?.email ?? "", to: forwardTo, notes: forwardNotes,
    };
    updateTask(forwardTask.id, {
      ...forwardTask, assignedTo: forwardTo, assignedBy: user?.email,
      forwardedFrom: forwardTask.assignedTo,
      history: [...(forwardTask.history ?? []), h],
    } as never);
    toast(`✓ Task forwarded to ${getName(forwardTo)}`);
    setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes("");
  };

  const handleApprove = (): void => {
    if (!selectedTask) return;
    const h: HistoryEntry = {
      id: `hist_${Date.now()}`, timestamp: new Date().toISOString(),
      action: "approved", by: user?.email ?? "", notes: reviewComments,
    };
    updateTask(selectedTask.id, { ...selectedTask, history: [...(selectedTask.history ?? []), h] } as never);
    adminReviewTask(selectedTask.id, true, reviewComments);
    setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
    toast("✓ Approved — forwarded to Superadmin.");
  };

  const handleRework = (): void => {
    if (!selectedTask) return;
    if (!reviewComments.trim()) { toast("⚠ Add a reason for rework."); return; }
    const h: HistoryEntry = {
      id: `hist_${Date.now()}`, timestamp: new Date().toISOString(),
      action: "rejected", by: user?.email ?? "", notes: reviewComments,
    };
    updateTask(selectedTask.id, { ...selectedTask, history: [...(selectedTask.history ?? []), h] } as never);
    adminReviewTask(selectedTask.id, false, reviewComments);
    setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
    toast("↩ Sent back for rework.");
  };

  const handleCreateTask = (): void => {
    if (!newTask.title || !newTask.description || !newTask.assignedTo || !newTask.dueDate) {
      toast("⚠ Fill all required fields."); return;
    }
    if (!newTask.projectId) { toast("⚠ Select a project."); return; }
    const member = allMembers.find((m) => m.email === newTask.assignedTo);
    if (!member) { toast("⚠ Selected member not found."); return; }
    const exactDeadline = computeExactDeadline(newTask.dueDate, newTask.timeSlot);
    const now = new Date().toISOString();
    const history: HistoryEntry[] = [
      { id: `hist_${Date.now()}`,     timestamp: now, action: "created",  by: user?.email ?? "", to: newTask.assignedTo },
      { id: `hist_${Date.now() + 1}`, timestamp: now, action: "assigned", by: user?.email ?? "", to: newTask.assignedTo },
    ];
    addTask({
      title: newTask.title, description: newTask.description, status: "pending",
      priority: newTask.priority as Task["priority"], dueDate: newTask.dueDate,
      assignedTo: newTask.assignedTo, projectId: newTask.projectId,
      timeSlot: newTask.timeSlot, exactDeadline, history,
    } as never);
    toast(`✓ Task assigned to ${member.name}`);
    setNewTask({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "", projectId: "", timeSlot: "PM" });
    setShowCreateModal(false);
  };

  const handleLogout = (): void => {
    if (window.confirm("Sign out?")) { logout(); navigate("/login", { replace: true }); }
  };

  const stats = [
    { label: "Pending Review", value: analytics.tasksByStatus.pending,   accent: G.gold,    icon: Clock },
    { label: "In Progress",    value: analytics.tasksByStatus.inProcess, accent: G.purple,  icon: Activity },
    { label: "Approved",       value: analytics.tasksByStatus.approved,  accent: G.success, icon: CheckCircle },
    { label: "TAT Breached",   value: analytics.tatBreachedCount,        accent: G.danger,  icon: AlertTriangle },
  ];

  const TABS = [
    { id: "overview",  label: "Overview",  icon: BarChart3 },
    { id: "review",    label: "Review",    icon: Eye },
    { id: "mytasks",   label: "My Tasks",  icon: User },
    { id: "progress",  label: "Progress",  icon: Activity },
    { id: "taskmap",   label: "Task Map",  icon: GitBranch },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
  ];

  const allTasksCombined = useMemo<Task[]>(() => {
    const map = new Map<string, Task>();
    [...tasksToReview, ...myAssignedTasks].forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasksToReview, myAssignedTasks]);

  const activeSmartAssistCount = countActiveTickets(smartAssistTickets);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: "100vh", position: "relative", backgroundImage: `url('/images/radiant-gold-shapes-shimmering-light-effects-polished-black-background-copyspace-text.jpg')`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
        <div style={{ position: "fixed", inset: 0, background: "linear-gradient(135deg,rgba(8,6,0,0.92) 0%,rgba(5,4,0,0.88) 50%,rgba(8,6,0,0.92) 100%)", zIndex: 0, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>

          {/* ── HEADER ── */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 0 24px", position: "sticky", top: 0, zIndex: 50, background: "rgba(8,6,0,0.8)", backdropFilter: "blur(24px)", borderBottom: `1px solid ${G.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `linear-gradient(135deg,${G.gold},${G.goldBright})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${G.goldGlow}` }}>
                <Zap size={20} color="#000" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 400, color: G.textPrimary, lineHeight: 1, letterSpacing: "-0.01em" }}>
                  Admin <span style={{ fontStyle: "italic", color: G.gold }}>Control</span>
                </div>
                {user && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, marginTop: 5, letterSpacing: "0.08em" }}>{(user as { name?: string }).name} · {user.email}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {activeSmartAssistCount > 0 && (
                <button onClick={() => { setActiveTicket(null); setShowSmartAssist(true); }} className="tat-badge" style={{ cursor: "pointer", border: "none" }}>
                  <AlertTriangle size={11} /> {activeSmartAssistCount} TAT Breach{activeSmartAssistCount !== 1 ? "es" : ""}
                </button>
              )}
              <button onClick={() => setShowGlobalHistory(true)} className="g-btn-ghost" style={{ padding: "10px 14px" }}><History size={15} /></button>
              <div style={{ display: "flex", gap: 6, background: G.surfaceHigh, border: `1px solid ${G.border}`, borderRadius: 8, padding: 4 }}>
                {TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: activeTab === tab.id ? G.goldDim : "transparent", color: activeTab === tab.id ? G.gold : G.textSecondary, border: activeTab === tab.id ? `1px solid ${G.goldBorder}` : "1px solid transparent", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s", position: "relative" }}>
                    <tab.icon size={12} />{tab.label}
                    {tab.id === "review" && tasksToReview.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger, borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{tasksToReview.length}</span>}
                    {tab.id === "mytasks" && myPendingTasks.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger, borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{myPendingTasks.length}</span>}
                  </button>
                ))}
              </div>
              <button className="g-btn-gold" onClick={() => setShowCreateModal(true)}><Plus size={14} strokeWidth={2.5} />New Task</button>
              <button className="g-btn-ghost" onClick={() => setShowAIPanel(!showAIPanel)} style={{ padding: "10px 14px", borderColor: showAIPanel ? G.goldBorder : G.border }}><MessageSquare size={16} color={showAIPanel ? G.gold : undefined} /></button>
              <button className="g-btn-ghost" onClick={handleLogout} style={{ padding: "10px 14px" }}><LogOut size={16} /></button>
            </div>
          </header>

          {showAIPanel && (
            <div style={{ marginTop: 24, height: 500, borderRadius: 16, overflow: "hidden", border: `1px solid ${G.border}` }}>
              <ClaudeChat theme="amber" />
            </div>
          )}

          {/* ══ OVERVIEW TAB ══ */}
          {activeTab === "overview" && (
            <>
              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 32 }}>
                {stats.map((s, i) => (
                  <div key={i} className="g-stat-card fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 46, fontWeight: 300, color: s.accent, lineHeight: 1, letterSpacing: "-0.03em" }}>{s.value}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 10 }}>{s.label}</div>
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><s.icon size={18} color={s.accent} /></div>
                    </div>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${s.accent}44,transparent)` }} />
                  </div>
                ))}
              </section>

              {activeSmartAssistCount > 0 && (
                <div className="fade-up" style={{ marginTop: 24, padding: "16px 20px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <AlertTriangle size={20} color={G.danger} />
                    <div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: G.danger }}>{activeSmartAssistCount} Active TAT Breach{activeSmartAssistCount !== 1 ? "es" : ""}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: G.textSecondary, marginTop: 3 }}>Smart Assist reminders are running every 24h</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("progress")} className="g-btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>View Progress <ChevronRight size={13} /></button>
                </div>
              )}

              <section style={{ marginTop: 32, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: G.textPrimary, letterSpacing: "-0.01em", marginBottom: 24 }}>Task <span style={{ fontStyle: "italic", color: G.gold }}>Monitor</span></h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {[
                    { label: "Approved",   color: G.success, tasks: tasksToReview.filter((t) => (["admin-approved","superadmin-approved"] as string[]).includes(t.approvalStatus)) },
                    { label: "In Process", color: G.purple,  tasks: myAssignedTasks.filter((t) => t.approvalStatus === "in-review") },
                    { label: "Pending",    color: G.gold,    tasks: myAssignedTasks.filter((t) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending") },
                    { label: "Completed",  color: G.success, tasks: [...tasksToReview, ...myAssignedTasks].filter((t) => t.approvalStatus === "superadmin-approved") },
                  ].map((group, i) => (
                    <div key={i} className="fade-up" style={{ animationDelay: `${i * 70}ms`, background: G.surface, border: `1px solid ${G.border}`, borderRadius: 14, padding: "20px 22px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, letterSpacing: "0.1em", textTransform: "uppercase" }}>{group.label}</div>
                          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 300, color: group.color, marginTop: 4 }}>{group.tasks.length}</div>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: group.color, boxShadow: `0 0 10px ${group.color}`, animation: "shimmer 2s ease infinite" }} />
                      </div>
                      {group.tasks.length > 0 && (
                        <div style={{ fontSize: 12, color: G.textMuted, fontFamily: "'DM Mono',monospace" }}>
                          Latest: {group.tasks[group.tasks.length - 1]?.title.substring(0, 30)}…
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ══ MY TASKS TAB ══ */}
          {activeTab === "mytasks" && (
            <section style={{ marginTop: 40, paddingBottom: 60 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: G.textPrimary, marginBottom: 8 }}>My <span style={{ fontStyle: "italic", color: G.gold }}>Tasks</span></h2>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tasks assigned to you by other admins</p>
              {myAssignedTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "72px 24px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 300, color: G.textSecondary }}>No tasks assigned to you</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[...myPendingTasks, ...mySubmittedTasks].map((task, idx) => {
                    const canSubmit  = task.approvalStatus === "assigned" || task.approvalStatus === "rejected";
                    const canForward = task.approvalStatus === "assigned";
                    const ac = APPROVAL_COLORS[task.approvalStatus] || G.textSecondary;
                    return (
                      <div key={task.id} className="g-card fade-up" style={{ animationDelay: `${idx * 55}ms`, padding: "20px 24px", borderColor: task.tatBreached ? G.dangerBorder : G.border }}>
                        {task.tatBreached && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: G.danger, fontFamily: "'DM Mono',monospace" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={12} /> TAT BREACH — {task.smartAssist?.delayDuration || "Overdue"}</span>
                            <button onClick={() => openSmartAssist(task)} style={{ background: "none", border: `1px solid ${G.dangerBorder}`, borderRadius: 6, color: G.danger, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", padding: "3px 8px" }}>View Ticket</button>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                              <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{task.title}</h3>
                              <span className={priClass(task.priority)}><Flag size={9} />{task.priority.toUpperCase()}</span>
                              <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                            </div>
                            {task.assignedBy && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "4px 12px", borderRadius: 99, background: G.goldDim, border: `1px solid ${G.goldBorder}`, fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.gold }}>
                                <Shield size={9} /> Assigned by <strong style={{ marginLeft: 3 }}>{getName(task.assignedBy)}</strong>
                              </div>
                            )}
                            <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{task.description}</p>
                            {task.approvalStatus === "rejected" && task.adminComments && (
                              <div style={{ padding: "10px 14px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, fontSize: 13, color: G.danger, marginBottom: 10 }}>↩ <strong>Rework reason:</strong> {task.adminComments}</div>
                            )}
                            {task.completionNotes && (
                              <div style={{ padding: "10px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, fontSize: 13, color: G.textSecondary, marginBottom: 10 }}>📝 {task.completionNotes}</div>
                            )}
                            <div style={{ display: "flex", gap: 14, fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em", flexWrap: "wrap" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Calendar size={10} />Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {task.timeSlot && <span style={{ color: G.gold, marginLeft: 4 }}>· {task.timeSlot}</span>}
                              </span>
                              {task.history && task.history.length > 0 && (
                                <button onClick={() => { setHistoryTask(task); setShowHistoryModal(true); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: G.gold, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", padding: 0 }}>
                                  <ListTree size={10} />View History
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column" }}>
                            <button className="g-btn-ghost" onClick={() => { setReassignTask(task); setShowReassignModal(true); }} style={{ padding: "9px 14px", fontSize: 12 }}><RotateCw size={13} />Reassign</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ══ REVIEW TAB ══ */}
          {activeTab === "review" && (
            <section style={{ marginTop: 40, paddingBottom: 60 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: G.textPrimary }}>Pending <span style={{ fontStyle: "italic", color: G.gold }}>Review</span></h2>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, marginTop: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>{tasksToReview.length} task{tasksToReview.length !== 1 ? "s" : ""} awaiting your decision</p>
                </div>
                {tasksToReview.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="glow-dot" style={{ background: G.gold }} />
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, letterSpacing: "0.1em" }}>LIVE</span>
                  </div>
                )}
              </div>
              {tasksToReview.length === 0 ? (
                <div style={{ textAlign: "center", padding: "72px 24px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: G.successDim, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: `1px solid ${G.successBorder}` }}><CheckCircle size={28} color={G.success} strokeWidth={1.5} /></div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 300, color: G.textPrimary, marginBottom: 8 }}>All clear</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: G.textMuted }}>No tasks pending review.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {tasksToReview.map((task, idx) => (
                    <TaskRow key={task.id} task={task} idx={idx}
                      staffName={getName(task.assignedTo)}
                      isAdminAssignee={isAdminEmail(task.assignedTo)}
                      onReview={() => { setSelectedTask(task); setShowReviewModal(true); }}
                      onViewHistory={() => { setHistoryTask(task); setShowHistoryModal(true); }}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══ PROGRESS TAB ══ */}
          {activeTab === "progress" && (
            <section style={{ marginTop: 40, paddingBottom: 60 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: G.textPrimary, marginBottom: 8 }}>Task <span style={{ fontStyle: "italic", color: G.gold }}>Progress</span></h2>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" }}>Real-time visibility into tasks you've assigned</p>
              <ProgressTracker tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} pollInterval={30000} onRefresh={() => toast("↻ Progress refreshed")} />
            </section>
          )}

          {/* ══ TASK MAP TAB ══ */}
          {activeTab === "taskmap" && (
            <section style={{ marginTop: 40, paddingBottom: 60 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: G.textPrimary, marginBottom: 8 }}>Task <span style={{ fontStyle: "italic", color: G.gold }}>Map</span></h2>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" }}>Parent-child forwarding tree with full context</p>
              <ForwardedTaskTree tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} onSelectTask={(task: Task) => { setSelectedTask(task); setShowReviewModal(true); }} />
            </section>
          )}

          {/* ══ ANALYTICS TAB ══ */}
          {activeTab === "analytics" && (
            <section style={{ marginTop: 40, paddingBottom: 60 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: G.textPrimary, marginBottom: 24 }}>Task <span style={{ fontStyle: "italic", color: G.gold }}>Analytics</span></h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
                <AnalyticsCard title="Total Tasks"         value={analytics.totalTasks}           subtitle="All time"         color={G.gold} />
                <AnalyticsCard title="Completion Rate"     value={`${analytics.completionRate}%`} subtitle="Success ratio"    color={G.success} />
                <AnalyticsCard title="Avg Completion Time" value={analytics.avgCompletionTime}    subtitle="Per task"         color={G.purple} />
                <AnalyticsCard title="Active Tasks"        value={analytics.inProgressTasks}      subtitle="In progress"      color={G.amber} />
                <AnalyticsCard title="TAT Breached"        value={analytics.tatBreachedCount}     subtitle="Deadline misses"  color={G.danger} />
                <AnalyticsCard title="Smart Assist Active" value={analytics.activeTicketCount}    subtitle="Open escalations" color={G.amber} />
              </div>
              <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16, padding: "24px 28px", marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: G.textPrimary, marginBottom: 20 }}>Tasks by Status</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  {Object.entries(analytics.tasksByStatus).map(([status, count], i) => (
                    <div key={i} style={{ padding: "14px 16px", background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 10 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 300, color: G.textPrimary }}>{count}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{status.replace(/([A-Z])/g, " $1").trim()}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16, padding: "24px 28px" }}>
                <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: G.textPrimary, marginBottom: 20 }}>Tasks Distribution</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {Object.entries(analytics.tasksPerStaff).slice(0, 8).map(([email, count], i) => {
                    const member   = allMembers.find((m) => m.email === email);
                    const values   = Object.values(analytics.tasksPerStaff) as number[];
                    const maxTasks = Math.max(...values);
                    const pct      = (count / maxTasks) * 100;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 140, flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary }}>{member?.name || email}</div>
                          <div style={{ fontSize: 10, color: G.textSecondary, fontFamily: "'DM Mono',monospace" }}>{member?.role || "Unknown"}</div>
                        </div>
                        <div style={{ flex: 1, height: 8, background: G.bgDeep, borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${G.gold},${G.goldBright})`, borderRadius: 99, transition: "width 0.5s ease" }} />
                        </div>
                        <div style={{ width: 40, textAlign: "right", fontSize: 14, fontWeight: 600, color: G.gold }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ════ MODAL: GLOBAL HISTORY ════ */}
        {showGlobalHistory && (
          <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGlobalHistory(false); }}>
            <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
              <ModalHeader title="Master History Log" sub="All task activity across the system — chronological" onClose={() => setShowGlobalHistory(false)} />
              <div style={{ padding: "24px 28px 28px" }}>
                <HistoryTimeline tasks={allTasksCombined} getNameFn={getName} compact={false} />
              </div>
            </div>
          </div>
        )}

        {/* ════ MODAL: CREATE TASK ════ */}
        {showCreateModal && (
          <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
            <div className="g-modal" style={{ maxHeight: "90vh" }}>
              <ModalHeader title="Assign New Task" sub="Task pushed to assignee's dashboard immediately" onClose={() => setShowCreateModal(false)} />
              <div style={{ padding: "24px 28px 28px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="g-label">Task Title *</label>
                    <input className="g-input" type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="e.g., Redesign onboarding flow" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="g-label">Assign to *</label>
                    <select className="g-input" value={newTask.assignedTo} onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}>
                      <option value="">Select a person...</option>
                      {assignableAdmins.length > 0 && <optgroup label="── ADMINS ──">{assignableAdmins.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                      {assignableStaff.length > 0  && <optgroup label="── STAFF / DOERS ──">{assignableStaff.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <DateTimePicker label="Due Date" required dateValue={newTask.dueDate} timeSlot={newTask.timeSlot} onDateChange={(v) => setNewTask({ ...newTask, dueDate: v })} onTimeSlotChange={(v) => setNewTask({ ...newTask, timeSlot: v })} />
                  </div>
                  <div>
                    <label className="g-label">Priority</label>
                    <select className="g-input" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="g-label">Project *</label>
                    {activeProjects.length === 0 ? (
                      <div style={{ padding: "12px 14px", background: G.amberDim, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, color: G.amber, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>⚠ No active projects.</div>
                    ) : (
                      <select className="g-input" value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                        <option value="">— Select a project —</option>
                        {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.projectCode ? ` · ${p.projectCode}` : ""}</option>)}
                      </select>
                    )}
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="g-label">Description *</label>
                    <textarea className="g-input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Detailed description…" style={{ minHeight: 90, resize: "vertical" }} />
                  </div>
                </div>

                {selectedMember && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: selectedMember.role === "admin" ? G.goldDim : G.successDim, border: `1px solid ${selectedMember.role === "admin" ? G.goldBorder : G.successBorder}`, borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: selectedMember.role === "admin" ? `linear-gradient(135deg,${G.gold},${G.goldBright})` : G.success, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {selectedMember.role === "admin" ? <Shield size={14} color="#000" /> : <User size={14} color="#000" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary }}>{selectedMember.name}</div>
                      <div style={{ fontSize: 11, color: G.textSecondary }}>{selectedMember.email}</div>
                    </div>
                    <span className="g-badge" style={{ background: selectedMember.role === "admin" ? G.goldDim : G.successDim, color: selectedMember.role === "admin" ? G.gold : G.success, border: `1px solid ${selectedMember.role === "admin" ? G.goldBorder : G.successBorder}` }}>
                      {selectedMember.role === "admin" ? "ADMIN" : "STAFF"}
                    </span>
                  </div>
                )}

                {newTask.dueDate && (
                  <div style={{ padding: "8px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.gold, fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={12} />
                    Exact deadline: {new Date(computeExactDeadline(newTask.dueDate, newTask.timeSlot)).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button className="g-btn-gold" onClick={handleCreateTask} style={{ flex: 1 }}><CheckCircle size={14} strokeWidth={2.5} />Assign Task</button>
                  <button className="g-btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MODAL: FORWARD TASK ════ */}
        {showForwardModal && forwardTask && (
          <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); } }}>
            <div className="g-modal">
              <ModalHeader title={`Forward: ${forwardTask.title}`} sub="Delegate task while maintaining full context" onClose={() => { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); }} />
              <div style={{ padding: "24px 28px 28px" }}>
                <div style={{ padding: "12px 14px", background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 10, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6 }}>{forwardTask.description}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace" }}>
                    <span>Priority: {forwardTask.priority?.toUpperCase()}</span><span>·</span>
                    <span>Due: {new Date(forwardTask.dueDate).toLocaleDateString()}</span>
                    {forwardTask.timeSlot && <span>· {forwardTask.timeSlot}</span>}
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label className="g-label">Forward to *</label>
                  <select className="g-input" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)}>
                    <option value="">Select a team member...</option>
                    {assignableStaff.length > 0  && <optgroup label="── STAFF ──">{assignableStaff.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                    {assignableAdmins.length > 0 && <optgroup label="── ADMINS ──">{assignableAdmins.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="g-label">Forwarding Notes (Optional)</label>
                  <textarea className="g-input" value={forwardNotes} onChange={(e) => setForwardNotes(e.target.value)} placeholder="Add context for the new assignee…" style={{ minHeight: 90, resize: "vertical" }} />
                </div>
                <div style={{ padding: "10px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.textSecondary, display: "flex", gap: 8 }}>
                  <GitBranch size={14} color={G.gold} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><strong style={{ color: G.gold }}>Context Linking:</strong> Full history and parent-child relationship is preserved.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="g-btn-gold" onClick={handleForwardTask} disabled={!forwardTo} style={{ flex: 1 }}><Share2 size={14} strokeWidth={2.5} />Forward Task</button>
                  <button className="g-btn-ghost" onClick={() => { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MODAL: TASK HISTORY ════ */}
        {showHistoryModal && historyTask && (
          <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowHistoryModal(false); setHistoryTask(null); } }}>
            <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
              <ModalHeader title={`History: ${historyTask.title}`} sub="Complete activity timeline" onClose={() => { setShowHistoryModal(false); setHistoryTask(null); }} />
              <div style={{ padding: "24px 28px 28px" }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <span className={priClass(historyTask.priority)}><Flag size={9} />{historyTask.priority?.toUpperCase()}</span>
                  <span className="g-badge g-badge-gold"><User size={9} />{getName(historyTask.assignedTo)}</span>
                  {historyTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                  {historyTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{historyTask.timeSlot}</span>}
                </div>
                <HistoryTimeline history={historyTask.history ?? []} getNameFn={getName} filterByTaskId={historyTask.id} compact={false} />
                <div style={{ marginTop: 20 }}>
                  <button className="g-btn-ghost" onClick={() => { setShowHistoryModal(false); setHistoryTask(null); }} style={{ width: "100%" }}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MODAL: REVIEW TASK ════ */}
        {showReviewModal && selectedTask && (
          <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); } }}>
            <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
              <ModalHeader title={`Review: ${selectedTask.title}`} sub="Approve to forward to Superadmin, or send back for rework" onClose={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }} />
              <div style={{ padding: "24px 28px 28px" }}>
                {/* Badges row */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                  <span className={priClass(selectedTask.priority)}><Flag size={9} />{selectedTask.priority?.toUpperCase()}</span>
                  <span className="g-badge g-badge-gold"><User size={9} />{getName(selectedTask.assignedTo)}</span>
                  {selectedTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                  {selectedTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{selectedTask.timeSlot}</span>}
                </div>

                {/* Description */}
                <div style={{ padding: "14px 16px", background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Description</div>
                  <p style={{ fontSize: 14, color: G.textSecondary, lineHeight: 1.65 }}>{selectedTask.description}</p>
                </div>

                {/* Completion notes */}
                {selectedTask.completionNotes && (
                  <div style={{ padding: "14px 16px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>📝 Completion Notes</div>
                    <p style={{ fontSize: 14, color: G.textSecondary, lineHeight: 1.65 }}>{selectedTask.completionNotes}</p>
                  </div>
                )}

                {/* Attachments */}
                {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Attachments ({selectedTask.attachments.length})</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {selectedTask.attachments.map((src, i) => (
                        <div key={i} style={{ position: "relative", cursor: "pointer" }} onClick={() => openLightbox(selectedTask.attachments!, i)}>
                          <img src={src} alt={`Attachment ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${G.border}` }} />
                          <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(0,0,0,0)", transition: "background 0.2s" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due date info */}
                <div style={{ padding: "10px 14px", background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.textMuted, fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={12} color={G.textMuted} />
                  Due: {new Date(selectedTask.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  {selectedTask.timeSlot && <span style={{ color: G.gold }}>· {selectedTask.timeSlot}</span>}
                </div>

                {/* Review comments */}
                <div style={{ marginBottom: 20 }}>
                  <label className="g-label">Review Comments {reviewComments.length === 0 ? "(required for rework)" : ""}</label>
                  <textarea
                    className="g-input"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Add feedback, notes, or reason for rework…"
                    style={{ minHeight: 100, resize: "vertical" }}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="g-btn-success" onClick={handleApprove} style={{ flex: 1 }}>
                    <CheckCircle size={14} />Approve & Forward
                  </button>
                  <button className="g-btn-danger" onClick={handleRework} style={{ flex: 1 }}>
                    <RotateCw size={14} />Send for Rework
                  </button>
                  <button className="g-btn-ghost" onClick={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MODAL: SUBMIT TASK ════ */}
        {showSubmitModal && submitTask && (
          <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeSubmitModal(); }}>
            <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
              <ModalHeader title={`Submit: ${submitTask.title}`} sub="Add completion notes and attachments before submitting for review" onClose={closeSubmitModal} />
              <div style={{ padding: "24px 28px 28px" }}>
                {/* Task info strip */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                  <span className={priClass(submitTask.priority)}><Flag size={9} />{submitTask.priority?.toUpperCase()}</span>
                  {submitTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{submitTask.timeSlot}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace" }}>
                    <Calendar size={10} />Due {new Date(submitTask.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                {/* Completion notes */}
                <div style={{ marginBottom: 16 }}>
                  <label className="g-label">Completion Notes *</label>
                  <textarea
                    className="g-input"
                    value={submitNotes}
                    onChange={(e) => setSubmitNotes(e.target.value)}
                    placeholder="Describe what was done, any blockers encountered, and the outcome…"
                    style={{ minHeight: 120, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="g-btn-ai" onClick={handleAIDraft} disabled={aiDrafting || !submitNotes.trim()}>
                      {aiDrafting ? <><Loader size={11} className="spin" />Improving…</> : <><Sparkles size={11} />AI Polish</>}
                    </button>
                  </div>
                </div>

                {/* Time slot for submission */}
                <div style={{ marginBottom: 16 }}>
                  <DateTimePicker label="Submission Time Slot" hideDateInput dateValue="" timeSlot={submitTimeSlot} onDateChange={() => {}} onTimeSlotChange={setSubmitTimeSlot} />
                </div>

                {/* Photo upload */}
                <div style={{ marginBottom: 16 }}>
                  <label className="g-label">Attachments (Photos)</label>
                  <div
                    className={`g-drop${submitDragOver ? " drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setSubmitDragOver(true); }}
                    onDragLeave={() => setSubmitDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setSubmitDragOver(false); handlePhotoAdd(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={20} color={G.textMuted} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: G.textSecondary }}>Drop images here or <span style={{ color: G.gold }}>browse</span></div>
                    <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>PNG, JPG, WEBP supported</div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handlePhotoAdd(e.target.files)} />

                  {/* Photo previews */}
                  {submitPhotos.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {submitPhotos.map((src, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img src={src} alt={`Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${G.border}`, cursor: "pointer" }} onClick={() => openLightbox(submitPhotos, i)} />
                          <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: G.danger, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11 }}>
                            <X size={10} />
                          </button>
                          {aiReviewResults && (
                            <div style={{ position: "absolute", bottom: 2, left: 2, right: 2, textAlign: "center" }}>
                              {(() => {
                                const r = aiReviewResults.results.find((r) => r.image === i + 1);
                                const c = r?.status === "CLEAN" ? G.success : r?.status === "ERROR" ? G.danger : G.amber;
                                return r ? <span style={{ fontSize: 8, background: `${c}cc`, color: "#fff", padding: "1px 4px", borderRadius: 4, fontFamily: "'DM Mono',monospace" }}>{r.status}</span> : null;
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                      <button className="g-btn-review-att" onClick={handleAIReview} disabled={aiReviewing} style={{ height: 72, minWidth: 72, flexDirection: "column", gap: 4 }}>
                        {aiReviewing ? <Loader size={14} className="spin" /> : <Eye size={14} />}
                        <span style={{ fontSize: 9 }}>{aiReviewing ? "Reviewing…" : "AI Review"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Review results panel */}
                {aiReviewResults && reviewPanelOpen && (
                  <div style={{ marginBottom: 16, padding: "14px 16px", background: aiReviewResults.hasErrors ? G.dangerDim : G.successDim, border: `1px solid ${aiReviewResults.hasErrors ? G.dangerBorder : G.successBorder}`, borderRadius: 10 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: aiReviewResults.hasErrors ? G.danger : G.success, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                      {aiReviewResults.hasErrors ? "⚠ Issues Found" : "✓ All Clear"}
                    </div>
                    {aiReviewResults.results.map((r, i) => (
                      <div key={i} style={{ marginBottom: 8, fontSize: 12, color: G.textSecondary }}>
                        <strong style={{ color: r.status === "CLEAN" ? G.success : r.status === "ERROR" ? G.danger : G.amber }}>Image {r.image} — {r.status}</strong>
                        {r.issues.length > 0 && <ul style={{ marginTop: 4, paddingLeft: 16 }}>{r.issues.map((issue, j) => <li key={j}>{issue}</li>)}</ul>}
                        {r.recommendations && <div style={{ marginTop: 4, color: G.textMuted }}>{r.recommendations}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="g-btn-gold" onClick={handleSubmitTask} disabled={!submitNotes.trim() || (aiReviewResults?.hasErrors ?? false)} style={{ flex: 1 }}>
                    <FileText size={14} />Submit for Review
                  </button>
                  <button className="g-btn-ghost" onClick={closeSubmitModal}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ SMART ASSIST MODAL ════ */}
        {showSmartAssist && activeTicket && (
          <SmartAssistModal
            ticket={activeTicket}
            onClose={() => { setShowSmartAssist(false); setActiveTicket(null); }}
            onSubmit={handleSmartAssistSubmit}
            isDoer={activeTicket.assignedTo === user?.email}
          />
        )}

        {/* ════ LIGHTBOX ════ */}
        {showLightbox && lightboxPhotos.length > 0 && (
          <div className="g-lightbox" onClick={() => setShowLightbox(false)}>
            <button className="g-lightbox-close" onClick={() => setShowLightbox(false)}><X size={16} /></button>
            <button className="g-lightbox-nav prev" disabled={lightboxIndex === 0} onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.max(i - 1, 0)); }}>‹</button>
            <img className="g-lightbox-img" src={lightboxPhotos[lightboxIndex]} alt={`Photo ${lightboxIndex + 1}`} onClick={(e) => e.stopPropagation()} />
            <button className="g-lightbox-nav next" disabled={lightboxIndex === lightboxPhotos.length - 1} onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1)); }}>›</button>
            <div className="g-lightbox-counter">{lightboxIndex + 1} / {lightboxPhotos.length}</div>
          </div>
        )}

        {toastMsg && <div className="g-toast">{toastMsg}</div>}
      </div>
    </>
  );
};

// ── Modal Header ──────────────────────────────────────────────────────────────
const ModalHeader: React.FC<{ title: string; sub: string; onClose: () => void }> = ({ title, sub, onClose }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 20px", borderBottom: `1px solid ${G.border}` }}>
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.textSecondary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>{sub}</div>
      <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 400, color: G.textPrimary, lineHeight: 1.2, maxWidth: 440 }}>{title}</h2>
    </div>
    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: G.surfaceHigh, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textSecondary }}>
      <X size={15} />
    </button>
  </div>
);

// ── Analytics Card ─────────────────────────────────────────────────────────────
const AnalyticsCard: React.FC<{ title: string; value: string | number; subtitle: string; color: string }> = ({ title, value, subtitle, color }) => (
  <div className="fade-up" style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 14, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textSecondary, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</div>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 300, color, lineHeight: 1, marginBottom: 8 }}>{value}</div>
    <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace" }}>{subtitle}</div>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${color}44,transparent)` }} />
  </div>
);

// ── Task Row ──────────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: Task;
  idx: number;
  staffName: string;
  isAdminAssignee: boolean;
  onReview: () => void;
  onViewHistory: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, idx, staffName, isAdminAssignee, onReview, onViewHistory }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      className="fade-up"
      style={{ animationDelay: `${idx * 55}ms`, background: hovered ? G.surfaceMid : G.surface, border: `1px solid ${hovered ? G.borderHi : task.tatBreached ? G.dangerBorder : G.border}`, borderRadius: 12, padding: "18px 22px", transition: "all 0.2s ease" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {task.tatBreached && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 12px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 7, fontSize: 11, color: G.danger, fontFamily: "'DM Mono',monospace" }}>
          <AlertTriangle size={11} /> TAT BREACH — {task.smartAssist?.delayDuration || "Overdue"}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: G.bgDeep, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 2 }}>
          {String(idx + 1).padStart(2, "0")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{task.title}</h3>
            <span className={priClass(task.priority)}><Flag size={9} />{task.priority?.toUpperCase()}</span>
            {isAdminAssignee && <span className="g-badge g-badge-gold"><Shield size={9} />ADMIN</span>}
          </div>
          <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
            {task.description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: isAdminAssignee ? G.gold : G.textSecondary }}>
              {isAdminAssignee ? <Shield size={10} color={G.gold} /> : <User size={10} />}{staffName}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={10} />{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {task.timeSlot && <span style={{ color: G.gold }}>· {task.timeSlot}</span>}
            </span>
            {task.completionNotes && <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.gold }}><FileText size={10} />Has notes</span>}
            {task.history && task.history.length > 0 && (
              <button onClick={onViewHistory} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: G.gold, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace", padding: 0 }}>
                <ListTree size={10} />History ({task.history.length})
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onReview}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: hovered ? `linear-gradient(135deg,${G.gold},${G.goldBright})` : G.surfaceHigh, color: hovered ? "#000" : G.textSecondary, border: `1px solid ${hovered ? G.gold : G.border}`, borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap", marginTop: 2, boxShadow: hovered ? `0 4px 16px ${G.goldGlow}` : "none" }}
        >
          <Eye size={12} />Review<ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;



