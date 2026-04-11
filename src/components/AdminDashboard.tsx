import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
  import { useNavigate } from "react-router-dom";
  import { useUser } from "../contexts/UserContext";
  import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
  import {
    Plus, Upload, LogOut, CheckCircle, Eye, X,
    Zap, User, ChevronRight, Calendar, Flag,
    FileText, MessageSquare, Shield, Sparkles, Loader,
    TrendingUp, Clock, Activity, BarChart3,
    GitBranch, ListTree, FolderPlus, Building2, MapPin, DollarSign,
    AlertTriangle, AlertCircle, History, Radio, Share2, RotateCw, Trash2, Bell,
  } from "lucide-react";
  import ClaudeChat from "./ClaudeChat";
  import HistoryTimeline from "./Historytimeline";
  import SmartAssistModal from "./Smartassistmodal";
  import ProgressTracker from "./Progresstracker";
  import { sendSystemDM }     from "../services/SystemNotification";
  import { greetUser, setElevenLabsVoice, announceVoice, speakText, getGlobalVoiceEnabled } from "../services/VoiceModule";
  import { uploadToCloudinary } from "../services/CloudinaryUpload";
  const roswaltLogoAsset = "https://res.cloudinary.com/donsrpgw3/image/upload/v1773638048/ROSWALT-LOGO-GOLDEN-8K_dfrfxb.png";

  void Sparkles; void RotateCw; void Radio;

  let ForwardedTaskTree: React.FC<{
    tasks: Task[];
    getNameFn: (e: string) => string;
    isAdminFn: (e: string) => boolean;
    onSelectTask: (t: Task) => void;
  }>;
  try {
    // eslint-disable-next-line
    ForwardedTaskTree = require("./ForwardedTaskTree").default;
  } catch {
    ForwardedTaskTree = () => (
      <div style={{ color: "#8a9aaa", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, padding: 24 }}>
        ForwardedTaskTree component not found.
      </div>
    );
  }

  import type { SmartAssistTicket } from "../services/SmartAssistService";
  import type { TATTask } from "../services/TATEngine";

  function computeExactDeadline(dueDate: string, timeSlot: string): string {
    if (!dueDate) return "";
    const d = new Date(dueDate + "T00:00:00");
    const m = timeSlot && timeSlot.match(/^(\d{1,2}):(\d{2})$/);
    if (m) { d.setHours(parseInt(m[1],10), parseInt(m[2],10), 0, 0); }
    else if (timeSlot === "AM") { d.setHours(9, 0, 0, 0); }
    else if (timeSlot === "Noon") { d.setHours(12, 0, 0, 0); }
    else { d.setHours(18, 0, 0, 0); }
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

  interface HistoryEntry {
    id: string;
    timestamp: string;
    action: string;
    by: string;
    to?: string;
    notes?: string;
  }

  // ── Persistent History Store ─────────────────────────────────────────────────
  // UserContext.updateTask may not persist the history field reliably.
  // We keep a separate localStorage store keyed by taskId so history is never lost.
  // History is scoped per user so one admin's history never bleeds into another's
  function getHistoryStoreKey(email?: string): string {
    return "smartcue_task_history_" + (email || "shared").toLowerCase().replace(/[^a-z0-9]/g, "_");
  }

  function loadHistoryStore(userEmail?: string): Record<string, HistoryEntry[]> {
    try { return JSON.parse(localStorage.getItem(getHistoryStoreKey(userEmail)) ?? "{}"); } catch { return {}; }
  }

  function saveHistoryStore(store: Record<string, HistoryEntry[]>, userEmail?: string): void {
    try { localStorage.setItem(getHistoryStoreKey(userEmail), JSON.stringify(store)); } catch {}
  }

  function appendHistoryEntry(taskId: string, entry: HistoryEntry, userEmail?: string): void {
    const store = loadHistoryStore(userEmail);
    store[taskId] = [...(store[taskId] ?? []), entry];
    saveHistoryStore(store, userEmail);
  }

  function getTaskHistory(taskId: string, userEmail?: string): HistoryEntry[] {
    return loadHistoryStore(userEmail)[taskId] ?? [];
  }

  function getAllHistoryEntries(userEmail?: string): (HistoryEntry & { taskId: string })[] {
    const store = loadHistoryStore(userEmail);
    return Object.entries(store).flatMap(([taskId, entries]) =>
      entries.map(e => ({ ...e, taskId }))
    );
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
    purpose?: string;
    // ── Reassignment ──────────────────────────────────────────────────────────
    previousAssignee?: string;          // email of the doer who was cancelled
    reassignedAt?: string;              // ISO timestamp of reassignment
    handoverRequested?: boolean;        // admin has triggered handover voice call
    voiceNote?: string;                  // base64 audio data URL recorded by admin
    // ── Autopulse ──────────────────────────────────────────────────────────
    isAutopulse?:          boolean;
    autopulseCycleDays?:   number;
    autopulseParentId?:    string;
    autopulseGeneration?:  number;
    // ── TAT Extension request ─────────────────────────────────────────────────
    tatExtensionRequest?: {
      requestedAt: string;
      reason: string;
      requestedNewDate: string;
      requestedNewTimeSlot: string;
      status: "pending" | "approved" | "denied";
      adminResponse?: string;
      respondedAt?: string;
    };
    // ── Prime Directive ────────────────────────────────────────────────────────
    isPrimeDirective?:        boolean;
    pdReminderIntervalHours?: number;   // how often to fire reminder (default 24)
    pdLastReminderAt?:        string;   // ISO timestamp
    pdAcknowledgedBy?:        string;   // email of acknowledger
    pdAcknowledgedAt?:        string;
    pdSnoozedUntil?:          string;   // ISO — skip reminders until this time
    pdReminderCount?:         number;
  }

  type TeamMember = { id: string; name: string; email: string; role: string; phone?: string };
  type Project    = { id: string; name: string; status?: string; projectCode?: string };

  // ── Design tokens ─────────────────────────────────────────────────────────────
  const G = {
    bg:           "rgba(4,6,14,0.55)",
    bgDeep:       "rgba(2,4,10,0.70)",
    surface:      "rgba(10,18,40,0.55)",
    surfaceMid:   "rgba(16,28,58,0.60)",
    surfaceHigh:  "rgba(22,38,78,0.65)",
    gold:         "#ffe066",
    goldBright:   "#fff3a0",
    goldDim:      "rgba(255,224,102,0.14)",
    goldGlow:     "rgba(255,224,102,0.45)",
    goldBorder:   "rgba(255,224,102,0.45)",
    goldBorderHi: "rgba(255,224,102,0.70)",
    border:       "rgba(255,255,255,0.12)",
    borderHi:     "rgba(255,255,255,0.28)",
    success:       "#00f5a0",
    successDim:    "rgba(0,245,160,0.12)",
    successBorder: "rgba(0,245,160,0.35)",
    danger:        "#ff2d55",
    dangerDim:     "rgba(255,45,85,0.14)",
    dangerBorder:  "rgba(255,45,85,0.40)",
    amber:         "#ff9f0a",
    amberDim:      "rgba(255,159,10,0.14)",
    cyan:          "#00d4ff",
    cyanDim:       "rgba(0,212,255,0.12)",
    purple:        "#bf5fff",
    purpleDim:     "rgba(191,95,255,0.14)",
    pink:          "#ff375f",
    pinkDim:       "rgba(255,55,95,0.12)",
    lime:          "#39ff14",
    limeDim:       "rgba(57,255,20,0.10)",
    textPrimary:   "#f0f4ff",
    textSecondary: "#b8c8e8",
    textMuted:     "#7890b0",
  };

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: transparent; color: ${G.textPrimary}; font-family: 'Poppins', sans-serif; -webkit-font-smoothing: antialiased; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${G.cyan}55; border-radius: 99px; }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
    @keyframes scaleIn  { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
    @keyframes shimmer  { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
    @keyframes gradient-shift { 0% { background-position: 0% center; } 50% { background-position: 100% center; } 100% { background-position: 0% center; } }
    @keyframes glow-cyan { 0%,100% { box-shadow:0 0 18px ${G.cyan}77, 0 0 36px ${G.purple}44; } 50% { box-shadow:0 0 28px ${G.cyan}99, 0 0 56px ${G.purple}66; } }
    @keyframes spin     { to { transform:rotate(360deg); } }
    @keyframes progressBar { 0%{width:0%;} 50%{width:100%;} 100%{width:0%;} }
    @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes tatPulse { 0%,100%{box-shadow:0 0 0 0 ${G.danger}77;} 50%{box-shadow:0 0 0 8px ${G.danger}00;} }
    @keyframes neon-border { 0%,100%{border-color:${G.cyan}66;} 50%{border-color:${G.purple}88;} }
    @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }
    .fade-up  { animation: fadeUp  0.5s ease both; }
    .fade-in  { animation: fadeIn  0.35s ease both; }
    .scale-in { animation: scaleIn 0.3s  ease both; }
    .spin     { animation: spin 1s linear infinite; }
    .shimmer  { animation: shimmer 2s ease infinite; }
    .glow     { animation: glow-cyan 3s ease infinite; }
    .pulse    { animation: pulse 2s ease infinite; }
    .tat-pulse{ animation: tatPulse 2s ease infinite; }
    .float    { animation: float 4s ease infinite; }
    input:focus, textarea:focus, select:focus { outline: none; }
    input::placeholder, textarea::placeholder { color: ${G.textMuted}; }
    select option { background: #0d1a35; color: ${G.textPrimary}; }
    optgroup { color: ${G.textSecondary}; font-family: 'Poppins', sans-serif; font-size: 11px; }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8) brightness(1.4) hue-rotate(160deg); cursor: pointer; }

    .g-btn-gold { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, ${G.cyan} 0%, #0099cc 50%, ${G.cyan} 100%); color: #001a26; font-weight:800; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; border:none; border-radius:8px; font-family:'Oswald',sans-serif; cursor:pointer; transition: all 0.2s ease; box-shadow: 0 0 20px ${G.cyan}66, 0 4px 16px rgba(0,212,255,0.4), inset 0 1px 0 rgba(255,255,255,0.3); }
    .g-btn-gold:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 0 32px ${G.cyan}88, 0 8px 24px rgba(0,212,255,0.5); }
    .g-btn-gold:disabled { opacity:0.35; cursor:not-allowed; }
    .g-btn-ghost { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: rgba(255,255,255,0.06); color: ${G.textPrimary}; border: 1px solid rgba(255,255,255,0.14); border-radius:8px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition: all 0.2s ease; backdrop-filter: blur(8px); }
    .g-btn-ghost:hover { border-color:${G.cyan}55; background:rgba(0,212,255,0.08); color:${G.cyan}; }
    .g-btn-success { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #00c87a, ${G.success}); color:#001a0e; border:none; border-radius:8px; font-family:'Oswald',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:all 0.2s ease; box-shadow: 0 0 18px ${G.success}55, 0 4px 12px rgba(0,245,160,0.3); }
    .g-btn-success:hover { transform:translateY(-2px); box-shadow: 0 0 28px ${G.success}77; }
    .g-btn-danger { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #cc0033, ${G.danger}); color:#fff; border:none; border-radius:8px; font-family:'Oswald',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:all 0.2s ease; box-shadow: 0 0 18px ${G.danger}55, 0 4px 12px rgba(255,45,85,0.3); }
    .g-btn-danger:hover { transform:translateY(-2px); box-shadow: 0 0 28px ${G.danger}77; }
    .g-btn-ai { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 16px; background: rgba(191,95,255,0.15); color:${G.purple}; border: 1px solid rgba(191,95,255,0.40); border-radius:8px; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-ai:hover:not(:disabled) { background:rgba(191,95,255,0.28); border-color:rgba(191,95,255,0.7); transform:translateY(-1px); box-shadow: 0 0 16px ${G.purple}55; }
    .g-btn-ai:disabled { opacity:0.35; cursor:not-allowed; }
    .g-btn-review-att { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 16px; background: rgba(0,245,160,0.12); color:${G.success}; border: 1px solid rgba(0,245,160,0.35); border-radius:8px; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-review-att:hover:not(:disabled) { background:rgba(0,245,160,0.25); border-color:rgba(0,245,160,0.65); transform:translateY(-1px); box-shadow: 0 0 16px ${G.success}55; }
    .g-btn-review-att:disabled { opacity:0.35; cursor:not-allowed; }
    .g-btn-delete { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 14px; background: rgba(255,45,85,0.10); color:${G.danger}; border: 1px solid ${G.dangerBorder}; border-radius:8px; font-family:'Poppins',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-delete:hover { background:rgba(255,45,85,0.22); border-color:${G.danger}; transform:translateY(-1px); box-shadow: 0 0 14px ${G.danger}44; }

    .g-input { width:100%; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:12px 14px; color:${G.textPrimary}; font-size:14px; font-family:'Poppins',sans-serif; transition: border-color 0.2s, box-shadow 0.2s; backdrop-filter: blur(6px); }
    .g-input:focus { border-color:${G.cyan}66; box-shadow:0 0 0 3px rgba(0,212,255,0.15), inset 0 0 0 1px rgba(0,212,255,0.25); }
    .g-label { display:block; font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:${G.textMuted}; margin-bottom:8px; font-family:'IBM Plex Mono',monospace; }
    .g-card { background:${G.surface}; border:1px solid rgba(255,255,255,0.10); border-radius:14px; transition: border-color 0.2s, background 0.2s; backdrop-filter: blur(16px); }
    .g-card:hover { border-color:rgba(0,212,255,0.30); background:${G.surfaceMid}; }

    .g-stat-card { background: linear-gradient(135deg, rgba(10,18,40,0.60) 0%, rgba(16,28,58,0.65) 100%); border:1px solid rgba(255,255,255,0.10); border-radius:16px; padding:22px 24px; position:relative; overflow:hidden; transition: all 0.25s ease; backdrop-filter: blur(20px); cursor: pointer; }
    .g-stat-card:hover { border-color:${G.cyan}55; transform:translateY(-5px); box-shadow: 0 12px 40px rgba(0,212,255,0.20), 0 0 30px rgba(0,212,255,0.10); }
    .g-stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background: linear-gradient(90deg, transparent, ${G.cyan}, ${G.purple}, ${G.cyan}, transparent); opacity:0.9; }

    .g-overlay { position:fixed; inset:0; background:rgba(0,0,6,0.80); backdrop-filter:blur(18px); z-index:100; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.25s ease; }
    .g-modal { background: linear-gradient(160deg, rgba(16,26,56,0.92) 0%, rgba(10,18,40,0.95) 100%); border:1px solid rgba(255,255,255,0.12); border-radius:20px; width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:scaleIn 0.3s ease; box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12); backdrop-filter: blur(24px); }
    .g-modal-wide { max-width: 920px; }

    .g-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:600; letter-spacing:0.07em; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; }
    .g-badge-gold  { background:${G.goldDim};    color:${G.gold};    border:1px solid ${G.goldBorder}; }
    .g-badge-green { background:${G.successDim}; color:${G.success}; border:1px solid ${G.successBorder}; }
    .g-badge-red   { background:${G.dangerDim};  color:${G.danger};  border:1px solid ${G.dangerBorder}; }
    .g-badge-muted { background:rgba(255,255,255,0.05); color:${G.textSecondary}; border:1px solid rgba(255,255,255,0.12); }
    .pri-high   { background:${G.dangerDim};  color:${G.danger};  border:1px solid ${G.dangerBorder}; }
    .pri-medium { background:rgba(0,212,255,0.10); color:${G.cyan};  border:1px solid rgba(0,212,255,0.35); }
    .pri-low    { background:${G.successDim}; color:${G.success}; border:1px solid ${G.successBorder}; }

    .g-drop { border:2px dashed rgba(255,255,255,0.15); border-radius:12px; padding:24px 16px; text-align:center; cursor:pointer; transition:all 0.2s ease; background:rgba(0,0,0,0.20); }
    .g-drop:hover, .g-drop.drag-over { border-color:${G.cyan}66; background:rgba(0,212,255,0.06); }
    .ai-progress-fill { height:100%; border-radius:3px; background: linear-gradient(90deg, ${G.success}, ${G.cyan}, ${G.purple}, ${G.success}); background-size: 200% 100%; animation: progressBar 1.8s ease-in-out infinite; }
    .glow-dot { width:7px; height:7px; border-radius:50%; animation:shimmer 2s ease infinite; }

    .g-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background: linear-gradient(135deg, rgba(16,28,58,0.95), rgba(22,38,78,0.95)); border:1px solid ${G.cyan}55; border-radius:99px; padding:12px 28px; font-family:'IBM Plex Mono',monospace; font-size:12px; color:${G.textPrimary}; z-index:9999; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 24px ${G.cyan}33; animation:fadeUp 0.3s ease; backdrop-filter: blur(16px); }

    .g-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.96); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
    .g-lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 12px; object-fit: contain; box-shadow: 0 0 60px rgba(0,212,255,0.2), 0 40px 80px rgba(0,0,0,0.9); animation: scaleIn 0.25s ease; }
    .g-lightbox-close { position: absolute; top: 20px; right: 24px; width: 40px; height: 40px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 50%; color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; }
    .g-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; background: rgba(0,212,255,0.10); border: 1px solid rgba(0,212,255,0.25); border-radius: 50%; color: ${G.cyan}; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .g-lightbox-nav.prev { left: 20px; } .g-lightbox-nav.next { right: 20px; }
    .g-lightbox-nav:disabled { opacity: 0.2; cursor: not-allowed; }
    .g-lightbox-counter { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.1em; }

    .tat-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.07em; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; background:${G.dangerDim}; color:${G.danger}; border:1px solid ${G.dangerBorder}; animation:tatPulse 2s ease infinite; }

    .g-dt-row { display:flex; gap:0; align-items:stretch; border:1px solid rgba(255,255,255,0.12); border-radius:8px; overflow:hidden; background:rgba(0,0,0,0.40); }
    .g-dt-row input[type="date"] { flex:1; background:transparent; border:none; padding:12px 14px; color:${G.textPrimary}; font-size:14px; font-family:'Poppins',sans-serif; min-width:0; }
    .g-dt-row input[type="date"]:focus { outline:none; box-shadow: inset 0 0 0 2px rgba(0,212,255,0.3); }
    .g-dt-row select { appearance: none; padding-right: 32px !important; }

    .g-slot-btn { padding:0 13px; background:transparent; border:none; border-left:1px solid rgba(255,255,255,0.10); color:${G.textMuted}; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600; letter-spacing:0.09em; cursor:pointer; transition:all 0.15s ease; white-space:nowrap; }
    .g-slot-btn:first-child { border-left: none; }
    .g-slot-btn.active { background:linear-gradient(135deg, rgba(0,212,255,0.25), rgba(191,95,255,0.18)); color:${G.cyan}; font-weight:700; box-shadow: inset 0 0 0 1.5px rgba(0,212,255,0.45); }
    .g-slot-btn:hover:not(.active) { color:${G.textSecondary}; background:rgba(255,255,255,0.04); }

    .admin-avatar { width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, ${G.cyan}, ${G.purple}); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid rgba(0,212,255,0.45); cursor: pointer; transition: all 0.3s ease; position: relative; }
    .admin-avatar:hover { transform: scale(1.06); box-shadow: 0 0 20px ${G.cyan}66; }
    .admin-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .admin-avatar-placeholder { font-size: 22px; color: #fff; }

    .g-task-list-modal { max-width: 860px; max-height: 88vh; }
    .task-list-item { padding: 14px 18px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; background: rgba(255,255,255,0.03); transition: all 0.2s ease; margin-bottom: 8px; }
    .task-list-item:hover { border-color: ${G.cyan}44; background: rgba(0,212,255,0.05); }

    .neon-divider { height: 1px; background: linear-gradient(90deg, transparent, ${G.cyan}, ${G.purple}, ${G.cyan}, transparent); opacity: 0.6; margin: 0; }

    .g-btn-reassign { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 14px; background: rgba(0,212,255,0.10); color:${G.cyan}; border: 1px solid rgba(0,212,255,0.35); border-radius:8px; font-family:'Poppins',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-reassign:hover { background:rgba(0,212,255,0.22); border-color:${G.cyan}; transform:translateY(-1px); box-shadow: 0 0 14px ${G.cyan}44; }
    .tat-ext-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.07em; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; background:rgba(255,159,10,0.14); color:${G.amber}; border:1px solid rgba(255,159,10,0.45); animation:shimmer 2s ease infinite; }
    .handover-banner { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(191,95,255,0.10); border:1px solid rgba(191,95,255,0.35); border-radius:8px; font-size:12px; color:${G.purple}; font-family:'IBM Plex Mono',monospace; margin-bottom:10px; }

    .g-confirm-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(20px); z-index:200; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease; }
    .g-confirm-box { background:linear-gradient(160deg,rgba(20,8,28,0.98),rgba(10,4,20,0.99)); border:1px solid ${G.dangerBorder}; border-radius:20px; padding:36px 40px; max-width:440px; width:100%; text-align:center; box-shadow:0 0 60px ${G.danger}22, 0 40px 80px rgba(0,0,0,0.9); animation:scaleIn 0.25s ease; }
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

  interface DateTimePickerProps {
    label?: string;
    required?: boolean;
    dateValue: string;
    timeSlot: string;
    onDateChange: (v: string) => void;
    onTimeSlotChange: (v: string) => void;
    hideDateInput?: boolean;
  }

  // ── Scroll-Wheel Time Picker (like iOS) ───────────────────────────────────
  const ScrollTimePicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
    const parse = (v: string) => {
      const m = v && v.match(/^(\d{1,2}):(\d{2})$/);
      if (m) return { h: parseInt(m[1], 10), min: parseInt(m[2], 10) };
      // legacy AM/PM/Noon fallback
      if (v === "AM") return { h: 9, min: 0 };
      if (v === "Noon") return { h: 12, min: 0 };
      return { h: 18, min: 0 };
    };
    const { h, min } = parse(value);
    const isAM = h < 12;
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;

    const emit = (newH24: number, newMin: number) => {
      onChange(String(newH24).padStart(2,"0") + ":" + String(newMin).padStart(2,"0"));
    };
    const setHour = (hh12: number) => {
      const h24 = isAM ? (hh12 === 12 ? 0 : hh12) : (hh12 === 12 ? 12 : hh12 + 12);
      emit(h24, min);
    };
    const setMin = (mm: number) => {
      emit(h, mm);
    };
    const setAmPm = (ap: string) => {
      let h24 = h % 12;
      if (ap === "PM") h24 += 12;
      emit(h24, min);
    };

    const hours12 = [12,1,2,3,4,5,6,7,8,9,10,11];
    const minutes = [0,5,10,15,20,25,30,35,40,45,50,55];

    const colStyle: React.CSSProperties = {
      display: "flex", flexDirection: "column", alignItems: "center",
      height: 150, overflowY: "scroll", scrollSnapType: "y mandatory",
      msOverflowStyle: "none",
      padding: "55px 0", gap: 2,
    };
    const itemBase: React.CSSProperties = {
      scrollSnapAlign: "center", minHeight: 38, width: 58,
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 9, cursor: "pointer", transition: "all 0.15s",
      flexShrink: 0,
    };

    return (
      <div>
        {/* Label row */}
        <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: G.cyan, fontWeight: 700 }}>
            {String(displayH).padStart(2,"0")}:{String(min).padStart(2,"0")} {isAM ? "AM" : "PM"}
          </span>
          <span style={{ opacity: 0.4 }}>— scroll to set time</span>
        </div>
        <div style={{
          display: "flex", gap: 4, alignItems: "center",
          background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14, padding: "0 8px", position: "relative", overflow: "hidden",
          userSelect: "none",
        }}>
          {/* Selection highlight band */}
          <div style={{
            position: "absolute", top: "50%", left: 0, right: 0, height: 40,
            transform: "translateY(-50%)",
            background: "rgba(0,212,255,0.07)",
            borderTop: "1px solid rgba(0,212,255,0.2)",
            borderBottom: "1px solid rgba(0,212,255,0.2)",
            pointerEvents: "none", zIndex: 1,
          }} />

          {/* HOURS column */}
          <div style={{ ...colStyle, scrollbarWidth: "none" }}>
            {hours12.map(hh => {
              const active = hh === displayH;
              return (
                <div key={hh} onClick={() => setHour(hh)} style={{
                  ...itemBase,
                  fontSize: active ? 22 : 16,
                  fontWeight: active ? 900 : 400,
                  color: active ? "#00d4ff" : "rgba(255,255,255,0.25)",
                  background: active ? "rgba(0,212,255,0.12)" : "transparent",
                  border: active ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
                  fontFamily: "'Space Grotesk',sans-serif",
                  transform: active ? "scale(1.08)" : "scale(1)",
                  zIndex: active ? 2 : 0,
                }}>
                  {String(hh).padStart(2,"0")}
                </div>
              );
            })}
          </div>

          {/* Colon separator */}
          <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.3)", paddingBottom: 4, zIndex: 2 }}>:</div>

          {/* MINUTES column */}
          <div style={{ ...colStyle, scrollbarWidth: "none" }}>
            {minutes.map(mm => {
              const active = mm === min || (min < 5 && mm === 0) || (min >= 5 && min < 10 && mm === 5);
              const exactActive = mm === min;
              return (
                <div key={mm} onClick={() => setMin(mm)} style={{
                  ...itemBase,
                  fontSize: exactActive ? 22 : 16,
                  fontWeight: exactActive ? 900 : 400,
                  color: exactActive ? "#00d4ff" : "rgba(255,255,255,0.25)",
                  background: exactActive ? "rgba(0,212,255,0.12)" : "transparent",
                  border: exactActive ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
                  fontFamily: "'Space Grotesk',sans-serif",
                  transform: exactActive ? "scale(1.08)" : "scale(1)",
                  zIndex: exactActive ? 2 : 0,
                }}>
                  {String(mm).padStart(2,"0")}
                </div>
              );
            })}
          </div>

          {/* AM / PM column */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, padding: "0 6px", zIndex: 2 }}>
            {["AM","PM"].map(ap => {
              const active = (ap === "AM" && isAM) || (ap === "PM" && !isAM);
              return (
                <div key={ap} onClick={() => setAmPm(ap)} style={{
                  width: 52, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 9, cursor: "pointer",
                  fontSize: active ? 15 : 13, fontWeight: active ? 900 : 500,
                  color: active ? "#00d4ff" : "rgba(255,255,255,0.3)",
                  background: active ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.03)",
                  border: active ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.05em",
                  transition: "all 0.15s",
                  boxShadow: active ? "0 0 12px rgba(0,212,255,0.25)" : "none",
                }}>
                  {ap}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const DateTimePicker: React.FC<DateTimePickerProps> = ({
    label, required, dateValue, timeSlot, onDateChange, onTimeSlotChange, hideDateInput,
  }) => (
    <div>
      {label && <label className="g-label">{label}{required ? " *" : ""}</label>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!hideDateInput && (
          <input type="date" value={dateValue} onChange={(e) => onDateChange(e.target.value)}
            className="g-input" style={{ colorScheme: "dark" } as React.CSSProperties} />
        )}
        <ScrollTimePicker
          value={timeSlot || "18:00"}
          onChange={onTimeSlotChange}
        />
      </div>
    </div>
  );

  // ── Task List Modal ────────────────────────────────────────────────────────────
  interface TaskListModalProps {
    title: string;
    tasks: Task[];
    getNameFn: (e: string) => string;
    onClose: () => void;
    onSelectTask?: (t: Task) => void;
    onDeleteTask?: (t: Task) => void;
    accentColor?: string;
  }

  const TaskListModal: React.FC<TaskListModalProps> = ({ title, tasks, getNameFn, onClose, onSelectTask, onDeleteTask, accentColor = G.cyan }) => (
    <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="g-modal g-task-list-modal" style={{ animation: "scaleIn 0.28s ease" }}>
        <div style={{ padding: "24px 28px 18px", borderBottom: `1px solid rgba(255,255,255,0.10)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Task List</div>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary }}>{title}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 99, padding: "3px 12px" }}>
                {tasks.length} tasks
              </span>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textSecondary }}>
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding: "20px 28px 28px", overflowY: "auto", maxHeight: "calc(88vh - 110px)" }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18, color: G.textMuted }}>No tasks in this category</div>
            </div>
          ) : (
            tasks.map((task, idx) => {
              const ac = APPROVAL_COLORS[task.approvalStatus] || G.textMuted;
              return (
                <div key={task.id} className="task-list-item fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, cursor: onSelectTask ? "pointer" : "default" }} onClick={() => onSelectTask?.(task)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, fontWeight: 600, color: G.textPrimary }}>{task.title}</span>
                        <span className={priClass(task.priority)}><Flag size={8} />{task.priority.toUpperCase()}</span>
                        <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                      </div>
                      <p style={{ fontSize: 12, color: G.textMuted, lineHeight: 1.5, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                        {task.description}
                      </p>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={9} />{getNameFn(task.assignedTo)}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={9} />{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        {task.timeSlot && <span style={{ color: G.gold }}>· {task.timeSlot}</span>}
                        {task.tatBreached && <span style={{ color: G.danger, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={9} />TAT BREACH</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                      {onSelectTask && (
                        <div style={{ color: G.textMuted, cursor: "pointer" }} onClick={() => onSelectTask(task)}><ChevronRight size={14} /></div>
                      )}
                      {onDeleteTask && (
                        <button
                          className="g-btn-delete"
                          style={{ padding: "6px 10px" }}
                          onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  // ── Confirm Delete Modal ───────────────────────────────────────────────────────
  interface ConfirmDeleteProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }
  const ConfirmDeleteModal: React.FC<ConfirmDeleteProps> = ({ message, onConfirm, onCancel }) => (
    <div className="g-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="g-confirm-box">
        <div style={{ width: 56, height: 56, borderRadius: 14, background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Trash2 size={24} color={G.danger} />
        </div>
        <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary, marginBottom: 12 }}>Confirm Delete</h3>
        <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 28 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="g-btn-danger" onClick={onConfirm} style={{ flex: 1 }}><Trash2 size={14} />Delete</button>
          <button className="g-btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );

  // ── Admin Flash Briefing Panel ────────────────────────────────────────────────
  interface AdminFlashPanelProps {
    adminName: string;
    allTasks: Task[];
    pendingTickets: import("../contexts/UserContext").AssistanceTicket[];
    onClose: () => void;
    onNavigate: (tab: string) => void;
  }

  const AdminFlashPanel: React.FC<AdminFlashPanelProps> = ({ adminName, allTasks, pendingTickets, onClose, onNavigate }) => {
    const [visible, setVisible] = useState(false);

    const pendingReview = allTasks.filter(t => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending");
    const inProgress    = allTasks.filter(t => t.approvalStatus === "in-review" || t.approvalStatus === "admin-approved");
    const approved      = allTasks.filter(t => t.approvalStatus === "superadmin-approved");
    const tatBreached   = allTasks.filter(t => (t as any).tatBreached);
    const frozenTasks   = allTasks.filter(t => (t as any).isFrozen);

    useEffect(() => { setTimeout(() => setVisible(true), 80); }, []);

    const handleClose = () => { setVisible(false); setTimeout(onClose, 320); };
    const handleNav   = (tab: string) => { handleClose(); setTimeout(() => onNavigate(tab), 340); };

    const stats = [
      { label: "All Tasks",      value: allTasks.length,       color: G.cyan,    icon: "◈" },
      { label: "Pending Review", value: pendingReview.length,  color: G.gold,    icon: "⏳" },
      { label: "In Progress",    value: inProgress.length,     color: G.purple,  icon: "⚡" },
      { label: "Approved",       value: approved.length,       color: G.success, icon: "✓" },
      { label: "TAT Breached",   value: tatBreached.length,    color: G.danger,  icon: "⚠" },
      { label: "Frozen",         value: frozenTasks.length,    color: "#b06af3", icon: "🔒" },
      { label: "Tickets",        value: pendingTickets.length, color: G.amber,   icon: "🎫" },
    ];

    return (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(18px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, opacity: visible ? 1 : 0, transition: "opacity 0.32s ease" }}
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div style={{
          background: "rgba(4,8,22,0.98)", border: `1px solid ${G.cyan}33`, borderRadius: 22,
          padding: 0, maxWidth: 660, width: "100%", maxHeight: "90vh", overflowY: "auto",
          boxShadow: `0 40px 100px rgba(0,0,0,0.95), 0 0 80px ${G.cyan}0d, inset 0 1px 0 rgba(255,255,255,0.05)`,
          transform: visible ? "translateY(0) scale(1)" : "translateY(28px) scale(0.96)",
          transition: "transform 0.34s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {/* Header */}
          <div style={{ padding: "24px 28px 20px", borderBottom: `1px solid rgba(255,255,255,0.06)`, background: `linear-gradient(135deg,${G.cyan}08,${G.purple}08)`, borderRadius: "22px 22px 0 0", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 130, height: 130, borderRadius: "50%", background: `${G.cyan}08`, filter: "blur(35px)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, background: `${G.cyan}18`, border: `1px solid ${G.cyan}40`, fontSize: 9, fontWeight: 800, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "1.2px", marginBottom: 12 }}>
                  <Zap size={8} /> Admin Live Briefing
                </div>
                <div style={{ fontSize: 23, fontWeight: 800, color: G.textPrimary, letterSpacing: "-0.5px", fontFamily: "'Oswald',sans-serif", lineHeight: 1.15 }}>
                  Welcome back, <span style={{ color: G.cyan }}>{adminName}</span>
                </div>
                <div style={{ fontSize: 12, color: G.textMuted, marginTop: 7 }}>Here's your team's workload snapshot — act on urgent items first.</div>
              </div>
              <button onClick={handleClose}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, width: 34, height: 34, color: G.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, transition: "all 0.18s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = G.danger; (e.currentTarget as HTMLButtonElement).style.borderColor = `${G.danger}55`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = G.textMuted; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
              >✕</button>
            </div>
            {/* Stat pills */}
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 20 }}>
              {stats.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, background: `${s.color}12`, border: `1px solid ${s.color}38` }}>
                  <span style={{ fontSize: 11, color: s.color }}>{s.icon}</span>
                  <span style={{ fontSize: 19, fontWeight: 900, color: s.color, fontFamily: "'Oswald',sans-serif", lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 9, color: G.textMuted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Tickets */}
          {pendingTickets.length > 0 && (
            <div style={{ padding: "20px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${G.amber}22` }}>
                <span style={{ fontSize: 14 }}>🎫</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: G.amber, textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>Assistance Tickets — Awaiting Your Review</span>
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: `${G.amber}22`, border: `1px solid ${G.amber}55`, fontSize: 9, color: G.amber, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, padding: "0 4px", animation: "pulse-dot 1.5s ease-in-out infinite" }}>{pendingTickets.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {pendingTickets.slice(0, 5).map(ticket => (
                  <div key={ticket.id} style={{ padding: "12px 14px", borderRadius: 11, background: `${G.amber}08`, border: `1px solid ${G.amber}22`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${G.amber}18`, color: G.amber, fontWeight: 700, textTransform: "uppercase" as const, border: `1px solid ${G.amber}40` }}>{ticket.id}</span>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${G.purple}18`, color: G.purple, fontWeight: 700, textTransform: "uppercase" as const, border: `1px solid ${G.purple}40` }}>Pending Review</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: G.textPrimary, marginBottom: 2 }}>{ticket.taskTitle}</div>
                      <div style={{ fontSize: 10, color: G.textMuted }}>Staff: <span style={{ color: G.textSecondary }}>{ticket.assignedTo}</span> · Raised: <span style={{ color: G.textSecondary }}>{new Date(ticket.raisedAt).toLocaleDateString()}</span></div>
                      {ticket.staffNote && <div style={{ marginTop: 5, fontSize: 10, color: G.textSecondary, fontStyle: "italic", borderLeft: `2px solid ${G.amber}44`, paddingLeft: 8 }}>"{ticket.staffNote.slice(0, 100)}{ticket.staffNote.length > 100 ? "…" : ""}"</div>}
                    </div>
                    <button onClick={() => handleNav("tickets")}
                      style={{ padding: "6px 12px", background: `${G.amber}18`, border: `1px solid ${G.amber}44`, borderRadius: 7, color: G.amber, fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" as const, letterSpacing: "0.4px", flexShrink: 0, transition: "all 0.18s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${G.amber}30`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${G.amber}18`; }}
                    >Review →</button>
                  </div>
                ))}
                {pendingTickets.length > 5 && <div style={{ textAlign: "center" as const, fontSize: 11, color: G.textMuted, padding: "4px 0" }}>+{pendingTickets.length - 5} more tickets awaiting review</div>}
              </div>
            </div>
          )}

          {/* TAT Breached */}
          {tatBreached.length > 0 && (
            <div style={{ padding: pendingTickets.length > 0 ? "0 28px 20px" : "20px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingTop: pendingTickets.length > 0 ? 14 : 0, borderTop: pendingTickets.length > 0 ? `1px solid ${G.danger}18` : "none", paddingBottom: 10, borderBottom: `1px solid ${G.danger}18` }}>
                <AlertTriangle size={13} color={G.danger} />
                <span style={{ fontSize: 11, fontWeight: 800, color: G.danger, textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>TAT Breached — Urgent</span>
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: `${G.danger}20`, border: `1px solid ${G.danger}55`, fontSize: 9, color: G.danger, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, padding: "0 4px" }}>{tatBreached.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 7 }}>
                {tatBreached.slice(0, 4).map(task => (
                  <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: `${G.danger}07`, border: `1px solid ${G.danger}20` }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: G.danger, boxShadow: `0 0 8px ${G.danger}` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: G.textPrimary }}>{task.title}</div>
                      <div style={{ fontSize: 10, color: G.textMuted }}>Assigned to: <span style={{ color: G.textSecondary }}>{task.assignedTo}</span> · Due: <span style={{ color: G.danger }}>{new Date(task.dueDate).toLocaleDateString()}</span></div>
                    </div>
                    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `${G.danger}18`, color: G.danger, fontWeight: 700, textTransform: "uppercase" as const, border: `1px solid ${G.danger}35`, flexShrink: 0 }}>BREACH</span>
                  </div>
                ))}
                {tatBreached.length > 4 && <div style={{ textAlign: "center" as const, fontSize: 11, color: G.textMuted, padding: "4px 0" }}>+{tatBreached.length - 4} more</div>}
              </div>
            </div>
          )}

          {/* All Tasks list */}
          <div style={{ padding: "0 28px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.05)`, paddingBottom: 10, borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "0.8px" }}>All Assigned Tasks</span>
            </div>
            {allTasks.filter(t => t.approvalStatus !== "superadmin-approved").length === 0 ? (
              <div style={{ textAlign: "center" as const, padding: 24, fontSize: 13, color: G.textMuted }}>🎉 All tasks approved — team is caught up!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 7 }}>
                {allTasks.filter(t => t.approvalStatus !== "superadmin-approved").slice(0, 8).map(task => {
                  const isTat = (task as any).tatBreached;
                  const isFrz = (task as any).isFrozen;
                  const dot   = isTat ? G.danger : isFrz ? "#b06af3" : task.approvalStatus === "in-review" ? G.purple : G.gold;
                  return (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: isTat ? `${G.danger}06` : isFrz ? "rgba(176,106,243,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isTat ? `${G.danger}20` : isFrz ? "rgba(176,106,243,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: dot, boxShadow: `0 0 7px ${dot}` }} />
                      <div style={{ flex: 1, fontSize: 12, color: G.textSecondary, fontWeight: 500 }}>{task.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        {isFrz && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "rgba(176,106,243,0.14)", color: "#b06af3", fontWeight: 700, textTransform: "uppercase" as const, border: "1px solid rgba(176,106,243,0.3)" }}>FROZEN</span>}
                        {isTat && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: `${G.danger}14`, color: G.danger, fontWeight: 700, textTransform: "uppercase" as const, border: `1px solid ${G.danger}35` }}>BREACH</span>}
                        <span style={{ fontSize: 10, color: G.textMuted }}>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
                {allTasks.filter(t => t.approvalStatus !== "superadmin-approved").length > 8 && (
                  <div style={{ textAlign: "center" as const, fontSize: 11, color: G.textMuted, padding: "4px 0" }}>+{allTasks.filter(t => t.approvalStatus !== "superadmin-approved").length - 8} more tasks</div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 28px", borderTop: `1px solid rgba(255,255,255,0.05)`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 10, color: G.textMuted }}>
              {pendingTickets.length > 0
                ? <span style={{ color: G.amber }}>⚠ {pendingTickets.length} ticket{pendingTickets.length > 1 ? "s" : ""} need your attention</span>
                : <span style={{ color: G.success }}>✓ No pending tickets</span>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {pendingTickets.length > 0 && (
                <button onClick={() => handleNav("tickets")}
                  style={{ padding: "10px 18px", background: `linear-gradient(135deg,${G.amber}22,${G.amber}10)`, border: `1px solid ${G.amber}44`, borderRadius: 9, color: G.amber, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                  Review Tickets
                </button>
              )}
              <button onClick={handleClose}
                style={{ padding: "10px 22px", background: `linear-gradient(135deg,${G.purple},${G.cyan})`, border: "none", borderRadius: 9, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" as const, letterSpacing: "0.6px", boxShadow: `0 0 24px ${G.cyan}30` }}>
                Let's Go →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Main Component ─────────────────────────────────────────────────────────────
  const AdminDashboard: React.FC = () => {
    const {
      getTasksForAdminReview, getAssignedTasks, submitTaskCompletion,
      adminReviewTask, logout, user, teamMembers, addTask, projects, updateTask,
      deleteTask, deleteAllTasks, tasks: allContextTasks,
      assistanceTickets, approveAssistanceTicket, raiseAssistanceTicket,
      rejectAssistanceTicket,
    } = useUser() as ReturnType<typeof useUser> & {
      deleteTask: (id: string) => void;
      deleteAllTasks: () => void;
      tasks: Task[];
      assistanceTickets: import("../contexts/UserContext").AssistanceTicket[];
      approveAssistanceTicket: (ticketId: string, adminComment: string) => void;
      rejectAssistanceTicket: (ticketId: string, reason: string) => void;
      raiseAssistanceTicket: (ticket: any) => void;
    };

    // ── One-time clear of stale localStorage history (now using MongoDB as source of truth) ──
    useEffect(() => {
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith("smartcue_task_history_")) localStorage.removeItem(k);
        });
      } catch {}
    }, []); // runs once on mount

    // ── Live polling: fetch tasks directly from backend every 15s ───────────
    const [liveTasks, setLiveTasks] = React.useState<Task[] | null>(null);
    const tasksLoaded = liveTasks !== null; // true once first poll returns
    const freshTasks = React.useMemo<Task[]>(
      () => (liveTasks ?? (allContextTasks as Task[])),
      [liveTasks, allContextTasks]
    );
    useEffect(() => {
      const poll = () =>
        fetch("https://api.roswaltsmartcue.com/api/tasks")
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then((data: any[]) => {
            const mapped = data.map((t: any) => ({ ...t, id: t.id || String(t._id) }));
            setLiveTasks(mapped);
            console.log(`[Poll] ${mapped.length} tasks loaded from backend`);
          })
          .catch(err => console.warn("[Poll] Failed to fetch tasks:", err));
      poll(); // immediate on mount
      const iv = setInterval(poll, 8000); // every 8s
      return () => clearInterval(iv);
    }, [user?.email]); // re-poll when user changes (login/logout)

    const navigate = useNavigate();

    const allMembers     = teamMembers as TeamMember[];
    const activeProjects = (projects as Project[]).filter((p) => !p.status || p.status === "active");

    // ── Vinay-only: project portfolio drill-down ──────────────────────────────
    const isVinay = (user?.email ?? "").toLowerCase() === "vinay.vanmali@roswalt.com";
    const [selectedProject, setSelectedProject] = useState<any>(null);

    const [activeTab,       setActiveTab]       = useState("analytics");
    const [showCreateModal, setShowCreateModal] = useState(false);
    // ── Voice module toggle — gate lives in VoiceModule itself ─────────────
    const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => getGlobalVoiceEnabled());

    // Load voice preference on login
    useEffect(() => {
      if (!user?.email) return;
      setVoiceEnabled(getGlobalVoiceEnabled());
    }, [user?.email]);

    const toggleVoice = () => {
      setVoiceEnabled(prev => {
        const next = !prev;
        // TODO: Implement save to MongoDB + localStorage if needed (e.g., via API call)
        return next;
      });
    };
    const [showAIPanel,     setShowAIPanel]     = useState(false);
    const [toastMsg,        setToastMsg]        = useState<string | null>(null);
    const [adminProfileImg, setAdminProfileImg] = useState<string | null>(null);
    const [roswalLogo,      setRoswalLogo]      = useState<string | null>(roswaltLogoAsset);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileInputRef = useRef<HTMLInputElement | null>(null);
    const logoInputRef = useRef<HTMLInputElement | null>(null);

    // ── Delete restriction: admins must raise a delete-request ticket ────────
    // Raise-ticket modal state
    const [showRaiseTicketModal, setShowRaiseTicketModal] = useState(false);
    const [raiseTicketTask,      setRaiseTicketTask]      = useState<Task | null>(null);
    const [raiseTicketType,      setRaiseTicketType]      = useState<"delete-request" | "small-activity" | "general-query" | "task-delegation">("small-activity");
    const [raiseTicketNote,      setRaiseTicketNote]      = useState("");
    const [raiseTicketAssignTo,  setRaiseTicketAssignTo]  = useState("");
    const [raiseTicketAttachments, setRaiseTicketAttachments] = useState<string[]>([]);
    const raiseTicketFileRef = useRef<HTMLInputElement | null>(null);

    const requestDeleteTask = (task: Task) => {
      // Admin cannot delete directly — must raise a delete-request ticket to superadmin
      setRaiseTicketTask(task);
      setRaiseTicketType("delete-request");
      setRaiseTicketNote("");
      setRaiseTicketAttachments([]);
      setShowRaiseTicketModal(true);
    };

    const handleRaiseTicketAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      toast("⏳ Uploading attachment…");
      try {
        for (const file of files) {
          const url = await uploadToCloudinary(file, "roswalt/ticket-attachments");
          setRaiseTicketAttachments(prev => [...prev, url]);
        }
        toast("✓ Attachment uploaded");
      } catch (err: any) {
        toast("✕ Upload failed: " + (err?.message || "Unknown error"));
      }
    };

    const handleSubmitRaiseTicket = () => {
      if (!raiseTicketNote.trim() || !raiseTicketTask) return;
      const adminMembers = allMembers.filter(m => m.role === "superadmin" || m.role === "supremo");
      const targetAdmin  = adminMembers[0];
      raiseAssistanceTicket({
        taskId:       raiseTicketTask.id,
        taskTitle:    raiseTicketTask.title,
        taskDueDate:  raiseTicketTask.dueDate ?? "",
        assignedTo:   targetAdmin?.email ?? "pushkaraj.gore@roswalt.com",
        assignedBy:   user?.email ?? "",
        raisedBy:     user?.name  ?? "",
        ticketType:   raiseTicketType,
        reason:       raiseTicketNote,
        staffNote:    raiseTicketNote,
        attachments:  raiseTicketAttachments,
        targetTaskId: raiseTicketTask.id,
      });
      // Notify doer if their task has been flagged for deletion
      if (raiseTicketType === "delete-request") {
        sendSystemDM({
          adminEmail:  user?.email ?? "",
          adminName:   (user as { name?: string }).name ?? user?.email ?? "Admin",
          doerEmail:   raiseTicketTask.assignedTo,
          taskId:      raiseTicketTask.id,
          taskTitle:   raiseTicketTask.title,
          message:     `🗑️ A delete request has been raised for your task "${raiseTicketTask.title}" by ${(user as { name?: string }).name ?? user?.email ?? "Admin"}. Reason: ${raiseTicketNote}. Awaiting Superadmin approval — no action needed from you yet.`,
          notifType:   "task_cancelled",
          priority:    raiseTicketTask.priority,
          dueDate:     raiseTicketTask.dueDate,
          projectName: activeProjects.find((p) => p.id === raiseTicketTask.projectId)?.name ?? "",
        });
      }
      speakText(
        raiseTicketType === "delete-request"
          ? `Delete request submitted for ${raiseTicketTask.title}. Awaiting superadmin approval.`
          : `Assistance ticket raised for ${raiseTicketTask.title}.`
      );
      toast(raiseTicketType === "delete-request"
        ? "🎫 Delete request sent to superadmin for approval"
        : "🎫 Assistance ticket raised");
      setShowRaiseTicketModal(false);
      setRaiseTicketTask(null);
      setRaiseTicketNote("");
      setRaiseTicketAttachments([]);
    };

    // ── Delete confirmation state (kept for deleteAllTasks only) ─────────────
    const [confirmDelete, setConfirmDelete] = useState<{
      message: string;
      onConfirm: () => void;
    } | null>(null);

    const requestDeleteAll = () => {
      setConfirmDelete({
        message: `Delete ALL ${(freshTasks as Task[]).length} tasks permanently? This cannot be undone.`,
        onConfirm: () => {
          deleteAllTasks();
          fetch("https://api.roswaltsmartcue.com/api/tasks/all", { method: "DELETE" }).catch(() => {});
          toast("🗑 All tasks deleted.");
          setConfirmDelete(null);
        },
      });
    };

    // ── Task List Modal (click on stat cards) ────────────────────────────────
    const [showTaskListModal,  setShowTaskListModal]  = useState(false);
    const [taskListModalTitle, setTaskListModalTitle] = useState("");
    const [taskListModalTasks, setTaskListModalTasks] = useState<Task[]>([]);
    const [taskListModalColor, setTaskListModalColor] = useState(G.cyan);

    const openTaskListModal = (title: string, tasks: Task[], color: string) => {
      setTaskListModalTitle(title);
      setTaskListModalTasks(tasks);
      setTaskListModalColor(color);
      setShowTaskListModal(true);
    };

    const [smartAssistTickets, setSmartAssistTickets] = useState<SmartAssistTicket[]>(() => loadTickets());
    const [showSmartAssist,    setShowSmartAssist]    = useState(false);
    const [activeTicket,       setActiveTicket]       = useState<SmartAssistTicket | null>(null);

    // ── Prime Directive flash state ────────────────────────────────────────────
    const [pdFlash,            setPdFlash]            = useState<Task | null>(null);
    const [pdFlashDismissing,  setPdFlashDismissing]  = useState(false);
    const pdLastFiredRef = React.useRef<Record<string, number>>({});

    const [showGlobalHistory, setShowGlobalHistory] = useState(false);

    const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
    const [lightboxIndex,  setLightboxIndex]  = useState(0);
    const [showLightbox,   setShowLightbox]   = useState(false);

    const [newTask, setNewTask] = useState({
      title: "", description: "", priority: "medium", dueDate: "",
      assignedTo: "", projectId: "", timeSlot: "18:00", purpose: "", isAutopulse: false, autopulseCycleDays: 7,
    });
    // ── Voice Note recording state ─────────────────────────────────────────
    const [voiceNoteBlob,      setVoiceNoteBlob]      = useState<Blob | null>(null);
    const [voiceNoteUrl,       setVoiceNoteUrl]        = useState<string>(""); // Cloudinary URL after upload
    const [voiceNoteLocalUrl,  setVoiceNoteLocalUrl]   = useState<string>(""); // local blob URL for preview
    const [isRecording,        setIsRecording]          = useState(false);
    const [isUploadingVoice,   setIsUploadingVoice]     = useState(false);
    const [recordingSeconds,   setRecordingSeconds]     = useState(0);
    const mediaRecorderRef     = useRef<MediaRecorder | null>(null);
    const recordingTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
    const chunksRef            = useRef<BlobPart[]>([]);
    const [showAssigningOverlay, setShowAssigningOverlay] = useState(false);

    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardTask,      setForwardTask]      = useState<Task | null>(null);
    const [forwardTo,        setForwardTo]        = useState("");
    const [forwardNotes,     setForwardNotes]     = useState("");

    // ── Reassign modal state ──────────────────────────────────────────────────
    const [showReassignModal,  setShowReassignModal]  = useState(false);
    const [reassignTask,       setReassignTask]       = useState<Task | null>(null);
    const [reassignTo,         setReassignTo]         = useState("");
    const [reassignReason,     setReassignReason]     = useState("");
    const [showAdminSubmitModal, setShowAdminSubmitModal] = useState(false);
    const [adminSubmitTask,      setAdminSubmitTask]      = useState<Task | null>(null);
    const [adminSubmitNotes,     setAdminSubmitNotes]     = useState("");

    // ── TAT Extension review state ────────────────────────────────────────────
    const [showTatExtModal,    setShowTatExtModal]    = useState(false);
    const [tatExtTask,         setTatExtTask]         = useState<Task | null>(null);
    const [tatExtResponse,     setTatExtResponse]     = useState("");

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyTask,      setHistoryTask]      = useState<Task | null>(null);

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedTask,    setSelectedTask]    = useState<Task | null>(null);
    const [reviewComments,  setReviewComments]  = useState("");

    // ── Assistance Ticket review state ────────────────────────────────────────
    const [selectedTicket,     setSelectedTicket]     = useState<import("../contexts/UserContext").AssistanceTicket | null>(null);
    const [ticketReviewNote,   setTicketReviewNote]   = useState("");
    const [showTicketModal,    setShowTicketModal]    = useState(false);

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
    const [showFlashPanel,   setShowFlashPanel]   = useState(false);

    const [backgroundImage,    setBackgroundImage]    = useState<string | null>(() => {
      try { return localStorage.getItem("ad_bg_image") || null; } catch { return null; }
    });
    const [useImageBackground, setUseImageBackground] = useState(() => {
      try { return localStorage.getItem("ad_bg_type") === "image"; } catch { return false; }
    });
    const [backgroundVideo,    setBackgroundVideo]    = useState<string | null>(() => {
      try { return localStorage.getItem("ad_bg_video") || null; } catch { return null; }
    });
    const backgroundInputRef    = useRef<HTMLInputElement | null>(null);
    const backgroundVideoInputRef = useRef<HTMLInputElement | null>(null);

  const greetedRef   = useRef(false);
  const flashVoiceRef = useRef(false);

  useEffect(() => {
    if (greetedRef.current) return;
    if (!user) return;
    greetedRef.current = true;
    setElevenLabsVoice("ThT5KcBeYPX3keUQqHPh");

    const fullName = (user as { name?: string }).name
      || localStorage.getItem("fullName")
      || "there";

    // Cancel any browser speech — ElevenLabs only
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    setTimeout(async () => {
      // 1. ElevenLabs time-of-day greeting — only if voice is ON
      await greetUser(fullName);

      // 2. Task-aware briefing summary
      const allTasks       = freshTasks as Task[];
      const pendingCount   = allTasks.filter(t => t.approvalStatus === "in-review").length;
      const tatCount       = allTasks.filter(t => (t as any).tatBreached).length;
      const frozenCount    = allTasks.filter(t => (t as any).isFrozen).length;
      const ticketCount    = (assistanceTickets ?? []).filter(
        t => t.status === "pending-admin" &&
             (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
      ).length;

      const parts: string[] = [];
      if (pendingCount > 0)
        parts.push(`You have ${pendingCount} task${pendingCount !== 1 ? "s" : ""} pending your review.`);
      if (tatCount > 0)
        parts.push(`${tatCount} task${tatCount !== 1 ? "s have" : " has"} breached the turnaround time.`);
      if (frozenCount > 0)
        parts.push(`${frozenCount} task${frozenCount !== 1 ? "s are" : " is"} frozen pending ticket approval.`);
      if (ticketCount > 0)
        parts.push(`${ticketCount} assistance ticket${ticketCount !== 1 ? "s are" : " is"} waiting for your review.`);
      if (parts.length === 0)
        parts.push("Your team is fully on track. No immediate action required.");

      await speakText(parts.join(" "));
    }, 800);

    setTimeout(() => setShowFlashPanel(true), 1400);
  }, [user]);

  // ── Voice: speak ticket briefing when flash panel opens ──────────────────
  useEffect(() => {
    if (!showFlashPanel) return;
    if (flashVoiceRef.current) return;

    flashVoiceRef.current = true;
    const pendingTickets = (assistanceTickets ?? []).filter(t => t.status === "pending-admin");
    const reviewNow = (freshTasks as Task[]).filter(t => t.approvalStatus === "in-review").length;
    if (reviewNow > 0 || pendingTickets.length > 0) {
      setTimeout(async () => {
        const parts: string[] = [];
        if (reviewNow > 0) parts.push(`${reviewNow} task${reviewNow !== 1 ? "s are" : " is"} waiting for approval in the Review tab.`);
        if (pendingTickets.length > 0) parts.push(`${pendingTickets.length} assistance ticket${pendingTickets.length !== 1 ? "s" : ""} need your review.`);
        await speakText(parts.join(" "));
      }, 2200);
      if (pendingTickets.length === 0) return;
    } else { return; }

    const ticketNames = pendingTickets.map(t => t.taskTitle);
    let script = "";

    if (pendingTickets.length === 1) {
      script =
        `Attention. A staff member has submitted an assistance ticket for the task: ${ticketNames[0]}. ` +
        `Please review the ticket, read the staff explanation, and approve or reject accordingly. ` +
        `The task will remain frozen until you take action.`;
    } else {
      const listed = ticketNames.length > 2
        ? ticketNames.slice(0, -1).join(", ") + ", and " + ticketNames[ticketNames.length - 1]
        : ticketNames.join(" and ");
      script =
        `Attention. ${pendingTickets.length} assistance tickets are waiting for your review. ` +
        `The affected tasks are: ${listed}. ` +
        `Each task is frozen until you approve the corresponding ticket. ` +
        `Please navigate to the Tickets tab to review and take action.`;
    }

    setTimeout(async () => {
      await speakText(script);
    }, 3500);
  }, [showFlashPanel]);

    // Only show tasks THIS admin assigned — never another admin's tasks
    const tasksToReview = (freshTasks as Task[]).filter(t =>
      t.approvalStatus === "in-review" &&
      (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
    );
    // My Tasks tab = tasks where THIS admin is the doer (assigned TO them by someone else)
    // Tasks they assigned OUT are tracked via tasksToReview / "Assigned by Me" card — not here
    const myAssignedTasks = (freshTasks as unknown as Task[]).filter(t =>
      (t.assignedTo ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
    );
    const myPendingTasks = myAssignedTasks.filter(
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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const allTasksCombined = useMemo<Task[]>(() => {
      const map = new Map<string, Task>();
      (freshTasks as Task[]).forEach(t => map.set(t.id, t));
      return Array.from(map.values());
    }, [freshTasks]);
    const analytics = useMemo(() => {
      const allTasks        = allTasksCombined;
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
          (acc, t) => acc + (new Date(t.completedAt!).getTime() - new Date(t.createdAt!).getTime()), 0
        ) / completedWithTime.length;
      }
      const avgCompletionTime = avgMs > 0 ? `${(avgMs / (1000 * 60 * 60 * 24)).toFixed(1)}d` : "—";

      const chartData = totalTasks === 0
        ? [
            { name: "Week 1", rate: 0,  target: 30 },
            { name: "Week 2", rate: 0,  target: 50 },
            { name: "Week 3", rate: 0,  target: 70 },
            { name: "Week 4", rate: 0,  target: 85 },
          ]
        : [
            { name: "Week 1", rate: Math.round(completionRate * 0.30), target: 30 },
            { name: "Week 2", rate: Math.round(completionRate * 0.55), target: 50 },
            { name: "Week 3", rate: Math.round(completionRate * 0.78), target: 70 },
            { name: "Week 4", rate: completionRate,                    target: 85 },
          ];

      return {
        totalTasks, completedTasks, pendingTasks, inProgressTasks,
        completionRate, avgCompletionTime, tatBreachedCount, activeTicketCount,
        chartData,
        tasksByStatus: {
          approved:  allTasks.filter((t) => t.approvalStatus === "superadmin-approved").length,
          inProcess: inProgressTasks, pending: pendingTasks, completed: completedTasks,
        },
        tasksPerStaff,
        allTasks,
      };
    }, [allTasksCombined, smartAssistTickets]);

    // ── Prime Directive reminder cron — checks every 60 seconds ───────────────
    useEffect(() => {
      const playPdSound = () => {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          // Urgent three-pulse tone
          [880, 1100, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "square";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.22);
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.22);
            gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.22 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
            osc.start(ctx.currentTime + i * 0.22);
            osc.stop(ctx.currentTime + i * 0.22 + 0.2);
          });
        } catch {}
      };

      const checkPD = () => {
        const now = Date.now();
        const primeTasks = allTasksCombined.filter((t: Task) =>
          (t as any).isPrimeDirective &&
          t.approvalStatus !== "superadmin-approved" &&
          t.approvalStatus !== "rejected"
        );
        for (const task of primeTasks) {
          const pd = task as any;
          // Skip if snoozed
          if (pd.pdSnoozedUntil && new Date(pd.pdSnoozedUntil).getTime() > now) continue;
          // Skip if already acknowledged
          if (pd.pdAcknowledgedAt) continue;
          const intervalMs = (pd.pdReminderIntervalHours ?? 24) * 60 * 60 * 1000;
          const lastFired = pdLastFiredRef.current[task.id] || 0;
          // Also check server-side lastReminderAt
          const serverLast = pd.pdLastReminderAt ? new Date(pd.pdLastReminderAt).getTime() : 0;
          const effectiveLast = Math.max(lastFired, serverLast);
          if (now - effectiveLast >= intervalMs) {
            pdLastFiredRef.current[task.id] = now;
            setPdFlash(task);
            playPdSound();
            // Persist reminder log to backend
            const updatedTask = { ...task, pdReminderCount: (pd.pdReminderCount ?? 0) + 1, pdLastReminderAt: new Date().toISOString() };
            syncTaskToBackend(updatedTask as Task);
            break; // show one at a time
          }
        }
      };

      const interval = setInterval(checkPD, 60_000);
      checkPD(); // run immediately on mount
      return () => clearInterval(interval);
    }, [allTasksCombined]);

    const toast = (msg: string): void => {
      setToastMsg(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
    };

    // ── Review modal loading state ────────────────────────────────────────────
    const [reviewTaskLoading, setReviewTaskLoading] = React.useState(false);

    // Opens the review modal, then fetches the FULL task (with attachments + scoreData)
    // The poll at /api/tasks excludes these fields for performance — so we fetch individually
    const openReviewModal = async (task: Task): Promise<void> => {
      setSelectedTask(task);
      setShowReviewModal(true);
      setReviewTaskLoading(true);
      try {
        const res = await fetch(`${API}/api/tasks/${task.id}`);
        if (res.ok) {
          const full = await res.json();
          setSelectedTask(prev => prev ? { ...prev, ...full, id: full.id || String(full._id) } : prev);
        }
      } catch (e) {
        console.warn("[openReviewModal] Could not fetch full task:", e);
      } finally {
        setReviewTaskLoading(false);
      }
    };

    // ── Sync task updates to backend ──────────────────────────────────────────
    // ── Backend helpers ──────────────────────────────────────────────────────
    // NOTE: addTask() from UserContext already POSTs to backend — do NOT call
    // any separate POST here or you will get duplicate writes.
    const API = "https://api.roswaltsmartcue.com";

    const syncTaskToBackend = async (task: Task): Promise<void> => {
      try {
        await fetch(`${API}/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });
      } catch (error) {
        console.error("Failed to sync task to backend:", error);
      }
    };

    const handleProfileImageUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) { toast("⚠ Please upload an image file."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") { setAdminProfileImg(e.target.result); toast("✓ Profile photo updated"); }
      };
      reader.readAsDataURL(file);
    };

    const handleBackgroundImageUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) { toast("⚠ Please upload an image file."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          setBackgroundImage(e.target.result);
          setUseImageBackground(true);
          try { localStorage.setItem("ad_bg_image", e.target.result); localStorage.setItem("ad_bg_type", "image"); } catch {}
          toast("✓ Background image set");
        }
      };
      reader.readAsDataURL(file);
    };

    const handleBackgroundVideoUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("video/")) { toast("⚠ Please upload a video file (MP4, WebM, MOV)."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          setBackgroundVideo(e.target.result);
          setUseImageBackground(false);
          try { localStorage.setItem("ad_bg_video", e.target.result); localStorage.setItem("ad_bg_type", "video"); } catch {
            toast("⚠ Video too large to persist — will reset on refresh. Use a smaller file.");
          }
          toast("✓ Background video updated");
        }
      };
      reader.readAsDataURL(file);
    };

    const handleLogoUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) { toast("⚠ Please upload an image file."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") { setRoswalLogo(e.target.result); toast("✓ Logo updated"); }
      };
      reader.readAsDataURL(file);
    };

    const openLightbox = (photos: string[], index = 0): void => {
      setLightboxPhotos(photos); setLightboxIndex(index); setShowLightbox(true);
    };

    const openSubmitModal = (task: Task): void => {
      setSubmitTask(task);
      setSubmitNotes(task.completionNotes ?? "");
      setSubmitPhotos(task.attachments ?? []);
      setSubmitTimeSlot(task.timeSlot ?? "18:00");
      setAiReviewResults(null); setReviewPanelOpen(false);
      setShowSubmitModal(true);
    };

    const closeSubmitModal = (): void => {
      setShowSubmitModal(false); setSubmitTask(null); setSubmitNotes("");
      setSubmitPhotos([]); setAiReviewResults(null); setReviewPanelOpen(false);
    };

    const handlePhotoAdd = async (files: FileList | null): Promise<void> => {
      if (!files) return;
      const allowed = Array.from(files).filter((f: File) => f.type.startsWith("image/") || f.type.startsWith("video/") || f.type === "application/pdf");
      if (allowed.length === 0) return;
      toast("⏳ Uploading to cloud…");
      try {
        for (const file of allowed) {
          const url = await uploadToCloudinary(file, "roswalt/task-attachments");
          setSubmitPhotos(prev => [...prev, url]);
          setAiReviewResults(null);
        }
        toast(`✓ ${allowed.length} file${allowed.length > 1 ? "s" : ""} uploaded`);
      } catch (err: any) {
        toast("✕ Upload failed: " + (err?.message || "Unknown error"));
      }
    };

    const removePhoto = (i: number): void => {
      setSubmitPhotos((prev) => prev.filter((_, idx) => idx !== i));
      setAiReviewResults(null);
    };

    const openSmartAssist = (task: Task): void => {
      const ticket = getTicketForTask(smartAssistTickets, task.id);
      setActiveTicket(
        ticket ?? {
          id: `sa_${task.id}`, taskId: task.id, taskTitle: task.title,
          assignedTo: task.assignedTo, assignedToName: getName(task.assignedTo),
          assignedBy: task.assignedBy, assignedByName: getName(task.assignedBy ?? ""),
          delayDuration: task.smartAssist?.delayDuration ?? "Unknown",
          originalDeadline: task.exactDeadline ?? computeExactDeadline(task.dueDate, task.timeSlot ?? "PM"),
          timeSlot: task.timeSlot ?? "18:00", reminderCount: task.smartAssist?.reminderCount ?? 1,
          status: "open", lastReminderAt: new Date().toISOString(),
        }
      );
      setShowSmartAssist(true);
    };

    const handleSmartAssistSubmit = ({ revisedDate, revisedTimeSlot, delayReason }: { revisedDate: string; revisedTimeSlot: string; delayReason: string }): void => {
      if (!activeTicket) return;
      setSmartAssistTickets(submitRevision(smartAssistTickets, activeTicket.taskId, { revisedDate, revisedTimeSlot, delayReason }));
      toast("✓ Revised timeline submitted");
    };

    const handleSubmitTask = (): void => {
      if (!submitTask) return;
      if (!submitNotes.trim()) { toast("⚠ Please add completion notes."); return; }
      if (aiReviewResults?.hasErrors) { toast("⚠ Fix attachment errors before submitting."); return; }
      const histEntry: HistoryEntry = {
        id: `hist_${Date.now()}`, timestamp: new Date().toISOString(),
        action: "completed", by: user?.email ?? "", notes: submitNotes,
      };
      // Single merged update — prevents submitTaskCompletion from overwriting history
      const updatedTask: Task = {
        ...submitTask,
        completionNotes: submitNotes,
        attachments: submitPhotos,
        timeSlot: submitTimeSlot,
        exactDeadline: computeExactDeadline(submitTask.dueDate, submitTimeSlot),
        approvalStatus: "in-review",
        history: [...(submitTask.history ?? []), histEntry],
        completedAt: new Date().toISOString(),
      };
      updateTask(submitTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask);
      setSmartAssistTickets(resolveTicket(smartAssistTickets, submitTask.id));
      closeSubmitModal();
      toast("✓ Task submitted for review.");
    };

    const handleAIDraft = async (): Promise<void> => {
      if (!submitTask || !submitNotes.trim()) { toast("⚠ Write some notes first."); return; }
      setAiDrafting(true);
      try {
        const res = await fetch("https://api.roswaltsmartcue.com/api/draft-notes", {
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
          if (photo.startsWith("http")) {
            // Cloudinary URL — pass directly as URL source
            contentArray.push({ type: "image", source: { type: "url", url: photo } });
          } else if (photo.startsWith("data:")) {
            const m = photo.match(/data:([^;]+);base64,(.+)/);
            if (m) contentArray.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
          }
        }
        const res = await fetch("https://api.roswaltsmartcue.com/api/review-attachments", {
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
      const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "forwarded", by: user?.email ?? "", to: forwardTo, notes: forwardNotes };
      const updatedTask = { ...forwardTask, assignedTo: forwardTo, assignedBy: user?.email, forwardedFrom: forwardTask.assignedTo, history: [...(forwardTask.history ?? []), h] };
      updateTask(forwardTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask as Task);
      toast(`✓ Task forwarded to ${getName(forwardTo)}`);
      setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes("");
    };

  const handleApprove = (): void => {
    if (!selectedTask) return;
    const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "approved", by: user?.email ?? "", notes: reviewComments };
    // Merge history + approvalStatus in ONE update so adminReviewTask can't overwrite history
    const updatedTask: Task = {
      ...selectedTask,
      approvalStatus: "admin-approved",
      adminComments: reviewComments,
      history: [...(selectedTask.history ?? []), h],
    };
    updateTask(selectedTask.id, updatedTask as never);
    syncTaskToBackend(updatedTask);

    sendSystemDM({
      adminEmail:  user?.email ?? "",
      adminName:   (user as { name?: string }).name ?? user?.email ?? "Admin",
      doerEmail:   selectedTask.assignedTo,
      taskId:      selectedTask.id,
      taskTitle:   selectedTask.title,
      message:     `✅ Your task "${selectedTask.title}" has been APPROVED by ${(user as { name?: string }).name ?? user?.email ?? "Admin"}.${reviewComments ? " Notes: " + reviewComments : " Great work — awaiting Superadmin sign-off."}`,
      notifType:   "task_approved",
      priority:    selectedTask.priority,
      dueDate:     selectedTask.dueDate,
      projectName: activeProjects.find((p) => p.id === selectedTask.projectId)?.name ?? "",
    });
    setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
    const cycleDays = (updatedTask as any).autopulseCycleDays ?? 7;
    if ((updatedTask as any).isAutopulse) {
      speakText(
        `Task approved and forwarded to Superadmin. ` +
        `As this is an Autopulse task, a new instance will be automatically assigned to ${getName(updatedTask.assignedTo)} in ${cycleDays} days.`
      );
      toast(`✓ Approved — next Autopulse cycle scheduled in ${cycleDays} days.`);
    } else {
      speakText("Task approved and forwarded to Superadmin for final sign-off.");
      toast("✓ Approved — forwarded to Superadmin.");
    }
  };

    // ── handleRework ──────────────────────────────────────────────────────────
    const handleRework = (): void => {
      if (!selectedTask) return;
      if (!reviewComments.trim()) { toast("⚠ Add a reason for rework."); return; }
      const h: HistoryEntry = {
        id: `hist_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "rejected",
        by: user?.email ?? "",
        notes: reviewComments,
      };
      // Single update with full state — no second context call that could overwrite history
      const updatedTask: Task = {
        ...selectedTask,
        approvalStatus: "rejected",
        adminComments: reviewComments,
        history: [...(selectedTask.history ?? []), h],
      };
      updateTask(selectedTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask);

      sendSystemDM({
        adminEmail:  user?.email ?? "",
        adminName:   (user as { name?: string }).name ?? user?.email ?? "Admin",
        doerEmail:   selectedTask.assignedTo,
        taskId:      selectedTask.id,
        taskTitle:   selectedTask.title,
        message:     `↩ Task "${selectedTask.title}" has been sent back for REWORK by ${(user as { name?: string }).name ?? user?.email ?? "Admin"}. Reason: ${reviewComments}. Please revise and resubmit.`,
        notifType:   "task_rework",
        priority:    selectedTask.priority,
        dueDate:     selectedTask.dueDate,
        projectName: activeProjects.find((p) => p.id === selectedTask.projectId)?.name ?? "",
      });

      setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
      speakText("Task sent back for rework. The staff member has been notified.");
      toast("↩ Sent back for rework.");
    };

    // ── handleReassignTask ────────────────────────────────────────────────────
    // Cancels the task for the current doer, reassigns to new doer,
    // and fires a handover voice call to the original doer.
    const handleReassignTask = (): void => {
      if (!reassignTask || !reassignTo) { toast("⚠ Select a new assignee."); return; }
      if (reassignTo === reassignTask.assignedTo) { toast("⚠ New assignee is the same as current."); return; }

      const previousAssignee = reassignTask.assignedTo;
      const previousName     = getName(previousAssignee);
      const newName          = getName(reassignTo);
      const now              = new Date().toISOString();

      const histEntry: HistoryEntry = {
        id:        crypto.randomUUID(),
        timestamp: now,
        action:    `reassigned — cancelled for ${previousName}, handed over to ${newName}${reassignReason ? ` · Reason: ${reassignReason}` : ""}`,
        by:        user?.email ?? "",
        to:        reassignTo,
        notes:     reassignReason,
      };

      const updatedTask: Task = {
        ...reassignTask,
        assignedTo:          reassignTo,
        assignedBy:          user?.email ?? "",
        previousAssignee,
        reassignedAt:        now,
        handoverRequested:   true,
        approvalStatus:      "assigned",       // reset to assigned for new doer
        completionNotes:     undefined,        // clear old submission data
        attachments:         reassignTask.attachments ?? [], // preserve any existing attachments for handover reference
        adminComments:       reassignReason || undefined,
        history:             [...(reassignTask.history ?? []), histEntry],
      };

      updateTask(reassignTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask);

      // ── Voice: handover callout to the ORIGINAL doer ──────────────────────
      const adminName = (user as { name?: string }).name ?? user?.email ?? "Your admin";
      const taskTitle = reassignTask.title;
      speakText(
        `Attention ${previousName}. ${adminName} has reassigned the task "${taskTitle}" to ${newName}. ` +
        `Please hand over all your completed creatives, drafts, and working files for this task to ${newName} immediately. ` +
        `Your assignment for this task has been cancelled. Coordinate with ${newName} to ensure a smooth handover.`
      );

      // ── Chatroom DM to new doer ───────────────────────────────────────────
      const projectName = activeProjects.find(p => p.id === reassignTask.projectId)?.name ?? "";
      sendSystemDM({
        adminEmail:  user?.email ?? "",
        adminName,
        doerEmail:   reassignTo,
        taskId:      reassignTask.id,
        taskTitle,
        message:     `🔄 Task REASSIGNED to you: "${taskTitle}". ${reassignReason ? "Reason: " + reassignReason + ". " : ""}Please coordinate with ${previousName} for handover of all existing creatives and files.`,
        notifType:   "task_reassigned",
        priority:    reassignTask.priority,
        dueDate:     reassignTask.dueDate,
        projectName,
      });

      // ── Chatroom DM to original doer (cancellation notice) ───────────────
      sendSystemDM({
        adminEmail:  user?.email ?? "",
        adminName,
        doerEmail:   previousAssignee,
        taskId:      reassignTask.id,
        taskTitle,
        message:     `⚠️ Your assignment for "${taskTitle}" has been CANCELLED and reassigned to ${newName}. Please hand over all work-in-progress creatives and files to ${newName} immediately.`,
        notifType:   "task_cancelled",
        priority:    reassignTask.priority,
        dueDate:     reassignTask.dueDate,
        projectName,
      });

      setShowReassignModal(false);
      setReassignTask(null);
      setReassignTo("");
      setReassignReason("");
      toast(`✓ Task reassigned to ${newName} — ${previousName} notified for handover.`);
    };

    // ── handleApproveTatExtension ─────────────────────────────────────────────
    const handleApproveTatExtension = (): void => {
      if (!tatExtTask?.tatExtensionRequest) return;
      const ext    = tatExtTask.tatExtensionRequest;
      const doerName = getName(tatExtTask.assignedTo);
      const now    = new Date().toISOString();

      const histEntry: HistoryEntry = {
        id:        crypto.randomUUID(),
        timestamp: now,
        action:    `TAT extension APPROVED — new deadline: ${ext.requestedNewDate} ${ext.requestedNewTimeSlot}${tatExtResponse ? ` · Admin note: ${tatExtResponse}` : ""}`,
        by:        user?.email ?? "",
        notes:     tatExtResponse,
      };

      const updatedTask: Task = {
        ...tatExtTask,
        dueDate:       ext.requestedNewDate,
        timeSlot:      ext.requestedNewTimeSlot,
        exactDeadline: computeExactDeadline(ext.requestedNewDate, ext.requestedNewTimeSlot),
        tatBreached:   false,
        tatExtensionRequest: {
          ...ext,
          status:       "approved",
          adminResponse: tatExtResponse,
          respondedAt:   now,
        },
        history: [...(tatExtTask.history ?? []), histEntry],
      };

      updateTask(tatExtTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask);

      sendSystemDM({
        adminEmail:  user?.email ?? "",
        adminName:   (user as { name?: string }).name ?? user?.email ?? "Admin",
        doerEmail:   tatExtTask.assignedTo,
        taskId:      tatExtTask.id,
        taskTitle:   tatExtTask.title,
        message:     `⏰ Your deadline extension for "${tatExtTask.title}" has been APPROVED. New deadline: ${new Date(ext.requestedNewDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at ${ext.requestedNewTimeSlot}.${tatExtResponse ? " Note: " + tatExtResponse : ""}`,
        notifType:   "task_approved",
        priority:    tatExtTask.priority,
        dueDate:     ext.requestedNewDate,
        projectName: activeProjects.find((p) => p.id === tatExtTask.projectId)?.name ?? "",
      });

      speakText(
        `TAT extension approved for ${doerName} on the task "${tatExtTask.title}". ` +
        `New deadline is ${new Date(ext.requestedNewDate).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} at ${ext.requestedNewTimeSlot}. ` +
        `${tatExtResponse ? tatExtResponse : "Please ensure timely delivery."}`
      );

      setShowTatExtModal(false);
      setTatExtTask(null);
      setTatExtResponse("");
      toast(`✓ TAT extension approved for ${doerName}.`);
    };

    // ── handleDenyTatExtension ────────────────────────────────────────────────
    const handleDenyTatExtension = (): void => {
      if (!tatExtTask?.tatExtensionRequest) return;
      if (!tatExtResponse.trim()) { toast("⚠ Provide a reason for denial."); return; }
      const doerName = getName(tatExtTask.assignedTo);
      const now      = new Date().toISOString();

      const histEntry: HistoryEntry = {
        id:        crypto.randomUUID(),
        timestamp: now,
        action:    `TAT extension DENIED · Reason: ${tatExtResponse}`,
        by:        user?.email ?? "",
        notes:     tatExtResponse,
      };

      const updatedTask: Task = {
        ...tatExtTask,
        tatExtensionRequest: {
          ...tatExtTask.tatExtensionRequest!,
          status:        "denied",
          adminResponse: tatExtResponse,
          respondedAt:   now,
        },
        history: [...(tatExtTask.history ?? []), histEntry],
      };

      updateTask(tatExtTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask);

      sendSystemDM({
        adminEmail:  user?.email ?? "",
        adminName:   (user as { name?: string }).name ?? user?.email ?? "Admin",
        doerEmail:   tatExtTask.assignedTo,
        taskId:      tatExtTask.id,
        taskTitle:   tatExtTask.title,
        message:     `❌ Your deadline extension for "${tatExtTask.title}" was DENIED. Reason: ${tatExtResponse}. The original deadline stands — please ensure timely delivery.`,
        notifType:   "task_rework",
        priority:    tatExtTask.priority,
        dueDate:     tatExtTask.dueDate,
        projectName: activeProjects.find((p) => p.id === tatExtTask.projectId)?.name ?? "",
      });

      speakText(
        `TAT extension request for "${tatExtTask.title}" has been denied. ` +
        `${doerName} has been notified. Reason: ${tatExtResponse}. ` +
        `Note: If the deadline is not met, the task will be frozen automatically.`
      );

      setShowTatExtModal(false);
      setTatExtTask(null);
      setTatExtResponse("");
      toast(`↩ TAT extension denied — ${doerName} notified.`);
    };

    // ── handleCreateTask ──────────────────────────────────────────────────────
  const handleCreateTask = (): void => {
      if (!newTask.title || !newTask.description || !newTask.assignedTo || !newTask.dueDate) {
        toast("⚠ Fill all required fields.");
        return;
      }
      if (!newTask.projectId) {
        toast("⚠ Select a project.");
        return;
      }

      const member = allMembers.find((m) => m.email === newTask.assignedTo);
      if (!member) {
        toast("⚠ Selected member not found.");
        return;
      }
      const taskId        = crypto.randomUUID();
      const exactDeadline = computeExactDeadline(newTask.dueDate, newTask.timeSlot);
      const now           = new Date().toISOString();

      const history: HistoryEntry[] = [
        { id: crypto.randomUUID(), timestamp: now, action: "created",  by: user?.email ?? "", to: newTask.assignedTo },
        { id: crypto.randomUUID(), timestamp: now, action: "assigned", by: user?.email ?? "", to: newTask.assignedTo },
      ];
      // History is stored in the task object itself (saved to MongoDB via addTask)
      // No separate localStorage write needed

      // ── Close modal, show overlay, speak "please wait" ──
      setShowCreateModal(false);
      setShowAssigningOverlay(true);
      speakText("Please wait. The task is getting assigned.");

      const assigneeName = allMembers.find(m => m.email === newTask.assignedTo)?.name || newTask.assignedTo;

      const newTaskObj: Task = {
        id:             taskId,
        title:          newTask.title,
        description:    newTask.description,
        status:         "pending",
        approvalStatus: "assigned",
        priority:       newTask.priority as Task["priority"],
        dueDate:        newTask.dueDate,
        assignedTo:     newTask.assignedTo,
        assignedBy:     user?.email ?? "",
        projectId:      newTask.projectId,
        timeSlot:       newTask.timeSlot,
        purpose:             newTask.purpose,
        voiceNote:           voiceNoteUrl || undefined,
        isAutopulse:         (newTask as any).isAutopulse     || false,
        autopulseCycleDays:  (newTask as any).autopulseCycleDays ?? 7,
        autopulseParentId:   undefined,
        autopulseGeneration: 0,
        exactDeadline,
        history,
        createdAt:      now,
      };

      addTask(newTaskObj as never);

      // POST to backend to CREATE the task (not PUT which only updates existing)
      // addTask() from UserContext handles the POST to MongoDB — no separate fetch needed
      // Wait 2s for backend to confirm, then play success voice and hide overlay
      setTimeout(() => {
        console.log("✅ Task assigned:", newTaskObj.id, "->", assigneeName);
        speakText(`Task successfully assigned. ${newTask.title} has been assigned to ${assigneeName}. They will be notified immediately.`);
        setTimeout(() => setShowAssigningOverlay(false), 3500);
      }, 2000);

      // ── Chatroom DM notification to doer ────────────────────────────────
      const dueLabel   = newTask.dueDate ? ` · Due ${new Date(newTask.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "";
      const prjLabel   = activeProjects.find((p) => p.id === newTask.projectId)?.name ?? "";
      sendSystemDM({
        adminEmail:  user?.email ?? "",
        adminName:   (user as { name?: string }).name ?? user?.email ?? "Admin",
        doerEmail:   newTask.assignedTo,
        taskId,
        taskTitle:   newTask.title,
        message:     `📋 New task assigned to you: "${newTask.title}"${dueLabel}. Priority: ${newTask.priority.toUpperCase()}. ${newTask.description ? newTask.description.slice(0, 120) + "…" : ""}`,
        notifType:   "task_assigned",
        priority:    newTask.priority,
        dueDate:     newTask.dueDate,
        projectName: prjLabel,
      });
      toast(`✓ Task assigned to ${member.name} — Chatroom notification sent`);

      setNewTask({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "", projectId: "", timeSlot: "18:00", purpose: "", isAutopulse: false, autopulseCycleDays: 7 } as any);
      setVoiceNoteBlob(null);
      setVoiceNoteUrl("");
      setVoiceNoteLocalUrl("");
      setIsRecording(false);
      setIsUploadingVoice(false);
      setRecordingSeconds(0);
      chunksRef.current = [];
    };  // ← this closing brace for handleCreateTask MUST be here

    // ── handleLogout ──────────────────────────────────────────────────────────
    const handleLogout = (): void => {
      if (window.confirm("Sign out?")) { logout(); navigate("/login", { replace: true }); }
    };

    const activeSmartAssistCount = countActiveTickets(smartAssistTickets);
    // Assistance tickets sent to THIS admin for review
    // Only show tickets for tasks that THIS admin originally assigned (ownership)
    const pendingAssistanceTickets = (assistanceTickets ?? []).filter(
      t => (t.status === "pending-admin" || t.status === "open") &&
           (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
    );

    // Voice alert when a new ticket arrives for this admin
    const prevTicketCountRef = React.useRef(pendingAssistanceTickets.length);
    useEffect(() => {
      const prev = prevTicketCountRef.current;
      const curr = pendingAssistanceTickets.length;
      if (curr > prev) {
        const newest = pendingAssistanceTickets[0];
        const typeLabel = newest?.ticketType === "delete-request"
          ? "delete request"
          : newest?.ticketType?.replace("-", " ") ?? "assistance ticket";
        speakText(`Attention. You have a new ${typeLabel} from ${newest?.raisedBy ?? "a team member"} regarding ${newest?.taskTitle ?? "a task"}. Please review at your earliest.`);
      }
      prevTicketCountRef.current = curr;
    }, [pendingAssistanceTickets.length]);

    // Voice alert when a new task is assigned TO this admin (admin acting as doer)
    const prevAdminTaskCountRef = React.useRef<number | null>(null);
    const prevAdminTaskIdsRef   = React.useRef<Set<string>>(new Set());
    useEffect(() => {
      if (myAssignedTasks.length === 0) return;
      const currentIds = new Set(myAssignedTasks.map((t: Task) => t.id));
      const prev = prevAdminTaskCountRef.current;
      if (prev !== null && myAssignedTasks.length > prev) {
        const newTasks = myAssignedTasks.filter((t: Task) => !prevAdminTaskIdsRef.current.has(t.id));
        newTasks.forEach((task: Task) => {
          const from = task.assignedBy
            ? allMembers.find(m => m.email === task.assignedBy)?.name ?? task.assignedBy
            : "a colleague";
          const due = task.dueDate
            ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long" })
            : "no deadline set";
          speakText(
            `Attention. You have been assigned a new task by ${from}. ` +
            `Task: ${task.title}. Priority: ${task.priority ?? "medium"}. Due by ${due}.`
          );
        });
      }
      prevAdminTaskCountRef.current = myAssignedTasks.length;
      prevAdminTaskIdsRef.current   = currentIds;
    }, [myAssignedTasks.length]);

    // Voice: read score aloud when admin opens the review modal
    useEffect(() => {
      if (!showReviewModal || !selectedTask) return;
      const score = (selectedTask as any).scoreData;
      const doerName = getName(selectedTask.assignedTo);
      if (score) {
        speakText(
          `Reviewing task: ${selectedTask.title}, assigned to ${doerName}. ` +
          `AI Score: ${score.percentScore} out of 100. Grade: ${score.grade}. ` +
          `${score.verdict || ""} ` +
          (score.grammarClean === false ? `Grammar issues detected. ` : `Grammar is clean. `) +
          `Please review the attachments and score report before approving.`
        );
      } else {
        speakText(`Reviewing task: ${selectedTask.title}, assigned to ${doerName}. No AI score available. Please review the submission.`);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showReviewModal, selectedTask?.id]);

    const TABS = [
      { id: "analytics",  label: "Analytics",  icon: TrendingUp  },
      { id: "overview",   label: "Overview",   icon: BarChart3   },
      { id: "review",     label: "Review",     icon: Eye         },
      { id: "tickets",    label: "Tickets",    icon: AlertCircle },
      { id: "mytasks",    label: "My Tasks",   icon: User        },
      { id: "progress",   label: "Progress",   icon: Activity    },
      { id: "taskmap",    label: "Task Map",   icon: GitBranch   },
      { id: "autopulse",  label: "Autopulse",  icon: Zap         },
      { id: "prime",       label: "Prime",       icon: Shield      },
      ...(isVinay ? [{ id: "portfolio", label: "Portfolio", icon: FolderPlus }] : []),
    ];

    const statCards = [
      {
        label: "Pending Review", accent: G.gold, icon: Clock,
        value: analytics.tasksByStatus.pending,
        tasks: allTasksCombined.filter(t => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending"),
      },
      {
        label: "In Progress", accent: G.purple, icon: Activity,
        value: analytics.tasksByStatus.inProcess,
        tasks: allTasksCombined.filter(t => (["in-review", "admin-approved"] as string[]).includes(t.approvalStatus)),
      },
      {
        label: "Approved", accent: G.success, icon: CheckCircle,
        value: analytics.tasksByStatus.approved,
        tasks: allTasksCombined.filter(t => t.approvalStatus === "superadmin-approved"),
      },
      {
        label: "TAT Breached", accent: G.danger, icon: AlertTriangle,
        value: analytics.tatBreachedCount,
        tasks: allTasksCombined.filter(t => t.tatBreached),
      },
    ];

    // ════════════════════════════════════════════════════════════════════════════
    return (
      <>
        <style>{CSS}</style>

        {/* ── Admin Flash Briefing Panel ── */}
        {showFlashPanel && (
          <AdminFlashPanel
            adminName={(user as { name?: string }).name || user?.email?.split("@")[0] || "Admin"}
            allTasks={allTasksCombined}
            pendingTickets={pendingAssistanceTickets}
            onClose={() => setShowFlashPanel(false)}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {/* Background layer */}
        {useImageBackground && backgroundImage ? (
          <img src={backgroundImage} alt="Background" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -1, opacity: 0.45 }} />
        ) : (
          <video
            key={backgroundVideo ?? "default"}
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -1, opacity: 1 }}
            autoPlay muted loop playsInline preload="auto"
          >
            {backgroundVideo
              ? <source src={backgroundVideo} />
              : <source src="https://res.cloudinary.com/donsrpgw3/video/upload/v1773314238/0_Hologram_Technology_3840x2160_vzvhd5.mp4" type="video/mp4" />
            }
          </video>
        )}

        <input ref={backgroundInputRef}      type="file" accept="image/*"       style={{ display: "none" }} onChange={(e) => handleBackgroundImageUpload(e.target.files)} />
        <input ref={backgroundVideoInputRef} type="file" accept="video/*"       style={{ display: "none" }} onChange={(e) => handleBackgroundVideoUpload(e.target.files)} />

        <div style={{ minHeight: "100vh", position: "relative" }}>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "0 28px" }}>

            {/* ── HEADER ── */}
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", position: "sticky", top: 0, zIndex: 50, background: "transparent", backdropFilter: "blur(28px)", borderBottom: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 -1px 0 ${G.cyan}22` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>

                {/* Logo */}
                <div style={{ width: 56, height: 56, borderRadius: 12, background: roswalLogo ? "transparent" : `linear-gradient(135deg, ${G.gold}44, ${G.amber}22)`, border: `2px solid ${G.gold}66`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", boxShadow: `0 0 20px ${G.gold}33` }}
                  onClick={() => logoInputRef.current?.click()} title="Click to update logo">
                  {roswalLogo ? <img src={roswalLogo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} /> : <span style={{ fontSize: 28 }}>♞</span>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleLogoUpload(e.target.files)} />

                {/* BG Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: 3 }}>
                  <button onClick={() => backgroundVideoInputRef.current?.click()}
                    style={{ padding: "5px 10px", background: !useImageBackground ? "rgba(0,212,255,0.15)" : "transparent", border: !useImageBackground ? `1px solid ${G.cyan}44` : "1px solid transparent", borderRadius: 5, color: !useImageBackground ? G.cyan : G.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const }}
                    title="Upload a custom background video">
                    🎬 Video {backgroundVideo ? "✓" : ""}
                  </button>
                  <button onClick={() => backgroundInputRef.current?.click()}
                    style={{ padding: "5px 10px", background: useImageBackground ? "rgba(255,224,102,0.15)" : "transparent", border: useImageBackground ? `1px solid ${G.gold}44` : "1px solid transparent", borderRadius: 5, color: useImageBackground ? G.gold : G.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const }}>
                    🖼️ Image {backgroundImage ? "✓" : ""}
                  </button>
                  {(backgroundVideo || backgroundImage) && (
                    <button
                      onClick={() => {
                        setBackgroundVideo(null); setBackgroundImage(null); setUseImageBackground(false);
                        try { localStorage.removeItem("ad_bg_video"); localStorage.removeItem("ad_bg_image"); localStorage.setItem("ad_bg_type", "video"); } catch {}
                        toast("↺ Background reset to default");
                      }}
                      style={{ padding: "5px 8px", background: "rgba(255,45,85,0.10)", border: "1px solid rgba(255,45,85,0.25)", borderRadius: 5, color: G.danger, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}
                      title="Reset to default video"
                    >✕</button>
                  )}
                </div>

                {/* Title */}
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, background: `linear-gradient(90deg, ${G.cyan} 0%, #60efff 20%, ${G.gold} 50%, #60efff 80%, ${G.cyan} 100%)`, backgroundSize: "300% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1, animation: "gradient-shift 8s ease infinite" } as React.CSSProperties}>
                    Admin <em>Control</em>
                  </div>
                  <div style={{ fontSize: 9, color: G.gold, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.18em", textTransform: "uppercase" as const, fontWeight: 700 }}>ROSWALT REALTY</div>
                </div>

                {/* Avatar */}
                <div className="admin-avatar glow" onClick={() => profileInputRef.current?.click()} title="Change profile photo" style={{ marginLeft: 8 }}>
                  {adminProfileImg ? <img src={adminProfileImg} alt="Admin" /> : <div style={{ fontSize: 22 }}>👤</div>}
                </div>
                <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleProfileImageUpload(e.target.files)} />

                {user && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, marginLeft: 6, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>{(user as { name?: string }).name} · {user.email}</div>}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {activeSmartAssistCount > 0 && (
                  <button onClick={() => { setActiveTicket(null); setShowSmartAssist(true); }} className="tat-badge" style={{ cursor: "pointer", border: "none" }}>
                    <AlertTriangle size={11} /> {activeSmartAssistCount} TAT Breach{activeSmartAssistCount !== 1 ? "es" : ""}
                  </button>
                )}
                <button onClick={() => setShowGlobalHistory(true)} className="g-btn-ghost" style={{ padding: "9px 13px" }}><History size={15} /></button>

                <div style={{ display: "flex", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: 3 }}>
                  {TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", background: activeTab === tab.id ? "rgba(0,212,255,0.14)" : "transparent", color: activeTab === tab.id ? G.cyan : G.textSecondary, border: activeTab === tab.id ? `1px solid ${G.cyan}44` : "1px solid transparent", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.2s", position: "relative" as const }}>
                      <tab.icon size={12} />{tab.label}
                      {tab.id === "review"   && tasksToReview.length > 0        && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger,  borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{tasksToReview.length}</span>}
                      {tab.id === "tickets"  && pendingAssistanceTickets.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#ff9500", borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{pendingAssistanceTickets.length}</span>}
                      {tab.id === "autopulse" && allTasksCombined.filter((t: Task) => (t as any).isAutopulse).length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#c9a96e", borderRadius: "50%", fontSize: 9, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{allTasksCombined.filter((t: Task) => (t as any).isAutopulse).length}</span>}
                      {tab.id === "prime" && allTasksCombined.filter((t: Task) => (t as any).isPrimeDirective && !(t as any).pdAcknowledgedAt).length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#f87171", borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{allTasksCombined.filter((t: Task) => (t as any).isPrimeDirective && !(t as any).pdAcknowledgedAt).length}</span>}
                      {tab.id === "mytasks"  && myPendingTasks.length > 0        && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger,  borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{myPendingTasks.length}</span>}
                    </button>
                  ))}
                </div>
                <button className="g-btn-gold" onClick={() => setShowCreateModal(true)}><Plus size={14} strokeWidth={2.5} />New Task</button>
                <button className="g-btn-ghost" onClick={() => setShowAIPanel(!showAIPanel)} style={{ padding: "9px 13px", borderColor: showAIPanel ? `${G.cyan}55` : undefined }}><MessageSquare size={16} color={showAIPanel ? G.cyan : undefined} /></button>
                {/* ── Voice Module Toggle ── */}
                <button
                  onClick={toggleVoice}
                  title={voiceEnabled ? "Voice ON — click to disable ElevenLabs" : "Voice OFF — click to enable"}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "7px 13px", borderRadius: 9, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                    border: `1px solid ${voiceEnabled ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.1)"}`,
                    background: voiceEnabled ? "rgba(201,169,110,0.1)" : "rgba(255,255,255,0.04)",
                    color: voiceEnabled ? "#c9a96e" : "#7e84a3",
                    transition: "all 0.2s",
                    letterSpacing: "0.3px",
                    textTransform: "uppercase" as const,
                  }}
                >
                  {/* Mic icon — inline SVG so no extra import needed */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    {voiceEnabled ? (
                      <>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8"  y1="23" x2="16" y2="23"/>
                      </>
                    ) : (
                      <>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8"  y1="23" x2="16" y2="23"/>
                      </>
                    )}
                  </svg>
                  {voiceEnabled ? "Voice ON" : "Voice OFF"}
                </button>
                <button className="g-btn-ghost" onClick={handleLogout} style={{ padding: "9px 13px" }}><LogOut size={16} /></button>
              </div>
            </header>

            {showAIPanel && (
              <div style={{ marginTop: 20, height: 500, borderRadius: 16, overflow: "hidden", border: `1px solid ${G.cyan}33` }}>
                <ClaudeChat theme="amber" />
              </div>
            )}

            {/* ══ ANALYTICS TAB ══ */}
            {activeTab === "analytics" && (
              <section style={{ marginTop: 32, paddingBottom: 60 }}>
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 30, fontWeight: 700, color: G.textPrimary, marginBottom: 4 }}>
                    Task <em style={{ color: G.cyan }}>Analytics</em>
                  </h2>
                  <div className="neon-divider" style={{ marginBottom: 8 }} />
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>Real-time performance metrics — click any card to drill down</p>
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
                  {(() => {
                    const myEmail = (user?.email ?? "").toLowerCase();
                    const assignedByMe  = allTasksCombined.filter(t => (t.assignedBy ?? "").toLowerCase() === myEmail);
                    return [
                    { title: "Total Tasks",     value: tasksLoaded ? analytics.totalTasks : "…",       subtitle: "All time",          color: G.cyan,    tasks: analytics.allTasks },
                    { title: "Completion Rate", value: tasksLoaded ? `${analytics.completionRate}%` : "…", subtitle: "Success ratio",  color: G.success, tasks: analytics.allTasks.filter(t => t.approvalStatus === "superadmin-approved") },
                    { title: "Avg Completion",  value: tasksLoaded ? analytics.avgCompletionTime : "…", subtitle: "Per task",          color: G.purple,  tasks: analytics.allTasks.filter(t => t.completedAt) },
                    { title: "Active Tasks",    value: tasksLoaded ? analytics.inProgressTasks : "…",   subtitle: "In progress",       color: G.amber,   tasks: analytics.allTasks.filter(t => (["in-review","admin-approved"] as string[]).includes(t.approvalStatus)) },
                    { title: "TAT Breached",    value: tasksLoaded ? analytics.tatBreachedCount : "…",  subtitle: "Deadline misses",   color: G.danger,  tasks: analytics.allTasks.filter(t => t.tatBreached) },
                    { title: "Smart Assist",    value: analytics.activeTicketCount, subtitle: "Open escalations", color: G.amber, tasks: [] },
                    { title: "Assigned by Me",  value: tasksLoaded ? assignedByMe.length : "…",         subtitle: "Tasks I created",   color: G.cyan,    tasks: assignedByMe },
                    { title: "Pending Review",  value: tasksLoaded ? tasksToReview.length : "…",        subtitle: "Awaiting approval", color: G.gold,    tasks: tasksToReview },
                    { title: "Prime Directives", value: allTasksCombined.filter((t: Task) => (t as any).isPrimeDirective && t.approvalStatus !== "superadmin-approved").length, subtitle: "D1 — Active", color: "#f87171", tasks: allTasksCombined.filter((t: Task) => (t as any).isPrimeDirective) },
                    { title: "Autopulse",         value: allTasksCombined.filter((t: Task) => (t as any).isAutopulse).length, subtitle: "D2 — Recurring",  color: "#c9a96e", tasks: allTasksCombined.filter((t: Task) => (t as any).isAutopulse) },
                    ];
                  })().map((card, i) => (
                    <div key={i} className="g-stat-card fade-up" style={{ animationDelay: `${i * 60}ms` }}
                      onClick={() => card.tasks.length > 0 && openTaskListModal(card.title, card.tasks, card.color)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{card.title}</div>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: card.color, boxShadow: `0 0 12px ${card.color}` }} />
                      </div>
                      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, fontWeight: 700, color: card.color, lineHeight: 1, marginBottom: 8, textShadow: `0 0 20px ${card.color}55` }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>{card.subtitle}</div>
                      {card.tasks.length > 0 && <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 9, color: `${card.color}88`, fontFamily: "'IBM Plex Mono',monospace" }}>click to view ›</div>}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${card.color}66,transparent)` }} />
                    </div>
                  ))}
                </div>

                {/* SVG gradient defs */}
                <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
                  <defs>
                    <linearGradient id="barG0" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#00ffb3" stopOpacity="1"/><stop offset="40%" stopColor="#00f5a0" stopOpacity="1"/><stop offset="100%" stopColor="#00874d" stopOpacity="0.65"/>
                    </linearGradient>
                    <linearGradient id="barG1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#e040fb" stopOpacity="1"/><stop offset="40%" stopColor="#bf5fff" stopOpacity="1"/><stop offset="100%" stopColor="#5c0099" stopOpacity="0.65"/>
                    </linearGradient>
                    <linearGradient id="barG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#fff176" stopOpacity="1"/><stop offset="40%" stopColor="#ffe066" stopOpacity="1"/><stop offset="100%" stopColor="#b35c00" stopOpacity="0.65"/>
                    </linearGradient>
                    <linearGradient id="barG3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ff6b8a" stopOpacity="1"/><stop offset="40%" stopColor="#ff2d55" stopOpacity="1"/><stop offset="100%" stopColor="#7a0011" stopOpacity="0.65"/>
                    </linearGradient>
                    <radialGradient id="pieG0" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#00ffb3"/><stop offset="100%" stopColor="#00874d"/></radialGradient>
                    <radialGradient id="pieG1" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#e040fb"/><stop offset="100%" stopColor="#5c0099"/></radialGradient>
                    <radialGradient id="pieG2" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#fff176"/><stop offset="100%" stopColor="#b35c00"/></radialGradient>
                    <radialGradient id="pieG3" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0057a8"/></radialGradient>
                  </defs>
                </svg>

                {/* Charts Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20, marginBottom: 20 }}>

                  {/* BAR CHART */}
                  <div style={{ background: "linear-gradient(145deg, rgba(4,8,22,0.92) 0%, rgba(10,18,48,0.88) 100%)", border: "1px solid rgba(0,212,255,0.28)", borderRadius: 20, padding: "26px 24px 16px", backdropFilter: "blur(28px)", boxShadow: "0 0 0 1px rgba(0,212,255,0.08), 0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <div>
                        <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 700, color: "#f0f4ff", letterSpacing: "0.03em", marginBottom: 3 }}>Task Status Breakdown</h3>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00d4ff88", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Live data · All tasks</div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {["#00ffb3","#e040fb","#fff176","#ff6b8a"].map((c, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 14px ${c}` }} />
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={[
                        { name: "Completed",   value: analytics.completedTasks,   fill: "url(#barG0)" },
                        { name: "In Progress", value: analytics.inProgressTasks,  fill: "url(#barG1)" },
                        { name: "Pending",     value: analytics.pendingTasks,     fill: "url(#barG2)" },
                        { name: "TAT Breach",  value: analytics.tatBreachedCount, fill: "url(#barG3)" },
                      ]} margin={{ top: 10, right: 10, left: -10, bottom: 4 }} barCategoryGap="38%">
                        <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="name" stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "rgba(0,212,255,0.04)" }} contentStyle={{ background: "rgba(2,6,20,0.98)", border: "1px solid rgba(0,212,255,0.35)", borderRadius: 12, color: "#f0f4ff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }} labelStyle={{ color: "#00d4ff", fontWeight: 700 }} />
                        <Bar dataKey="value" radius={[10, 10, 2, 2]} maxBarSize={58}>
                          {(["url(#barG0)","url(#barG1)","url(#barG2)","url(#barG3)"] as string[]).map((fill, idx) => (
                            <Cell key={idx} fill={fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      {[{label:"Completed",c:"#00ffb3"},{label:"In Progress",c:"#e040fb"},{label:"Pending",c:"#fff176"},{label:"TAT Breach",c:"#ff6b8a"}].map((item,i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#7890b0", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                          <div style={{ width: 10, height: 4, borderRadius: 99, background: item.c, boxShadow: `0 0 10px ${item.c}` }} />{item.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PIE CHART */}
                  <div style={{ background: "linear-gradient(145deg, rgba(4,8,22,0.92) 0%, rgba(14,10,44,0.88) 100%)", border: "1px solid rgba(191,95,255,0.30)", borderRadius: 20, padding: "26px 24px 16px", backdropFilter: "blur(28px)", boxShadow: "0 0 0 1px rgba(191,95,255,0.08), 0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <div>
                        <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 700, color: "#f0f4ff", letterSpacing: "0.03em", marginBottom: 3 }}>Status Distribution</h3>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#bf5fff88", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Proportional breakdown</div>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#bf5fff", letterSpacing: "0.14em", textTransform: "uppercase" as const, background: "rgba(191,95,255,0.12)", border: "1px solid rgba(191,95,255,0.30)", borderRadius: 99, padding: "4px 12px" }}>● LIVE</div>
                    </div>
                    {analytics.totalTasks === 0 ? (
                      <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                        <div style={{ width: 80, height: 80, borderRadius: "50%", border: `2px dashed ${G.purple}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <BarChart3 size={28} color={G.textMuted} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: G.textMuted, letterSpacing: "0.10em" }}>No data yet</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Approved",    value: analytics.tasksByStatus.approved  || 0 },
                              { name: "In Progress", value: analytics.tasksByStatus.inProcess || 0 },
                              { name: "Pending",     value: analytics.tasksByStatus.pending   || 0 },
                              { name: "Completed",   value: analytics.tasksByStatus.completed || 0 },
                            ]}
                            cx="50%" cy="48%" innerRadius={54} outerRadius={96} paddingAngle={5} dataKey="value" labelLine={false}
                            label={({ name, value, cx: pcx, cy: pcy, midAngle, outerRadius: por }: { name?: string; value?: number; cx?: number; cy?: number; midAngle?: number; outerRadius?: number }) => {
                              if ((value ?? 0) === 0) return null;
                              const RAD = Math.PI / 180;
                              const rad = (por ?? 96) + 22;
                              const x = (pcx ?? 0) + rad * Math.cos(-((midAngle ?? 0) * RAD));
                              const y = (pcy ?? 0) + rad * Math.sin(-((midAngle ?? 0) * RAD));
                              return <text x={x} y={y} fill="#b8c8e8" textAnchor={x > (pcx ?? 0) ? "start" : "end"} dominantBaseline="central" style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{value}</text>;
                            }}
                          >
                            {[{ fill: "url(#pieG0)", stroke: "#00ffb3" },{ fill: "url(#pieG1)", stroke: "#e040fb" },{ fill: "url(#pieG2)", stroke: "#fff176" },{ fill: "url(#pieG3)", stroke: "#22d3ee" }].map((s, idx) => (
                              <Cell key={idx} fill={s.fill} stroke={`${s.stroke}77`} strokeWidth={3} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "rgba(2,6,20,0.98)", border: "1px solid rgba(191,95,255,0.40)", borderRadius: 12, color: "#f0f4ff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }} labelStyle={{ color: "#bf5fff", fontWeight: 700 }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "#7890b0", textTransform: "uppercase" as const, letterSpacing: "0.08em", paddingTop: 4 }} formatter={(value) => <span style={{ color: "#b8c8e8" }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* AREA CHART */}
                <div style={{ background: "linear-gradient(145deg, rgba(4,8,22,0.92) 0%, rgba(6,18,36,0.88) 100%)", border: "1px solid rgba(0,245,160,0.28)", borderRadius: 20, padding: "26px 24px 16px", backdropFilter: "blur(28px)", boxShadow: "0 0 0 1px rgba(0,245,160,0.07), 0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                    <div>
                      <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 700, color: "#f0f4ff", letterSpacing: "0.03em", marginBottom: 3 }}>Completion Rate Trend</h3>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00f5a088", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Weekly performance vs target</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 22, height: 3, borderRadius: 99, background: "linear-gradient(90deg,#00ffb3,#00d4ff,#bf5fff,#ff2d55)" }} />
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00d4ff", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Actual</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 22, height: 2, borderRadius: 99, background: "#ffe06655", borderTop: "2px dashed #ffe06699" }} />
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#ffe066", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Target</span>
                      </div>
                      {analytics.totalTasks === 0 && (
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "3px 10px" }}>
                          No tasks yet
                        </span>
                      )}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={analytics.chartData} margin={{ top: 14, right: 24, left: -12, bottom: 5 }}>
                      <defs>
                        <linearGradient id="areaGradMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#00ffb3" stopOpacity="0.55"/>
                          <stop offset="35%"  stopColor="#00d4ff" stopOpacity="0.28"/>
                          <stop offset="75%"  stopColor="#bf5fff" stopOpacity="0.10"/>
                          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0"/>
                        </linearGradient>
                        <linearGradient id="areaGradTarget" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#fff176" stopOpacity="0.22"/>
                          <stop offset="100%" stopColor="#ff9f0a" stopOpacity="0"/>
                        </linearGradient>
                        <linearGradient id="areaLineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%"   stopColor="#00ffb3"/>
                          <stop offset="30%"  stopColor="#00d4ff"/>
                          <stop offset="65%"  stopColor="#bf5fff"/>
                          <stop offset="100%" stopColor="#ff2d55"/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 10" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: "rgba(2,6,20,0.98)", border: "1px solid rgba(0,245,160,0.38)", borderRadius: 12, color: "#f0f4ff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}
                        labelStyle={{ color: "#00f5a0", fontWeight: 700, marginBottom: 4 }}
                        formatter={(v: number | undefined) => [`${v ?? 0}%`, ""] as [string, string]}
                      />
                      <Area type="monotone" dataKey="target" stroke="rgba(255,224,102,0.55)" strokeWidth={1.5} strokeDasharray="6 4" fill="url(#areaGradTarget)" dot={false} name="Target" />
                      <Area
                        type="monotone" dataKey="rate"
                        stroke="url(#areaLineGrad)" strokeWidth={3.5}
                        fill="url(#areaGradMain)"
                        dot={{ fill: "#00ffb3", r: 7, strokeWidth: 2.5, stroke: "#010812" }}
                        activeDot={{ r: 11, fill: "#fff176", stroke: "#010812", strokeWidth: 2.5 }}
                        name="Completion %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Status mini cards */}
                <div style={{ background: "rgba(8,14,32,0.70)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 26px", marginBottom: 20, backdropFilter: "blur(20px)" }}>
                  <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, color: G.textSecondary, marginBottom: 18, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Tasks by Status <span style={{ color: G.textMuted, fontSize: 10 }}>— click to view</span></h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Approved",   value: analytics.tasksByStatus.approved,  color: G.success, filter: (t: Task) => t.approvalStatus === "superadmin-approved" },
                      { label: "In Process", value: analytics.tasksByStatus.inProcess, color: G.purple,  filter: (t: Task) => (["in-review","admin-approved"] as string[]).includes(t.approvalStatus) },
                      { label: "Pending",    value: analytics.tasksByStatus.pending,   color: G.gold,    filter: (t: Task) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending" },
                      { label: "Completed",  value: analytics.tasksByStatus.completed, color: G.cyan,    filter: (t: Task) => t.approvalStatus === "superadmin-approved" },
                    ].map((item, i) => (
                      <div key={i} onClick={() => openTaskListModal(item.label, analytics.allTasks.filter(item.filter), item.color)}
                        style={{ padding: "16px", background: `${item.color}08`, border: `1px solid ${item.color}22`, borderRadius: 12, textAlign: "center", cursor: "pointer", transition: "all 0.25s ease", position: "relative" as const }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${item.color}33`; (e.currentTarget as HTMLDivElement).style.borderColor = `${item.color}55`; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; (e.currentTarget as HTMLDivElement).style.borderColor = `${item.color}22`; }}>
                        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 38, fontWeight: 700, color: item.color, textShadow: `0 0 20px ${item.color}66`, marginBottom: 6 }}>{item.value}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team distribution */}
                <div style={{ background: "rgba(8,14,32,0.70)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 26px", backdropFilter: "blur(20px)" }}>
                  <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, color: G.textSecondary, marginBottom: 20, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Task Distribution by Team</h3>
                  {Object.keys(analytics.tasksPerStaff).length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 24px", color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>No tasks assigned yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {Object.entries(analytics.tasksPerStaff).slice(0, 6).map(([email, count], i) => {
                        const member   = allMembers.find((m) => m.email === email);
                        const values   = Object.values(analytics.tasksPerStaff) as number[];
                        const maxTasks = Math.max(...values);
                        const pct      = (count / maxTasks) * 100;
                        const colors   = [G.cyan, G.purple, G.success, G.gold, G.amber, G.danger];
                        const barColor = colors[i % colors.length];
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 150, flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary }}>{member?.name || "Unknown"}</div>
                              <div style={{ fontSize: 9, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{member?.role || "staff"}</div>
                            </div>
                            <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)`, borderRadius: 99, transition: "width 0.6s ease", boxShadow: `0 0 8px ${barColor}66` }} />
                            </div>
                            <div style={{ width: 55, textAlign: "right", fontSize: 13, fontWeight: 700, color: barColor }}>{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* ── PENDING ASSISTANCE TICKETS — Quick Review (Analytics) ── */}
                {pendingAssistanceTickets.length > 0 && (
                  <div className="fade-up" style={{ background: "rgba(255,149,0,0.05)", border: "1px solid rgba(255,149,0,0.25)", borderRadius: 16, padding: "20px 24px", marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff9500", boxShadow: "0 0 8px #ff9500", animation: "pulse 1.5s infinite" }} />
                        <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 15, fontWeight: 700, color: G.textPrimary }}>
                          {pendingAssistanceTickets.length} Assistance Ticket{pendingAssistanceTickets.length !== 1 ? "s" : ""} <span style={{ color: "#ff9500" }}>Awaiting Your Review</span>
                        </span>
                      </div>
                      <button onClick={() => setActiveTab("tickets")} style={{ padding: "5px 12px", background: "rgba(255,149,0,0.1)", border: "1px solid rgba(255,149,0,0.3)", borderRadius: 7, color: "#ff9500", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        Manage All <ChevronRight size={10} />
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {pendingAssistanceTickets.slice(0, 3).map(ticket => {
                        const sName = allMembers.find(m => m.email.toLowerCase() === ticket.assignedTo.toLowerCase())?.name ?? ticket.assignedTo;
                        return (
                          <div key={ticket.id} onClick={() => { setSelectedTicket(ticket); setTicketReviewNote(""); setShowTicketModal(true); }}
                            style={{ flex: "1 1 200px", padding: "12px 14px", background: "rgba(10,14,28,0.80)", border: "1px solid rgba(255,149,0,0.22)", borderRadius: 10, cursor: "pointer", transition: "all 0.2s" }}
                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,149,0,0.5)"}
                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,149,0,0.22)"}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: G.textPrimary, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{ticket.taskTitle}</div>
                            <div style={{ fontSize: 10, color: G.textMuted }}>👤 {sName} · 📅 {new Date(ticket.taskDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                            <div style={{ marginTop: 6, fontSize: 9, color: "#ff9500", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>⚡ Click to Review →</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}
            {activeTab === "overview" && (
              <>
                <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 32 }}>
                  {statCards.map((s, i) => (
                    <div key={i} className="g-stat-card fade-up" style={{ animationDelay: `${i * 70}ms` }}
                      onClick={() => s.tasks.length > 0 && openTaskListModal(s.label, s.tasks, s.accent)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 48, fontWeight: 700, color: s.accent, lineHeight: 1, textShadow: `0 0 24px ${s.accent}55` }}>{s.value}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginTop: 10 }}>{s.label}</div>
                        </div>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.accent}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <s.icon size={18} color={s.accent} />
                        </div>
                      </div>
                      {s.tasks.length > 0 && <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 9, color: `${s.accent}77`, fontFamily: "'IBM Plex Mono',monospace" }}>click ›</div>}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${s.accent}55,transparent)` }} />
                    </div>
                  ))}
                </section>

                {activeSmartAssistCount > 0 && (
                  <div className="fade-up" style={{ marginTop: 22, padding: "16px 20px", background: "rgba(255,45,85,0.08)", border: `1px solid ${G.danger}44`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(12px)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <AlertTriangle size={20} color={G.danger} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: G.danger }}>{activeSmartAssistCount} Active TAT Breach{activeSmartAssistCount !== 1 ? "es" : ""}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: G.textMuted, marginTop: 3 }}>Smart Assist reminders running every 24h</div>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab("progress")} className="g-btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>View Progress <ChevronRight size={13} /></button>
                  </div>
                )}

                {/* ── PENDING ASSISTANCE TICKETS — Quick Review ── */}
                {pendingAssistanceTickets.length > 0 && (
                  <section className="fade-up" style={{ marginTop: 28, paddingBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff9500", boxShadow: "0 0 10px #ff9500", animation: "pulse 1.5s infinite" }} />
                      <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18, fontWeight: 700, color: G.textPrimary }}>
                        Assistance Tickets <em style={{ color: "#ff9500" }}>Pending Review</em>
                      </h3>
                      <span style={{ padding: "3px 10px", background: "rgba(255,149,0,0.12)", border: "1px solid rgba(255,149,0,0.35)", borderRadius: 99, fontSize: 10, color: "#ff9500", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 800 }}>
                        {pendingAssistanceTickets.length} ACTION REQUIRED
                      </span>
                      <button onClick={() => setActiveTab("tickets")} style={{ marginLeft: "auto", padding: "6px 14px", background: "rgba(255,149,0,0.08)", border: "1px solid rgba(255,149,0,0.3)", borderRadius: 8, color: "#ff9500", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                        View All <ChevronRight size={11} />
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {pendingAssistanceTickets.slice(0, 5).map(ticket => {
                        const staffName = allMembers.find(m => m.email.toLowerCase() === ticket.assignedTo.toLowerCase())?.name ?? ticket.assignedTo;
                        return (
                          <div key={ticket.id} style={{
                            background: "rgba(10,14,28,0.80)",
                            border: "1px solid rgba(255,149,0,0.30)",
                            borderRadius: 14, padding: "16px 20px",
                            display: "flex", alignItems: "center", gap: 18,
                            backdropFilter: "blur(16px)",
                            boxShadow: "0 4px 20px rgba(255,149,0,0.06)",
                          }}>
                            <div style={{ width: 4, alignSelf: "stretch", background: "linear-gradient(180deg,#ff9500,#ff6b35)", borderRadius: 99, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(255,149,0,0.1)", color: "#ff9500", fontWeight: 800, textTransform: "uppercase" as const, border: "1px solid rgba(255,149,0,0.25)", fontFamily: "'IBM Plex Mono',monospace" }}>{ticket.id}</span>
                                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(255,51,102,0.08)", color: "#ff3366", fontWeight: 700, textTransform: "uppercase" as const, border: "1px solid rgba(255,51,102,0.2)" }}>Delayed Task</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: G.textPrimary, marginBottom: 4 }}>{ticket.taskTitle}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 10, color: G.textMuted }}>
                                <span>👤 <span style={{ color: G.textSecondary, fontWeight: 600 }}>{staffName}</span></span>
                                <span>📅 Due: <span style={{ color: "#ff3366", fontWeight: 600 }}>{new Date(ticket.taskDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                                <span>🕐 Raised: {new Date(ticket.raisedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                              </div>
                              {ticket.staffNote && (
                                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 8, fontSize: 11, color: G.textSecondary, lineHeight: 1.5 }}>
                                  <span style={{ fontSize: 9, color: G.cyan, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginRight: 6 }}>Staff Note:</span>
                                  {ticket.staffNote.length > 120 ? ticket.staffNote.slice(0, 120) + "…" : ticket.staffNote}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => { setSelectedTicket(ticket); setTicketReviewNote(""); setShowTicketModal(true); }}
                              style={{ flexShrink: 0, padding: "10px 18px", background: "linear-gradient(135deg, rgba(255,149,0,0.18), rgba(255,107,53,0.12))", border: "1px solid rgba(255,149,0,0.42)", borderRadius: 9, color: "#ff9500", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 0 14px rgba(255,149,0,0.12)", transition: "all 0.2s", whiteSpace: "nowrap" as const }}
                            >
                              <Eye size={13} /> Review
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section style={{ marginTop: 32, paddingBottom: 60 }}>
                  <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 20 }}>Task <em style={{ color: G.cyan }}>Monitor</em></h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
                    {[
                      { label: "Approved",   color: G.success, tasks: tasksToReview.filter((t) => (["admin-approved","superadmin-approved"] as string[]).includes(t.approvalStatus)) },
                      { label: "In Process", color: G.purple,  tasks: myAssignedTasks.filter((t) => t.approvalStatus === "in-review") },
                      { label: "Pending",    color: G.gold,    tasks: myAssignedTasks.filter((t) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending") },
                      { label: "Completed",  color: G.cyan,    tasks: [...tasksToReview, ...myAssignedTasks].filter((t) => t.approvalStatus === "superadmin-approved") },
                    ].map((group, i) => (
                      <div key={i} className="fade-up" style={{ animationDelay: `${i * 70}ms`, background: "rgba(8,14,32,0.65)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(16px)", cursor: group.tasks.length > 0 ? "pointer" : "default" }}
                        onClick={() => group.tasks.length > 0 && openTaskListModal(group.label, group.tasks, group.color)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{group.label}</div>
                            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 34, fontWeight: 700, color: group.color, textShadow: `0 0 16px ${group.color}44`, marginTop: 4 }}>{group.tasks.length}</div>
                          </div>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: group.color, boxShadow: `0 0 14px ${group.color}` }} className="shimmer" />
                        </div>
                        {group.tasks.length > 0 && (
                          <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                            Latest: {group.tasks[group.tasks.length - 1]?.title.substring(0, 28)}…
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
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>My <em style={{ color: G.gold }}>Tasks</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Tasks assigned to you by other admins</p>
                {myAssignedTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "72px 24px", background: "rgba(8,14,32,0.65)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textMuted }}>No tasks assigned to you</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...myPendingTasks, ...mySubmittedTasks].map((task, idx) => {
                      // Only show Submit if this admin IS the doer (task assigned TO them, not BY them)
                      const canSubmit  = (task.approvalStatus === "assigned" || task.approvalStatus === "rejected") && (task.assignedTo ?? "").toLowerCase() === (user?.email ?? "").toLowerCase();
                      const canForward = task.approvalStatus === "assigned";
                      const ac = APPROVAL_COLORS[task.approvalStatus] || G.textMuted;
                      return (
                        <div key={task.id} className="g-card fade-up" style={{ animationDelay: `${idx * 55}ms`, padding: "20px 24px", borderColor: task.tatBreached ? G.dangerBorder : undefined }}>
                          {task.tatBreached && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: G.danger, fontFamily: "'IBM Plex Mono',monospace" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={12} /> TAT BREACH — {task.smartAssist?.delayDuration || "Overdue"}</span>
                              <button onClick={() => openSmartAssist(task)} style={{ background: "none", border: `1px solid ${G.dangerBorder}`, borderRadius: 6, color: G.danger, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: "3px 8px" }}>View Ticket</button>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{task.title}</h3>
                                <span className={priClass(task.priority)}><Flag size={9} />{task.priority.toUpperCase()}</span>
                                <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                                {(task as any).isAutopulse && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 4, background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.3)", fontSize: 8, fontWeight: 800, color: "#c9a96e", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                                    <Zap size={7} /> AUTOPULSE {(task as any).autopulseGeneration > 0 ? `#${(task as any).autopulseGeneration}` : ""}
                                  </span>
                                )}
                              </div>
                              {task.assignedBy && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "4px 12px", borderRadius: 99, background: G.goldDim, border: `1px solid ${G.goldBorder}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.gold }}>
                                  <Shield size={9} /> Assigned by <strong style={{ marginLeft: 3 }}>{getName(task.assignedBy)}</strong>
                                </div>
                              )}
                              <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{task.description}</p>
                              {/* ── Voice Note — if admin attached a voice brief ── */}
                              {(task as any).voiceNote && (
                                <div style={{
                                  margin: "8px 0",
                                  padding: "9px 12px", borderRadius: 9,
                                  background: "rgba(201,169,110,0.07)", border: "1px solid rgba(201,169,110,0.28)",
                                  display: "flex", flexDirection: "column" as const, gap: 7,
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <Radio size={10} color="#c9a96e" />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "#c9a96e", textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>
                                      Voice Brief
                                    </span>
                                  </div>
                                  <audio src={(task as any).voiceNote} controls style={{ width: "100%", height: 32, accentColor: "#c9a96e" }} />
                                </div>
                              )}
                              {task.approvalStatus === "rejected" && task.adminComments && (
                                <div style={{ padding: "10px 14px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, fontSize: 13, color: G.danger, marginBottom: 10 }}>↩ <strong>Rework reason:</strong> {task.adminComments}</div>
                              )}
                              {task.completionNotes && (
                                <div style={{ padding: "10px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, fontSize: 13, color: G.textSecondary, marginBottom: 10 }}>📝 {task.completionNotes}</div>
                              )}
                              <div style={{ display: "flex", gap: 14, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", flexWrap: "wrap" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Calendar size={10} />Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {task.timeSlot && <span style={{ color: G.gold, marginLeft: 4 }}>· {task.timeSlot}</span>}
                                </span>
                                {task.purpose && (
                                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.cyan, fontSize: 10, fontFamily: "'IBM Plex Mono',monospace" }}>
                                    🎯 {task.purpose}
                                  </span>
                                )}
                                {task.history && task.history.length > 0 && (
                                  <button onClick={() => { setHistoryTask(task); setShowHistoryModal(true); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: G.cyan, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: 0 }}>
                                    <ListTree size={10} />View History ({task.history.length})
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column" }}>
                              {(task.approvalStatus === "assigned" || task.approvalStatus === "rejected") && (task.assignedTo ?? "").toLowerCase() === (user?.email ?? "").toLowerCase() && (
                                <button className="g-btn-gold" onClick={() => { setAdminSubmitTask(task); setAdminSubmitNotes(task.completionNotes ?? ""); setShowAdminSubmitModal(true); }} style={{ padding: "9px 14px", fontSize: 12 }}><Upload size={13} />Submit</button>
                              )}
                              <button className="g-btn-ghost" onClick={() => { setReassignTask(task); setShowReassignModal(true); }} style={{ padding: "9px 14px", fontSize: 12 }}><RotateCw size={13} />Reassign</button>
                              <button className="g-btn-delete" onClick={() => requestDeleteTask(task)} style={{ padding: "9px 14px" }} title="Admins must raise a delete request ticket"><Trash2 size={13} />Request Delete</button>
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
                    <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary }}>Pending <em style={{ color: G.gold }}>Review</em></h2>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{tasksToReview.length} task{tasksToReview.length !== 1 ? "s" : ""} awaiting decision</p>
                  </div>
                  {tasksToReview.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="glow-dot" style={{ background: G.success }} />
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted }}>LIVE</span>
                    </div>
                  )}
                </div>
                {tasksToReview.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "72px 24px", background: "rgba(8,14,32,0.65)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                    <CheckCircle size={32} color={G.success} style={{ marginBottom: 16 }} />
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 24, fontWeight: 700, color: G.textPrimary, marginBottom: 8 }}>All clear</div>
                    <div style={{ fontSize: 13, color: G.textMuted }}>No tasks pending review.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {tasksToReview.map((task, idx) => (
                      <TaskRow key={task.id} task={task} idx={idx}
                        staffName={getName(task.assignedTo)}
                        isAdminAssignee={isAdminEmail(task.assignedTo)}
                        getNameFn={getName}
                        onReview={() => { openReviewModal(task); }}
                        onViewHistory={() => { setHistoryTask(task); setShowHistoryModal(true); }}
                        onDelete={() => requestDeleteTask(task)}
                        onReassign={() => { setReassignTask(task); setReassignTo(""); setReassignReason(""); setShowReassignModal(true); }}
                        onReviewTatExt={task.tatExtensionRequest?.status === "pending" ? () => { setTatExtTask(task); setTatExtResponse(""); setShowTatExtModal(true); } : undefined}
                        onToggleAutopulse={(task as any).isAutopulse ? () => {
                          const isPaused = (task as any).autopulsePaused;
                          const updated = { ...task, autopulsePaused: !isPaused };
                          updateTask(task.id, updated as never);
                          syncTaskToBackend(updated as Task);
                          toast(isPaused ? "⚡ Autopulse resumed" : "⏸ Autopulse paused");
                        } : undefined}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ══ PROGRESS TAB ══ */}
            {activeTab === "progress" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>Task <em style={{ color: G.cyan }}>Progress</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Real-time visibility into all assigned tasks</p>
                <ProgressTracker tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} pollInterval={30000} onRefresh={() => toast("↻ Progress refreshed")} />
              </section>
            )}

            {/* ══ ASSISTANCE TICKETS TAB ══ */}
            {activeTab === "tickets" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap" as const, gap: 12 }}>
                  <div>
                    <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary }}>
                      Assistance <em style={{ color: "#ff9500" }}>Tickets</em>
                    </h2>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      {pendingAssistanceTickets.length} pending · {(assistanceTickets ?? []).filter(t => t.status === "admin-approved" || t.status === "superadmin-approved").length} approved
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {pendingAssistanceTickets.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff9500", boxShadow: "0 0 8px #ff9500", animation: "pulse 1.5s infinite" }} />
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#ff9500" }}>ACTION REQUIRED</span>
                      </div>
                    )}
                    <button
                      onClick={() => { setRaiseTicketTask(null as any); setRaiseTicketType("small-activity"); setRaiseTicketNote(""); setRaiseTicketAssignTo(""); setRaiseTicketAttachments([]); setShowRaiseTicketModal(true); }}
                      style={{ padding: "8px 16px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 10, color: G.cyan, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center", gap: 6 }}>
                      <Plus size={12} /> New Ticket
                    </button>
                  </div>
                </div>

                {/* All tickets for this admin (sent to this admin or raised by this admin) */}
                {(() => {
                  const rawAdminTickets = (assistanceTickets ?? []).filter(
                    t => (t.assignedTo ?? "").toLowerCase() === (user?.email ?? "").toLowerCase() ||
                         (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
                  );

                  // Deduplicate: for open/pending tickets with same taskId, keep only the newest
                  const seenTaskIds = new Set<string>();
                  const adminTickets = rawAdminTickets
                    .slice() // don't mutate
                    .sort((a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime())
                    .filter(t => {
                      const isOpen = t.status !== "resolved" && t.status !== "rejected" && t.status !== "admin-approved" && t.status !== "superadmin-approved";
                      if (isOpen) {
                        if (seenTaskIds.has(t.taskId)) return false; // skip duplicate
                        seenTaskIds.add(t.taskId);
                      }
                      return true;
                    });
                  if (adminTickets.length === 0) {
                    return (
                      <div style={{
                        textAlign: "center", padding: "72px 24px",
                        background: "rgba(8,14,32,0.65)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16, backdropFilter: "blur(16px)",
                      }}>
                        <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.3 }}>🎫</div>
                        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary, marginBottom: 8 }}>No Tickets</div>
                        <div style={{ fontSize: 13, color: G.textMuted }}>Assistance tickets raised by your team will appear here.</div>
                      </div>
                    );
                  }

                  const statusOrder: Record<string, number> = { "pending-admin": 0, "superadmin-pending": 0, "open": 1, "admin-approved": 2, "superadmin-approved": 2, "rejected": 3, "resolved": 4 };
                  const sorted = [...adminTickets].sort((a, b) =>
                    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sorted.map(ticket => {
                        const isPending  = ticket.status === "pending-admin" || ticket.status === "open";
                        const isApproved = ticket.status === "admin-approved";
                        const staffName  = allMembers.find(m => m.email.toLowerCase() === ticket.assignedTo.toLowerCase())?.name ?? ticket.assignedTo;
                        const linkedTask = freshTasks.find(t => t.id === ticket.taskId);

                        return (
                          <div key={ticket.id} style={{
                            background: "rgba(8,12,28,0.75)",
                            border: `1px solid ${isPending ? "rgba(255,149,0,0.35)" : isApproved ? "rgba(0,255,136,0.22)" : "rgba(255,255,255,0.07)"}`,
                            borderRadius: 14, overflow: "hidden",
                            backdropFilter: "blur(20px)",
                            boxShadow: isPending ? "0 4px 24px rgba(255,149,0,0.08)" : "none",
                          }}>
                            {/* Left accent bar */}
                            <div style={{ display: "flex" }}>
                              <div style={{
                                width: 4, flexShrink: 0,
                                background: isPending ? "linear-gradient(180deg,#ff9500,#ff6b35)" : isApproved ? G.success : "rgba(255,255,255,0.1)",
                              }} />
                              <div style={{ flex: 1, padding: "18px 20px" }}>
                                {/* Top row */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <div style={{ flex: 1, minWidth: 220 }}>
                                    {/* Badges row */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                      <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4,
                                        background: "rgba(255,149,0,0.1)", color: "#ff9500",
                                        fontWeight: 800, textTransform: "uppercase" as const,
                                        border: "1px solid rgba(255,149,0,0.25)", letterSpacing: "0.5px",
                                        fontFamily: "'IBM Plex Mono',monospace",
                                      }}>{ticket.id}</span>
                                      <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4,
                                        background: isPending ? "rgba(255,149,0,0.1)" : isApproved ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.06)",
                                        color: isPending ? "#ff9500" : isApproved ? G.success : G.textMuted,
                                        fontWeight: 800, textTransform: "uppercase" as const,
                                        border: `1px solid ${isPending ? "rgba(255,149,0,0.3)" : isApproved ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.1)"}`,
                                      }}>
                                        {isPending ? "⚡ Awaiting Review" : isApproved ? "✓ Approved" : ticket.status === "open" ? "Open" : "Resolved"}
                                      </span>
                                      <span style={{
                                        fontSize: 9, padding: "2px 8px", borderRadius: 4,
                                        background: "rgba(255,51,102,0.08)", color: "#ff3366",
                                        fontWeight: 700, textTransform: "uppercase" as const,
                                        border: "1px solid rgba(255,51,102,0.2)",
                                      }}>Delayed Task</span>
                                    </div>
                                    {/* Task title */}
                                    <div style={{ fontSize: 15, fontWeight: 700, color: G.textPrimary, marginBottom: 4 }}>{ticket.taskTitle}</div>
                                    {/* Staff + date meta */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 10, color: G.textMuted }}>
                                      <span>👤 <span style={{ color: G.textSecondary, fontWeight: 600 }}>{staffName}</span></span>
                                      <span>📅 Due: <span style={{ color: "#ff3366", fontWeight: 600 }}>{new Date(ticket.taskDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                                      <span>🕐 Raised: <span style={{ color: G.textSecondary }}>{new Date(ticket.raisedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
                                    </div>
                                  </div>
                                  {/* Review button */}
                                  {isPending && (
                                    <button
                                      onClick={() => { setSelectedTicket(ticket); setTicketReviewNote(""); setShowTicketModal(true); }}
                                      style={{
                                        flexShrink: 0, padding: "10px 18px",
                                        background: "linear-gradient(135deg, rgba(255,149,0,0.2), rgba(255,107,53,0.14))",
                                        border: "1px solid rgba(255,149,0,0.45)",
                                        borderRadius: 9, color: "#ff9500",
                                        fontSize: 12, fontWeight: 800, cursor: "pointer",
                                        fontFamily: "inherit", letterSpacing: "0.04em",
                                        boxShadow: "0 0 16px rgba(255,149,0,0.15)",
                                        transition: "all 0.2s",
                                        display: "flex", alignItems: "center", gap: 7,
                                      }}
                                    >
                                      <Eye size={13} /> Review & Decide
                                    </button>
                                  )}
                                  {isApproved && (
                                    <div style={{
                                      flexShrink: 0, padding: "8px 14px",
                                      background: "rgba(0,255,136,0.07)",
                                      border: "1px solid rgba(0,255,136,0.2)",
                                      borderRadius: 9, fontSize: 11, color: G.success,
                                      fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
                                    }}>
                                      <CheckCircle size={12} /> Approved by {ticket.approvedBy}
                                    </div>
                                  )}
                                </div>

                                {/* Staff note */}
                                {ticket.staffNote && (
                                  <div style={{
                                    marginTop: 14, padding: "11px 14px",
                                    background: "rgba(0,212,255,0.04)",
                                    border: "1px solid rgba(0,212,255,0.12)",
                                    borderRadius: 9,
                                  }}>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 5 }}>
                                      Staff Explanation
                                    </div>
                                    <div style={{ fontSize: 12, color: G.textSecondary, lineHeight: 1.6 }}>{ticket.staffNote}</div>
                                  </div>
                                )}

                                {/* Admin comment if approved */}
                                {ticket.adminComment && isApproved && (
                                  <div style={{
                                    marginTop: 10, padding: "11px 14px",
                                    background: "rgba(0,255,136,0.04)",
                                    border: "1px solid rgba(0,255,136,0.15)",
                                    borderRadius: 9,
                                  }}>
                                    <div style={{ fontSize: 9, fontWeight: 800, color: G.success, textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 5 }}>
                                      Your Response · {ticket.approvedAt ? new Date(ticket.approvedAt).toLocaleDateString("en-IN") : ""}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#c8f5dc", lineHeight: 1.6 }}>{ticket.adminComment}</div>
                                  </div>
                                )}

                                {/* Linked task quick info */}
                                {linkedTask && (
                                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 10, color: G.textMuted }}>
                                    <span>Task status: <span style={{ color: G.textSecondary, textTransform: "capitalize" }}>{linkedTask.approvalStatus?.replace("-", " ")}</span></span>
                                    {(linkedTask as any).isFrozen && (
                                      <span style={{ color: "#b06af3", fontWeight: 700 }}>🔒 Frozen</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </section>
            )}

            {/* ══ TASK MAP TAB ══ */}
            {activeTab === "autopulse" && (() => {
              const autopulseTasks = allTasksCombined.filter((t: Task) => (t as any).isAutopulse);
              const activePulse    = autopulseTasks.filter(t => !(t as any).autopulsePaused);
              const pausedPulse    = autopulseTasks.filter(t => (t as any).autopulsePaused);
              const parentTasks    = autopulseTasks.filter(t => !(t as any).autopulseParentId);
              const recurredTasks  = autopulseTasks.filter(t => (t as any).autopulseGeneration > 0);

              return (
                <section style={{ marginTop: 40, paddingBottom: 60 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
                    <div>
                      <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>
                        <Zap size={22} color="#c9a96e" style={{ display: "inline", marginRight: 10, verticalAlign: "middle" }} />
                        <em style={{ color: "#c9a96e" }}>Autopulse</em> Tasks
                      </h2>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                        Recurring task engine — auto-reassigns after admin approval
                      </p>
                    </div>
                    <button className="g-btn-gold" onClick={() => { setShowCreateModal(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Zap size={13} /> New Autopulse Task
                    </button>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
                    {[
                      { label: "Total Autopulse",  value: autopulseTasks.length,  color: "#c9a96e",  sub: "All recurring tasks" },
                      { label: "Active Cycles",     value: activePulse.length,     color: G.success,  sub: "Currently running" },
                      { label: "Paused",            value: pausedPulse.length,     color: G.textMuted,sub: "Admin paused" },
                      { label: "Recurrences Fired", value: recurredTasks.length,   color: G.cyan,     sub: `${parentTasks.length} original task${parentTasks.length !== 1 ? "s" : ""}` },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "18px 20px", background: "rgba(8,14,32,0.65)", border: `1px solid ${s.color}22`, borderRadius: 12, backdropFilter: "blur(16px)" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: G.textMuted }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Empty state */}
                  {autopulseTasks.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(8,14,32,0.65)", border: "1px dashed rgba(201,169,110,0.2)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                      <Zap size={40} color="rgba(201,169,110,0.25)" />
                      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textMuted, marginTop: 16, marginBottom: 8 }}>No Autopulse Tasks Yet</div>
                      <div style={{ fontSize: 13, color: G.textMuted, marginBottom: 20 }}>Create a task and toggle Autopulse ON to start a recurring cycle.</div>
                      <button className="g-btn-gold" onClick={() => setShowCreateModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Zap size={14} /> Create First Autopulse Task
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {autopulseTasks.map((task: Task, idx: number) => {
                        const ap          = task as any;
                        const isPaused    = !!ap.autopulsePaused;
                        const generation  = ap.autopulseGeneration ?? 0;
                        const cycleDays   = ap.autopulseCycleDays ?? 7;
                        const nextDue     = ap.autopulseScheduledFor;
                        const ac          = APPROVAL_COLORS[task.approvalStatus] || G.textMuted;
                        return (
                          <div key={task.id} className="g-card fade-up" style={{
                            animationDelay: `${idx * 40}ms`, padding: "20px 24px",
                            borderColor: isPaused ? "rgba(255,255,255,0.06)" : "rgba(201,169,110,0.2)",
                            opacity: isPaused ? 0.7 : 1,
                          }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                              {/* Left: icon + chain info */}
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: isPaused ? "rgba(255,255,255,0.04)" : "rgba(201,169,110,0.1)", border: `1px solid ${isPaused ? "rgba(255,255,255,0.08)" : "rgba(201,169,110,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Zap size={18} color={isPaused ? G.textMuted : "#c9a96e"} />
                              </div>
                              {/* Center: task details */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                  <h3 style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary, margin: 0 }}>{task.title}</h3>
                                  <span className={priClass(task.priority)}><Flag size={9} />{task.priority?.toUpperCase()}</span>
                                  <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                                  {isPaused
                                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(126,132,163,0.1)", border: "1px solid rgba(126,132,163,0.25)", fontSize: 9, fontWeight: 800, color: G.textMuted }}>⏸ PAUSED</span>
                                    : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.3)", fontSize: 9, fontWeight: 800, color: "#c9a96e" }}><Zap size={8} /> AUTOPULSE {generation > 0 ? `#${generation}` : "ACTIVE"}</span>
                                  }
                                </div>
                                <p style={{ fontSize: 12, color: G.textSecondary, lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                                  {task.description}
                                </p>
                                {/* Metadata row */}
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <User size={10} />{getName(task.assignedTo)}
                                  </span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <Calendar size={10} />Due: {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#c9a96e" }}>
                                    <Zap size={9} />Every {cycleDays} days
                                  </span>
                                  {generation > 0 && (
                                    <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.cyan }}>
                                      <GitBranch size={9} />Generation #{generation}
                                    </span>
                                  )}
                                  {nextDue && !isPaused && (
                                    <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.amber }}>
                                      <Clock size={9} />Next: {new Date(nextDue).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Right: actions */}
                              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column" }}>
                                {/* Pause / Resume */}
                                <button
                                  onClick={() => {
                                    const updated = { ...task, autopulsePaused: !isPaused };
                                    updateTask(task.id, updated as never);
                                    syncTaskToBackend(updated as Task);
                                    toast(isPaused ? "⚡ Autopulse resumed" : "⏸ Autopulse paused");
                                  }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                                    cursor: "pointer", fontFamily: "inherit",
                                    background: isPaused ? "rgba(201,169,110,0.1)" : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isPaused ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.1)"}`,
                                    color: isPaused ? "#c9a96e" : G.textMuted,
                                  }}
                                >
                                  {isPaused ? <><Zap size={11} /> Resume</> : <>⏸ Pause</>}
                                </button>
                                {/* Review if in-review */}
                                {task.approvalStatus === "in-review" && (
                                  <button className="g-btn-gold" onClick={() => { openReviewModal(task); }}
                                    style={{ padding: "8px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                                    <Eye size={11} /> Review
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}

            {activeTab === "prime" && (() => {
              const primeTasks = allTasksCombined.filter((t: Task) => (t as any).isPrimeDirective);
              const activeP    = primeTasks.filter(t => t.approvalStatus !== "superadmin-approved" && t.approvalStatus !== "rejected" && !(t as any).pdAcknowledgedAt);
              const ackP       = primeTasks.filter(t => !!(t as any).pdAcknowledgedAt);
              const snoozedP   = primeTasks.filter(t => (t as any).pdSnoozedUntil && new Date((t as any).pdSnoozedUntil).getTime() > Date.now());

              return (
                <section style={{ marginTop: 40, paddingBottom: 60 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
                    <div>
                      <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>
                        <Shield size={22} color="#f87171" style={{ display: "inline", marginRight: 10, verticalAlign: "middle" }} />
                        <em style={{ color: "#f87171" }}>Prime</em> Directives
                        <span style={{ marginLeft: 12, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, padding: "2px 8px", color: "#f87171", verticalAlign: "middle" }}>D1</span>
                      </h2>
                      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                        One-time high-priority tasks — flash reminders until acknowledged
                      </p>
                    </div>
                    <button className="g-btn-gold" onClick={() => setShowCreateModal(true)}
                      style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                      <Shield size={13} /> New Prime Directive
                    </button>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
                    {[
                      { label: "Total D1",       value: primeTasks.length,  color: "#f87171", sub: "All prime directives" },
                      { label: "Active",          value: activeP.length,    color: G.danger,   sub: "Pending acknowledgement" },
                      { label: "Acknowledged",    value: ackP.length,       color: G.success,  sub: "Completed + signed off" },
                      { label: "Snoozed",         value: snoozedP.length,   color: G.amber,    sub: "Temporarily paused" },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "18px 20px", background: "rgba(8,14,32,0.65)", border: `1px solid ${s.color}22`, borderRadius: 12, backdropFilter: "blur(16px)" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: G.textMuted }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Empty state */}
                  {primeTasks.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(8,14,32,0.65)", border: "1px dashed rgba(248,113,113,0.2)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                      <Shield size={40} color="rgba(248,113,113,0.25)" />
                      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textMuted, marginTop: 16, marginBottom: 8 }}>No Prime Directives Yet</div>
                      <div style={{ fontSize: 13, color: G.textMuted, marginBottom: 20 }}>Create a task and toggle Prime Directive ON to activate flash reminders.</div>
                      <button className="g-btn-gold" onClick={() => setShowCreateModal(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                        <Shield size={14} /> Create First Prime Directive
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {primeTasks.map((task: Task, idx: number) => {
                        const pd = task as any;
                        const isAcked    = !!pd.pdAcknowledgedAt;
                        const isSnoozed  = pd.pdSnoozedUntil && new Date(pd.pdSnoozedUntil).getTime() > Date.now();
                        const interval   = pd.pdReminderIntervalHours ?? 24;
                        const lastRemind = pd.pdLastReminderAt;
                        const ac         = APPROVAL_COLORS[task.approvalStatus] || G.textMuted;
                        return (
                          <div key={task.id} className="g-card fade-up" style={{
                            animationDelay: `${idx * 40}ms`, padding: "20px 24px",
                            borderColor: isAcked ? "rgba(0,245,160,0.2)" : isSnoozed ? "rgba(245,158,11,0.2)" : "rgba(248,113,113,0.3)",
                            opacity: isAcked ? 0.65 : 1,
                          }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                              {/* Icon */}
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: isAcked ? "rgba(0,245,160,0.08)" : "rgba(248,113,113,0.1)", border: `1px solid ${isAcked ? "rgba(0,245,160,0.3)" : "rgba(248,113,113,0.35)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Shield size={18} color={isAcked ? G.success : "#f87171"} />
                              </div>
                              {/* Details */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                  <h3 style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary, margin: 0 }}>{task.title}</h3>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", fontSize: 9, fontWeight: 800, color: "#f87171" }}>
                                    <Shield size={8} /> D1 PRIME
                                  </span>
                                  <span className={priClass(task.priority)}><Flag size={9} />{task.priority?.toUpperCase()}</span>
                                  <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                                  {isAcked && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(0,245,160,0.08)", border: "1px solid rgba(0,245,160,0.25)", fontSize: 9, fontWeight: 800, color: G.success }}>✓ ACKNOWLEDGED</span>}
                                  {isSnoozed && !isAcked && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 9, fontWeight: 800, color: G.amber }}>⏸ SNOOZED</span>}
                                </div>
                                <p style={{ fontSize: 12, color: G.textSecondary, lineHeight: 1.5, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                                  {task.description}
                                </p>
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={10} />{getName(task.assignedTo)}</span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={10} />Due: {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f87171" }}><Bell size={9} />Every {interval}h</span>
                                  {lastRemind && <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.amber }}><Clock size={9} />Last reminded: {new Date(lastRemind).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                                  {isAcked && pd.pdAcknowledgedBy && <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.success }}>✓ by {pd.pdAcknowledgedBy}</span>}
                                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Bell size={9} />Reminders: {pd.pdReminderCount ?? 0}</span>
                                </div>
                              </div>
                              {/* Actions */}
                              {!isAcked && (
                                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column" }}>
                                  <button onClick={() => setPdFlash(task)}
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
                                    <Bell size={11} /> Preview
                                  </button>
                                  <button onClick={() => {
                                    const snoozeUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
                                    const updated = { ...task, pdSnoozedUntil: snoozeUntil };
                                    updateTask(task.id, updated as never);
                                    syncTaskToBackend(updated as Task);
                                    toast("⏸ Snoozed for 2 hours");
                                  }}
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: G.textMuted }}>
                                    ⏸ Snooze 2h
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })()}

            {activeTab === "taskmap" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>Task <em style={{ color: G.purple }}>Map</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Parent-child forwarding tree with full context</p>
                <ForwardedTaskTree tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} onSelectTask={(task: Task) => { openReviewModal(task); }} />
              </section>
            )}

            {/* ══ PORTFOLIO TAB — Vinay only ══ */}
            {activeTab === "portfolio" && isVinay && !selectedProject && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                  <div>
                    <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 30, fontWeight: 700, color: G.textPrimary, marginBottom: 4 }}>
                      Project <em style={{ color: G.cyan }}>Portfolio</em>
                    </h2>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>
                      {(projects as any[]).length} project{(projects as any[]).length !== 1 ? "s" : ""} in the system
                    </p>
                  </div>
                </div>
                {(projects as any[]).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "72px 24px", background: "rgba(8,14,32,0.65)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
                    <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.3 }}>📁</div>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, color: G.textMuted }}>No projects yet</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
                    {(projects as any[]).map((project: any, idx: number) => {
                      const projTasks = allTasksCombined.filter((t: Task) => t.projectId === project.id);
                      const done    = projTasks.filter((t: Task) => t.approvalStatus === "superadmin-approved").length;
                      const pending = projTasks.filter((t: Task) => t.approvalStatus !== "superadmin-approved").length;
                      const pct     = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
                      return (
                        <div key={project.id}
                          onClick={() => setSelectedProject(project)}
                          style={{ background: "rgba(8,14,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 24px", cursor: "pointer", transition: "all 0.22s", backdropFilter: "blur(16px)", animationDelay: `${idx * 55}ms` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${project.color || G.cyan}55`; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: project.color || G.cyan, boxShadow: `0 0 12px ${project.color || G.cyan}66`, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: G.textPrimary }}>{project.name}</div>
                              {project.projectCode && <div style={{ fontSize: 10, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", marginTop: 2 }}>{project.projectCode}</div>}
                            </div>
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: project.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(212,175,55,0.12)", color: project.status === "active" ? "#10b981" : G.gold, border: `1px solid ${project.status === "active" ? "rgba(16,185,129,0.3)" : "rgba(212,175,55,0.3)"}`, fontWeight: 700, textTransform: "uppercase" as const }}>
                              {project.status || "active"}
                            </span>
                          </div>
                          {project.description && <p style={{ fontSize: 12, color: G.textSecondary, lineHeight: 1.55, marginBottom: 14 }}>{project.description}</p>}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ fontSize: 10, color: G.textMuted, fontWeight: 700 }}>Completion</span>
                              <span style={{ fontSize: 10, color: pct === 100 ? "#10b981" : G.cyan, fontWeight: 700 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${project.color || G.cyan},${project.color || G.cyan}88)`, borderRadius: 3, transition: "width 0.6s ease" }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                            {[{ label: "Total", value: projTasks.length, color: G.cyan }, { label: "Done", value: done, color: "#10b981" }, { label: "Pending", value: pending, color: G.amber }].map(s => (
                              <div key={s.label} style={{ flex: 1, textAlign: "center" as const, padding: "8px 0", background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: 8 }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: "'Oswald',sans-serif" }}>{s.value}</div>
                                <div style={{ fontSize: 9, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: G.cyan, fontWeight: 600 }}>Click to view details →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ══ PORTFOLIO DRILL-DOWN — Vinay only ══ */}
            {activeTab === "portfolio" && isVinay && selectedProject && (() => {
              const proj      = selectedProject;
              const projTasks = allTasksCombined.filter((t: Task) => t.projectId === proj.id);
              const done      = projTasks.filter((t: Task) => t.approvalStatus === "superadmin-approved").length;
              const pending   = projTasks.filter((t: Task) => t.approvalStatus !== "superadmin-approved").length;
              const pct       = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
              const scoreColor = (s: number) => s >= 75 ? "#10b981" : s >= 55 ? G.amber : G.danger;
              const fmtDate    = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

              // Per-member breakdown
              const memberMap: Record<string, { name: string; total: number; done: number; pending: number; scores: number[] }> = {};
              projTasks.forEach((t: any) => {
                if (!memberMap[t.assignedTo]) memberMap[t.assignedTo] = { name: getName(t.assignedTo), total: 0, done: 0, pending: 0, scores: [] };
                memberMap[t.assignedTo].total++;
                if (t.approvalStatus === "superadmin-approved") memberMap[t.assignedTo].done++;
                else memberMap[t.assignedTo].pending++;
                if (t.scoreData?.percentScore != null) memberMap[t.assignedTo].scores.push(t.scoreData.percentScore);
              });
              const memberRows = Object.values(memberMap).sort((a, b) => b.total - a.total);

              return (
                <section style={{ marginTop: 40, paddingBottom: 60 }}>
                  {/* Header + Back */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap" as const, gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <button onClick={() => setSelectedProject(null)}
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 12px", color: G.textMuted, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                        ← Back
                      </button>
                      <div>
                        <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, fontWeight: 700, color: G.textPrimary, marginBottom: 2 }}>
                          <span style={{ color: proj.color || G.cyan }}>●</span> {proj.name}
                        </h2>
                        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted }}>
                          {proj.projectCode && `${proj.projectCode} · `}{proj.projectType || ""}{proj.location ? ` · ${proj.location}` : ""}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, padding: "3px 12px", borderRadius: 6, background: proj.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(212,175,55,0.12)", color: proj.status === "active" ? "#10b981" : G.gold, border: `1px solid ${proj.status === "active" ? "rgba(16,185,129,0.3)" : "rgba(212,175,55,0.3)"}`, fontWeight: 800, textTransform: "uppercase" as const }}>
                      {proj.status || "active"}
                    </span>
                  </div>

                  {/* Summary pills */}
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Total Tasks",  value: projTasks.length,  color: G.cyan    },
                      { label: "Completed",    value: done,              color: "#10b981"  },
                      { label: "Pending",      value: pending,           color: G.amber    },
                      { label: "Completion",   value: `${pct}%`,         color: pct === 100 ? "#10b981" : G.cyan },
                      { label: "Team Members", value: memberRows.length, color: G.purple   },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "12px 20px", background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 12 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Oswald',sans-serif" }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.6px", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Overall progress */}
                  <div style={{ padding: "16px 20px", background: "rgba(8,14,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, marginBottom: 28, backdropFilter: "blur(16px)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>Overall Completion</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? "#10b981" : G.cyan }}>{pct}%</span>
                    </div>
                    <div style={{ height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${proj.color || G.cyan},${proj.color || G.cyan}88)`, borderRadius: 5, transition: "width 0.7s ease", boxShadow: `0 0 12px ${proj.color || G.cyan}55` }} />
                    </div>
                  </div>

                  {/* Per-member breakdown */}
                  {memberRows.length > 0 && (
                    <>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.10em", fontWeight: 700, marginBottom: 16 }}>
                        👥 Team Workload Breakdown
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 28 }}>
                        {memberRows.map((m, i) => {
                          const memberPct = m.total ? Math.round((m.done / m.total) * 100) : 0;
                          const avgScore  = m.scores.length ? Math.round(m.scores.reduce((a, b) => a + b, 0) / m.scores.length) : null;
                          return (
                            <div key={i} style={{ padding: "16px 18px", background: "rgba(8,14,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, backdropFilter: "blur(16px)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: G.textPrimary }}>{m.name}</div>
                                {avgScore !== null && (
                                  <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor(avgScore), padding: "2px 8px", borderRadius: 5, background: `${scoreColor(avgScore)}18`, border: `1px solid ${scoreColor(avgScore)}44` }}>
                                    Avg {avgScore}/100
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                {[{ label: "Total", value: m.total, color: G.cyan }, { label: "Done", value: m.done, color: "#10b981" }, { label: "Pending", value: m.pending, color: G.amber }].map(s => (
                                  <div key={s.label} style={{ flex: 1, textAlign: "center" as const, padding: "6px 0", background: `${s.color}10`, borderRadius: 6 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "'Oswald',sans-serif" }}>{s.value}</div>
                                    <div style={{ fontSize: 8, color: G.textMuted, textTransform: "uppercase" as const }}>{s.label}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${memberPct}%`, background: "linear-gradient(90deg,#10b981,#10b98188)", borderRadius: 2 }} />
                              </div>
                              <div style={{ fontSize: 10, color: G.textMuted, marginTop: 4, textAlign: "right" as const }}>{memberPct}% complete</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Task table */}
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.10em", fontWeight: 700, marginBottom: 16 }}>
                    📋 All Tasks in this Project ({projTasks.length})
                  </div>
                  {projTasks.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 24px", background: "rgba(8,14,32,0.65)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
                      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📋</div>
                      <div style={{ color: G.textMuted }}>No tasks for this project yet</div>
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", background: "rgba(8,14,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                            {["Task", "Assigned To", "Assigned By", "Progress", "Approval", "Start Date", "Due Date", "Completed On", "Score", "Action"].map(h => (
                              <th key={h} style={{ padding: "12px 14px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "0.7px", whiteSpace: "nowrap" as const }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {projTasks.map((task: any) => {
                            const progressMap: Record<string, number> = { "assigned": 20, "in-review": 50, "admin-approved": 75, "superadmin-approved": 100, "rejected": 10 };
                            const colorMap: Record<string, string>   = { "assigned": G.textMuted, "in-review": G.cyan, "admin-approved": G.amber, "superadmin-approved": "#10b981", "rejected": G.danger };
                            const p = progressMap[task.approvalStatus] || 0;
                            const c = colorMap[task.approvalStatus] || G.textMuted;
                            const completedOn = task.approvalStatus === "superadmin-approved" ? (task.completedAt || task.approvedAt || null) : null;
                            return (
                              <tr key={task.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                              >
                                <td style={{ padding: "12px 14px", color: G.textPrimary, fontWeight: 500, maxWidth: 200 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {task.tatBreached && <span style={{ fontSize: 8, color: G.danger }}>⚠</span>}
                                    {task.isFrozen    && <span style={{ fontSize: 8, color: "#b06af3" }}>🔒</span>}
                                    {task.title}
                                  </div>
                                </td>
                                <td style={{ padding: "12px 14px", fontSize: 12, color: G.textSecondary }}>{getName(task.assignedTo)}</td>
                                <td style={{ padding: "12px 14px", fontSize: 11, color: G.amber }}>{task.assignedBy ? getName(task.assignedBy) : "—"}</td>
                                <td style={{ padding: "12px 14px", minWidth: 100 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${p}%`, background: `linear-gradient(90deg,${c},${c}88)`, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: c, width: 28, flexShrink: 0 }}>{p}%</span>
                                  </div>
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: `${c}18`, color: c, border: `1px solid ${c}33`, fontWeight: 700, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
                                    {task.approvalStatus?.replace(/-/g, " ")}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted }}>{fmtDate(task.createdAt)}</td>
                                <td style={{ padding: "12px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10 }}>{fmtDate(task.dueDate)}</td>
                                <td style={{ padding: "12px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: completedOn ? "#10b981" : G.textMuted }}>
                                  {completedOn ? fmtDate(completedOn) : "—"}
                                </td>
                                <td style={{ padding: "12px 14px", textAlign: "center" as const }}>
                                  {task.scoreData ? (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(task.scoreData.percentScore) }}>
                                      {task.scoreData.percentScore}/100
                                      <span style={{ display: "block", fontSize: 9, color: G.textMuted }}>{task.scoreData.grade}</span>
                                    </span>
                                  ) : <span style={{ color: G.textMuted, fontSize: 10 }}>—</span>}
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  <button onClick={() => openReviewModal(task)}
                                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 7, color: G.textSecondary, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
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
                </section>
              );
            })()}
          </div>

          {/* ════ MODALS ════ */}

          {/* ════ ASSISTANCE TICKET REVIEW MODAL ════ */}
          {showTicketModal && selectedTicket && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 1200,
              background: "rgba(2,4,14,0.9)",
              backdropFilter: "blur(20px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}>
              <div style={{
                width: "100%", maxWidth: 560,
                background: "linear-gradient(160deg, rgba(10,14,32,0.99) 0%, rgba(6,8,22,1) 100%)",
                border: "1px solid rgba(255,149,0,0.35)",
                borderRadius: 20, overflow: "hidden",
                boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,149,0,0.06)",
              }}>
                {/* Modal header */}
                <div style={{
                  padding: "22px 24px 18px",
                  background: "linear-gradient(135deg, rgba(255,149,0,0.1), rgba(255,107,53,0.05))",
                  borderBottom: "1px solid rgba(255,149,0,0.15)",
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 13,
                      background: (selectedTicket as any).ticketType === "reschedule-request"
                        ? "rgba(0,212,255,0.12)" : "rgba(255,149,0,0.12)",
                      border: `1px solid ${(selectedTicket as any).ticketType === "reschedule-request" ? "rgba(0,212,255,0.35)" : "rgba(255,149,0,0.35)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>
                      {(selectedTicket as any).ticketType === "reschedule-request" ? "📅" : "🎫"}
                    </div>
                    <div>
                      {/* Task title — prominently displayed (Fix 5) */}
                      <div style={{ fontSize: 18, fontWeight: 800, color: G.textPrimary, fontFamily: "'Oswald',sans-serif", lineHeight: 1.2, marginBottom: 4 }}>
                        {selectedTicket.taskTitle}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
                        <div style={{ fontSize: 10, color: (selectedTicket as any).ticketType === "reschedule-request" ? G.cyan : "#ff9500", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.06em" }}>
                          {(selectedTicket as any).ticketType === "reschedule-request"
                            ? "📅 RESCHEDULE REQUEST"
                            : "🎫 ASSISTANCE TICKET"} · ACTION REQUIRED
                        </div>
                        {/* Ownership badge — confirms this admin owns the ticket (Fix 6) */}
                        {(selectedTicket.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase() && (
                          <span style={{ fontSize: 9, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 4, padding: "1px 6px", color: G.success, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>
                            ✓ YOUR TASK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowTicketModal(false)} style={{ background: "none", border: "none", color: G.textMuted, cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
                </div>

                <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "70vh", overflowY: "auto" }}>
                  {/* Staff info */}
                  <div style={{
                    padding: "14px 16px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 10 }}>Request Details</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11 }}>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>From</div>
                        <div style={{ color: G.textPrimary, fontWeight: 700 }}>
                          {allMembers.find(m => m.email.toLowerCase() === selectedTicket.assignedTo.toLowerCase())?.name ?? selectedTicket.assignedTo}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Task</div>
                        <div style={{ color: G.textPrimary, fontWeight: 700 }}>{selectedTicket.taskTitle}</div>
                      </div>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Original Due Date</div>
                        <div style={{ color: "#ff3366", fontWeight: 700 }}>
                          {new Date(selectedTicket.taskDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Ticket Raised</div>
                        <div style={{ color: G.textSecondary }}>
                          {new Date(selectedTicket.raisedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Staff explanation */}
                  <div style={{
                    padding: "14px 16px",
                    background: "rgba(0,212,255,0.04)",
                    border: "1px solid rgba(0,212,255,0.15)",
                    borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>
                      Staff Explanation for Delay
                    </div>
                    <div style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.7 }}>
                      {selectedTicket.staffNote || <span style={{ color: G.textMuted, fontStyle: "italic" }}>No explanation provided by staff.</span>}
                    </div>
                  </div>

                  {/* What approval does — conditional on ticket type (Fix 7) */}
                  {(selectedTicket as any).ticketType === "reschedule-request" ? (
                    <div>
                      {/* Show proposed date from staffNote */}
                      <div style={{ padding: "12px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 6 }}>Doer&apos;s Proposed Date</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: G.textPrimary }}>
                          {(selectedTicket as any).staffNote?.replace("Proposed date: ", "")
                            ? new Date((selectedTicket as any).staffNote.replace("Proposed date: ", "")).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                            : "Not specified"}
                        </div>
                        <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>
                          Original deadline: {new Date(selectedTicket.taskDueDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      {/* Option to propose a different date */}
                      <div style={{ padding: "10px 12px", background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.15)", borderRadius: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "#ff9500", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 6 }}>Approve with a different date? (optional)</div>
                        <input type="date"
                          value={(selectedTicket as any)._adminProposedDate ?? ""}
                          onChange={e => {
                            // Store admin's counter-proposed date on the ticket object temporarily
                            setSelectedTicket(prev => prev ? { ...prev, _adminProposedDate: e.target.value } as any : prev);
                          }}
                          min={new Date().toISOString().split("T")[0]}
                          style={{ width: "100%", padding: "8px 10px", background: G.bgDeep, border: "1px solid rgba(255,149,0,0.25)", borderRadius: 7, color: G.textPrimary, fontSize: 13, outline: "none", colorScheme: "dark" as const }} />
                        <div style={{ fontSize: 10, color: G.textMuted, marginTop: 4 }}>Leave blank to approve doer&apos;s proposed date</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: "12px 14px",
                      background: "rgba(0,255,136,0.04)",
                      border: "1px solid rgba(0,255,136,0.15)",
                      borderRadius: 10, display: "flex", gap: 10,
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🔓</span>
                      <div style={{ fontSize: 11, color: "rgba(0,255,136,0.75)", lineHeight: 1.7 }}>
                        <strong style={{ color: G.success }}>Approving this ticket will unfreeze the task</strong> and send an approval
                        notification directly to the doer, allowing them to continue working.
                      </div>
                    </div>
                  )}

                  {/* Admin response */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>
                      Your Response / Instructions <span style={{ color: "#ff3366" }}>*</span>
                    </div>
                    <textarea
                      value={ticketReviewNote}
                      onChange={e => setTicketReviewNote(e.target.value)}
                      placeholder="Provide your feedback, instructions, or revised timeline to the doer…"
                      style={{
                        width: "100%", padding: "12px 14px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,149,0,0.25)",
                        borderRadius: 10, color: G.textPrimary,
                        fontSize: 12, fontFamily: "inherit",
                        resize: "vertical", outline: "none",
                        minHeight: 90, lineHeight: 1.6,
                      }}
                      onFocus={e => e.target.style.borderColor = "rgba(255,149,0,0.55)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,149,0,0.25)"}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    <button
                      onClick={() => setShowTicketModal(false)}
                      style={{
                        flex: 1, padding: "13px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10, color: G.textMuted,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >Cancel</button>
                    <button
                      onClick={() => {
                        if (!ticketReviewNote.trim()) return;
                        rejectAssistanceTicket(selectedTicket.id, ticketReviewNote.trim());
                        speakText(`Assistance ticket rejected for ${selectedTicket.taskTitle}. The staff member has been notified.`);
                        setShowTicketModal(false);
                        setSelectedTicket(null);
                        toast("✗ Ticket rejected — doer notified");
                      }}
                      disabled={ticketReviewNote.trim().length < 5}
                      style={{
                        flex: 1, padding: "13px",
                        background: ticketReviewNote.trim().length >= 5 ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.04)",
                        border: ticketReviewNote.trim().length >= 5 ? "1px solid rgba(255,51,102,0.45)" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10, color: ticketReviewNote.trim().length >= 5 ? G.danger : G.textMuted,
                        fontSize: 12, fontWeight: 800,
                        cursor: ticketReviewNote.trim().length >= 5 ? "pointer" : "not-allowed",
                        fontFamily: "inherit", transition: "all 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      <X size={14} /> Reject
                    </button>
                    <button
                      onClick={() => {
                        if (!ticketReviewNote.trim()) return;
                        approveAssistanceTicket(selectedTicket.id, ticketReviewNote.trim());
                        const linkedTaskId = selectedTicket.taskId;
                        // ── Unfreeze the linked task ──────────────────────────
                        if (linkedTaskId) {
                          const linkedTask = allTasksCombined.find((t: Task) => t.id === linkedTaskId) || {} as Task;
                          const isReschedule = (selectedTicket as any).ticketType === "reschedule-request";
                          const adminDate    = (selectedTicket as any)._adminProposedDate;
                          const doerDate     = (selectedTicket as any).staffNote?.replace("Proposed date: ", "") ?? "";
                          const finalDate    = adminDate || doerDate || linkedTask.dueDate;

                          const updatedTask: Task & { isFrozen?: boolean } = {
                            ...linkedTask,
                            isFrozen: false,
                            ...(isReschedule && finalDate ? { dueDate: finalDate } : {}),
                            history: [
                              ...((linkedTask as any).history ?? []),
                              {
                                id:        `hist_${Date.now()}`,
                                timestamp:  new Date().toISOString(),
                                action:     isReschedule ? "reschedule-approved" : "unfreeze-approved",
                                by:         user?.email ?? "admin",
                                notes:      isReschedule
                                  ? `Reschedule approved. New deadline: ${finalDate}. Admin note: ${ticketReviewNote.trim()}`
                                  : `Task unfrozen. Admin note: ${ticketReviewNote.trim()}`,
                              },
                            ],
                          };
                          updateTask(linkedTaskId, updatedTask as never);
                          syncTaskToBackend(updatedTask);

                          // ── Belt-and-suspenders: direct PATCH to guarantee isFrozen clears ──
                          fetch(`${API}/api/tasks/${linkedTaskId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isFrozen: false, ...(isReschedule && finalDate ? { dueDate: finalDate } : {}) }),
                          }).catch(() => {});

                          // ── Also mark the ticket as resolved in the backend ──
                          fetch(`${API}/api/tickets/${selectedTicket.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "resolved", adminComment: ticketReviewNote.trim(), resolvedAt: new Date().toISOString() }),
                          }).catch(() => {});
                        }
                        const isReschedule = (selectedTicket as any).ticketType === "reschedule-request";
                        speakText(isReschedule
                          ? `Reschedule approved for ${selectedTicket.taskTitle}. The task has been rescheduled and the staff member has been notified.`
                          : `Assistance ticket approved for ${selectedTicket.taskTitle}. The task has been unfrozen and the staff member has been notified.`
                        );
                        setShowTicketModal(false);
                        setSelectedTicket(null);
                        toast(isReschedule ? "✓ Reschedule approved — task rescheduled" : "✓ Ticket approved — task unfrozen · Doer notified");
                      }}
                      disabled={ticketReviewNote.trim().length < 5}
                      style={{
                        flex: 2, padding: "13px",
                        background: ticketReviewNote.trim().length >= 5
                          ? "linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,200,100,0.14))"
                          : "rgba(255,255,255,0.04)",
                        border: ticketReviewNote.trim().length >= 5
                          ? `1px solid rgba(0,255,136,0.45)`
                          : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: ticketReviewNote.trim().length >= 5 ? G.success : G.textMuted,
                        fontSize: 12, fontWeight: 800,
                        cursor: ticketReviewNote.trim().length >= 5 ? "pointer" : "not-allowed",
                        fontFamily: "inherit", letterSpacing: "0.04em",
                        boxShadow: ticketReviewNote.trim().length >= 5 ? "0 0 20px rgba(0,255,136,0.15)" : "none",
                        transition: "all 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      <CheckCircle size={14} /> {(selectedTicket as any).ticketType === "reschedule-request" ? "Approve Reschedule" : "Approve & Unfreeze Task"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Raise Assistance Ticket Modal ─────────────────────────────── */}
          {showRaiseTicketModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
              onClick={e => { if (e.target === e.currentTarget) setShowRaiseTicketModal(false); }}>
              <div style={{ background: "#1a1d2e", border: "1px solid rgba(255,149,0,0.3)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#ff9500", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: 4 }}>
                      {raiseTicketType === "delete-request" ? "🗑 Delete Request Ticket" : "🎫 Raise Assistance Ticket"}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf6", fontFamily: "'Oswald',sans-serif" }}>
                      {raiseTicketTask?.title}
                    </div>
                  </div>
                  <button onClick={() => setShowRaiseTicketModal(false)} style={{ background: "none", border: "none", color: "#7e84a3", cursor: "pointer", fontSize: 20 }}>✕</button>
                </div>

                {raiseTicketType === "delete-request" && (
                  <div style={{ padding: "10px 14px", background: "rgba(255,51,102,0.07)", border: "1px solid rgba(255,51,102,0.2)", borderRadius: 10, marginBottom: 16, fontSize: 11, color: "rgba(255,100,120,0.9)", lineHeight: 1.7 }}>
                    ⚠ <strong>Admins cannot delete tasks directly.</strong> This ticket will be sent to the superadmin for approval. The task will remain active until the superadmin approves the deletion.
                  </div>
                )}

                {/* Ticket Type (only shown when not delete-request) */}
                {raiseTicketType !== "delete-request" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#7e84a3", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>Ticket Type</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                      {(["small-activity","general-query","task-delegation"] as const).map(type => (
                        <button key={type} onClick={() => setRaiseTicketType(type)}
                          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${raiseTicketType === type ? "#00d4ff" : "rgba(255,255,255,0.1)"}`, background: raiseTicketType === type ? "rgba(0,212,255,0.1)" : "transparent", color: raiseTicketType === type ? "#00d4ff" : "#7e84a3", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const }}>
                          {type.replace("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assign To */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#7e84a3", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>
                    {raiseTicketType === "delete-request" ? "Assigned To (Superadmin)" : "Assign To"}
                  </div>
                  {raiseTicketType === "delete-request" ? (
                    <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 12, color: "#c8ccdd" }}>
                      Superadmin — Pushkaraj Gore
                    </div>
                  ) : (
                    <select value={raiseTicketAssignTo} onChange={e => setRaiseTicketAssignTo(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", background: "#12142a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#c8ccdd", fontSize: 12, outline: "none" }}>
                      <option value="">— Select recipient —</option>
                      {allMembers.filter(m => m.email !== user?.email).map(m => (
                        <option key={m.id} value={m.email}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Reason / Note */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#7e84a3", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>
                    {raiseTicketType === "delete-request" ? "Reason for Deletion *" : "Description / Instructions *"}
                  </div>
                  <textarea value={raiseTicketNote} onChange={e => setRaiseTicketNote(e.target.value)}
                    placeholder={raiseTicketType === "delete-request" ? "Explain why this task needs to be deleted…" : "Describe the activity, query, or delegation details…"}
                    style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,149,0,0.2)", borderRadius: 10, color: "#e8eaf6", fontSize: 12, resize: "vertical", outline: "none", minHeight: 90, lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" as const }}
                    onFocus={e => e.target.style.borderColor = "rgba(255,149,0,0.5)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,149,0,0.2)"}
                  />
                </div>

                {/* Document Attachments */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#7e84a3", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>
                    Supporting Documents (optional)
                  </div>
                  <input ref={raiseTicketFileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }} onChange={handleRaiseTicketAttachment} />
                  <button onClick={() => raiseTicketFileRef.current?.click()}
                    style={{ padding: "8px 16px", background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 8, color: "#7e84a3", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <Upload size={12} /> Attach Files
                  </button>
                  {raiseTicketAttachments.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#00d4ff" }}>
                      ✓ {raiseTicketAttachments.length} file{raiseTicketAttachments.length > 1 ? "s" : ""} attached
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowRaiseTicketModal(false)}
                    style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#7e84a3", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmitRaiseTicket}
                    disabled={raiseTicketNote.trim().length < 5 || (raiseTicketType !== "delete-request" && !raiseTicketAssignTo)}
                    style={{
                      flex: 2, padding: "12px",
                      background: raiseTicketNote.trim().length >= 5 ? "linear-gradient(135deg, rgba(255,149,0,0.2), rgba(255,149,0,0.12))" : "rgba(255,255,255,0.04)",
                      border: raiseTicketNote.trim().length >= 5 ? "1px solid rgba(255,149,0,0.45)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10, color: raiseTicketNote.trim().length >= 5 ? "#ff9500" : "#7e84a3",
                      fontSize: 12, fontWeight: 800, cursor: raiseTicketNote.trim().length >= 5 ? "pointer" : "not-allowed",
                      fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    🎫 {raiseTicketType === "delete-request" ? "Submit Delete Request" : "Raise Ticket"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Delete Modal */}
          {confirmDelete && (
            <ConfirmDeleteModal
              message={confirmDelete.message}
              onConfirm={confirmDelete.onConfirm}
              onCancel={() => setConfirmDelete(null)}
            />
          )}

          {/* Task List Drill-Down Modal */}
          {showTaskListModal && (
            <TaskListModal
              title={taskListModalTitle}
              tasks={taskListModalTasks}
              getNameFn={getName}
              accentColor={taskListModalColor}
              onClose={() => setShowTaskListModal(false)}
              onDeleteTask={(task) => {
                setShowTaskListModal(false);
                requestDeleteTask(task);
              }}
              onSelectTask={(task) => {
                setShowTaskListModal(false);
                const isReviewable = (["in-review","admin-approved"] as string[]).includes(task.approvalStatus);
                if (isReviewable) { openReviewModal(task); }
                else { setHistoryTask(task); setShowHistoryModal(true); }
              }}
            />
          )}

          {showGlobalHistory && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGlobalHistory(false); }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
                <ModalHeader title="Master History Log" sub="Your task activity — tasks you assigned or were assigned to you" onClose={() => setShowGlobalHistory(false)} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <HistoryTimeline
                    history={(() => {
                      const myEmail = (user?.email ?? "").toLowerCase();
                      const merged = new Map<string, HistoryEntry & { taskTitle?: string; taskId: string }>();
                      // Only include history from tasks this admin assigned OR was assigned to them
                      allTasksCombined
                        .filter(t =>
                          (t.assignedBy ?? "").toLowerCase() === myEmail ||
                          (t.assignedTo ?? "").toLowerCase() === myEmail
                        )
                        .flatMap(t =>
                          (t.history ?? []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id }))
                        )
                        .forEach(e => merged.set(e.id, e));
                      return Array.from(merged.values())
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    })()}
                    getNameFn={getName}
                    compact={false}
                  />
                </div>
              </div>
            </div>
          )}

          {showCreateModal && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
              <div className="g-modal" style={{ maxHeight: "90vh" }}>
                <ModalHeader title="Assign New Task" sub="Task pushed to assignee dashboard immediately" onClose={() => setShowCreateModal(false)} accent={G.cyan} />
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
                    <div>
                      <label className="g-label">Purpose</label>
                      <select className="g-input" value={newTask.purpose} onChange={(e) => setNewTask({ ...newTask, purpose: e.target.value })}>
                        <option value="">— Select purpose —</option>
                        <optgroup label="BRAND INTERNAL USE CREATIVE / VIDEOS / BROCHURE">
                          <option value="LEAD GEN CREATIVES / VIDEOS">1. LEAD GEN CREATIVES / VIDEOS</option>
                          <option value="PR CREATIVES / VIDEOS">2. PR CREATIVES / VIDEOS</option>
                          <option value="SOCIAL MEDIA CREATIVES / VIDEOS">3. SOCIAL MEDIA CREATIVES / VIDEOS</option>
                          <option value="CORE CREATIVES / VIDEOS">4. CORE CREATIVES / VIDEOS</option>
                          <option value="WISHING CREATIVES / VIDEOS">5. WISHING CREATIVES / VIDEOS</option>
                          <option value="OFFLINE CREATIVES / VIDEOS">6. OFFLINE CREATIVES / VIDEOS</option>
                          <option value="WEBSITE CREATIVES / VIDEOS">7. WEBSITE CREATIVES / VIDEOS</option>
                          <option value="RECORDING / SHOOTING VIDEOS">8. RECORDING / SHOOTING VIDEOS</option>
                          <option value="EVENT OR SITE BRANDING">9. EVENT OR SITE BRANDING</option>
                          <option value="AI SYSTEMS & AUTOMATION">10. AI SYSTEMS & AUTOMATION</option>
                          <option value="MAKLER CREATIVES / VIDEOS">11. MAKLER CREATIVES / VIDEOS</option>
                          <option value="CP CREATIVES / VIDEOS">12. CP CREATIVES / VIDEOS</option>
                        </optgroup>
                      </select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label">Project *</label>
                      {activeProjects.length === 0 ? (
                        <div style={{ padding: "12px 14px", background: G.amberDim, border: "1px solid rgba(255,159,10,0.3)", borderRadius: 8, color: G.amber, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace" }}>⚠ No active projects.</div>
                      ) : (
                        <select className="g-input" value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                          <option value="">— Select a project —</option>
                          {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.projectCode ? ` · ${p.projectCode}` : ""}</option>)}
                        </select>
                      )}
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label">Description *</label>
                      <textarea className="g-input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Detailed description…" style={{ minHeight: 90, resize: "vertical" as const }} />
                    </div>

                    {/* ── Voice Note Recorder ───────────────────────────── */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Radio size={11} color={isRecording ? "#ff3366" : "#c9a96e"} />
                        Voice Note
                        <span style={{ fontSize: 9, color: "#7e84a3", fontWeight: 400, textTransform: "none" as const, letterSpacing: 0 }}>(optional — attach a spoken brief for the doer)</span>
                      </label>

                      {/* Not recording, no note yet */}
                      {!isRecording && !voiceNoteUrl && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                              chunksRef.current = [];
                              const mr = new MediaRecorder(stream);
                              mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                              mr.onstop = async () => {
                                stream.getTracks().forEach(t => t.stop());
                                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                                setIsRecording(false);
                                setRecordingSeconds(0);
                                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                                setVoiceNoteBlob(blob);
                                // Preview via local object URL
                                const localUrl = URL.createObjectURL(blob);
                                setVoiceNoteLocalUrl(localUrl);
                                // Upload to Cloudinary so URL is small & accessible by doer
                                setIsUploadingVoice(true);
                                try {
                                  const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
                                  const cdnUrl = await uploadToCloudinary(file, "roswalt/voice-notes");
                                  setVoiceNoteUrl(cdnUrl);
                                  toast("✓ Voice note uploaded");
                                } catch {
                                  toast("✕ Voice note upload failed — please re-record");
                                  setVoiceNoteBlob(null);
                                  setVoiceNoteLocalUrl("");
                                } finally {
                                  setIsUploadingVoice(false);
                                }
                              };
                              mediaRecorderRef.current = mr;
                              mr.start();
                              setIsRecording(true);
                              setRecordingSeconds(0);
                              recordingTimerRef.current = setInterval(() => {
                                setRecordingSeconds(s => {
                                  const next = s + 1;
                                  if (next >= 30) {
                                    // Auto-stop at 30 seconds
                                    mediaRecorderRef.current?.stop();
                                    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                                  }
                                  return next;
                                });
                              }, 1000);
                            } catch {
                              toast("⚠ Microphone access denied. Please allow microphone in your browser.");
                            }
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "10px 18px", borderRadius: 9,
                            background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.3)",
                            color: "#c9a96e", fontSize: 12, fontWeight: 700, cursor: "pointer",
                            fontFamily: "inherit", letterSpacing: "0.4px",
                            transition: "all 0.18s",
                          }}
                        >
                          <Radio size={13} /> Start Voice Recording
                        </button>
                      )}

                      {/* Recording in progress */}
                      {isRecording && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px", borderRadius: 9,
                          background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.35)",
                        }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff3366", boxShadow: "0 0 10px #ff3366", animation: "badgePulse 1s ease-in-out infinite", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#ff3366", fontFamily: "'IBM Plex Mono',monospace" }}>
                            REC {String(recordingSeconds).padStart(2,"0")}s
                          </span>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: 4 }}>
                            <span style={{ fontSize: 11, color: recordingSeconds >= 25 ? "#ff9500" : "#7e84a3" }}>
                              {recordingSeconds >= 25 ? `⚠ Auto-stops in ${30 - recordingSeconds}s` : "Recording in progress…"}
                            </span>
                            {/* Progress bar */}
                            <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{
                                height: "100%",
                                width: `${(recordingSeconds / 30) * 100}%`,
                                background: recordingSeconds >= 25 ? "#ff9500" : "#ff3366",
                                borderRadius: 2,
                                transition: "width 1s linear",
                                boxShadow: `0 0 6px ${recordingSeconds >= 25 ? "#ff9500" : "#ff3366"}`,
                              }} />
                            </div>
                            <span style={{ fontSize: 9, color: "#434763", fontFamily: "'IBM Plex Mono',monospace" }}>
                              {30 - recordingSeconds}s remaining · max 30s
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              mediaRecorderRef.current?.stop();
                            }}
                            style={{
                              padding: "6px 14px", borderRadius: 7,
                              background: "rgba(255,51,102,0.15)", border: "1px solid rgba(255,51,102,0.5)",
                              color: "#ff3366", fontSize: 11, fontWeight: 800,
                              cursor: "pointer", fontFamily: "inherit",
                              textTransform: "uppercase" as const, letterSpacing: "0.5px",
                            }}
                          >
                            ■ Stop
                          </button>
                        </div>
                      )}

                      {/* Uploading spinner */}
                      {isUploadingVoice && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 16px", borderRadius: 9,
                          background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.25)",
                        }}>
                          <Loader size={13} color="#c9a96e" style={{ animation: "sdSpin 0.9s linear infinite" }} />
                          <span style={{ fontSize: 12, color: "#c9a96e", fontWeight: 600 }}>Uploading voice note…</span>
                        </div>
                      )}

                      {/* Voice note recorded & uploaded — preview + delete */}
                      {voiceNoteLocalUrl && !isRecording && !isUploadingVoice && (
                        <div style={{
                          padding: "12px 14px", borderRadius: 9,
                          background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.3)",
                          display: "flex", flexDirection: "column" as const, gap: 10,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <Radio size={12} color="#c9a96e" />
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#c9a96e" }}>Voice Note Ready</span>
                              {voiceNoteUrl
                                ? <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.25)", color: "#00ff88", fontWeight: 700 }}>✓ UPLOADED</span>
                                : <span style={{ fontSize: 9, color: "#ff9500" }}>uploading…</span>
                              }
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setVoiceNoteUrl("");
                                setVoiceNoteLocalUrl("");
                                setVoiceNoteBlob(null);
                                chunksRef.current = [];
                              }}
                              style={{ background: "none", border: "none", color: "#ff3366", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                              title="Delete voice note"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <audio
                            src={voiceNoteLocalUrl}
                            controls
                            style={{ width: "100%", height: 36, accentColor: "#c9a96e" }}
                          />
                          <div style={{ fontSize: 10, color: "#7e84a3", display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ color: "#c9a96e" }}>✓</span>
                            Voice note uploaded to cloud — the doer will hear it on their task card.
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                  {selectedMember && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: selectedMember.role === "admin" ? G.goldDim : G.successDim, border: `1px solid ${selectedMember.role === "admin" ? G.goldBorder : G.successBorder}`, borderRadius: 10, marginBottom: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: selectedMember.role === "admin" ? `linear-gradient(135deg,${G.gold},${G.amber})` : G.success, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                    <div style={{ padding: "8px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.gold, fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock size={12} />Deadline: {new Date(computeExactDeadline(newTask.dueDate, newTask.timeSlot)).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  {/* ── Autopulse Toggle ─────────────────────────────────── */}
                  <div style={{
                    marginBottom: 16, padding: "14px 16px", borderRadius: 10,
                    background: (newTask as any).isAutopulse ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${(newTask as any).isAutopulse ? "rgba(201,169,110,0.35)" : "rgba(255,255,255,0.08)"}`,
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: (newTask as any).isAutopulse ? "rgba(201,169,110,0.15)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${(newTask as any).isAutopulse ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.1)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Zap size={15} color={(newTask as any).isAutopulse ? "#c9a96e" : "#7e84a3"} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: (newTask as any).isAutopulse ? "#c9a96e" : G.textSecondary }}>
                            Autopulse
                          </div>
                          <div style={{ fontSize: 10, color: G.textMuted }}>
                            {(newTask as any).isAutopulse
                              ? `Repeats every ${(newTask as any).autopulseCycleDays} days after admin approval`
                              : "Enable to make this a recurring weekly task"}
                          </div>
                        </div>
                      </div>
                      {/* Toggle pill */}
                      <div
                        onClick={() => setNewTask({ ...newTask, isAutopulse: !(newTask as any).isAutopulse } as any)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                          background: (newTask as any).isAutopulse ? "#c9a96e" : "rgba(255,255,255,0.1)",
                          position: "relative", transition: "background 0.2s", flexShrink: 0,
                          border: `1px solid ${(newTask as any).isAutopulse ? "#c9a96e" : "rgba(255,255,255,0.15)"}`,
                        }}
                      >
                        <div style={{
                          position: "absolute", top: 2,
                          left: (newTask as any).isAutopulse ? 22 : 2,
                          width: 18, height: 18, borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }} />
                      </div>
                    </div>

                    {/* Cycle days input — shown only when Autopulse is ON */}
                    {(newTask as any).isAutopulse && (
                      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: G.textMuted, whiteSpace: "nowrap" as const }}>Repeat every</span>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={(newTask as any).autopulseCycleDays}
                          onChange={(e) => setNewTask({ ...newTask, autopulseCycleDays: Math.max(1, parseInt(e.target.value) || 7) } as any)}
                          style={{
                            width: 64, padding: "5px 10px",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(201,169,110,0.4)",
                            borderRadius: 7, color: "#c9a96e",
                            fontSize: 13, fontWeight: 700,
                            fontFamily: "'IBM Plex Mono',monospace",
                            outline: "none", textAlign: "center" as const,
                          }}
                        />
                        <span style={{ fontSize: 11, color: G.textMuted }}>days after approval</span>
                        <div style={{
                          marginLeft: "auto", fontSize: 10, padding: "3px 9px", borderRadius: 5,
                          background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.25)",
                          color: "#c9a96e", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700,
                        }}>
                          AUTOPULSE ON
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prime Directive toggle */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", display: "flex", alignItems: "center", gap: 6 }}>
                        <Shield size={13} /> Prime Directive — <span style={{ fontSize: 9, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>D1</span>
                      </div>
                      <div style={{ fontSize: 10, color: G.textMuted, marginTop: 2 }}>High-priority one-time task with flash screen reminders</div>
                    </div>
                    <button type="button" onClick={() => setNewTask((p: any) => ({ ...p, isPrimeDirective: !p.isPrimeDirective }))}
                      style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative" as const, background: (newTask as any).isPrimeDirective ? "rgba(248,113,113,0.7)" : "rgba(255,255,255,0.1)", transition: "all 0.2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: (newTask as any).isPrimeDirective ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </button>
                  </div>
                  {(newTask as any).isPrimeDirective && (
                    <div style={{ padding: "10px 14px", background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8 }}>
                      <label style={{ fontSize: 10, color: G.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.1em", fontFamily: "'IBM Plex Mono',monospace" }}>Flash reminder every (hours)</label>
                      <input type="number" min={1} max={168} value={(newTask as any).pdReminderIntervalHours ?? 24}
                        onChange={e => setNewTask((p: any) => ({ ...p, pdReminderIntervalHours: parseInt(e.target.value) || 24 }))}
                        style={{ width: "100%", marginTop: 6, padding: "8px 10px", background: G.bgDeep, border: "1px solid rgba(248,113,113,0.25)", borderRadius: 7, color: G.textPrimary, fontSize: 14, outline: "none" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-gold" onClick={handleCreateTask} disabled={isUploadingVoice} style={{ flex: 1, opacity: isUploadingVoice ? 0.5 : 1 }}>{isUploadingVoice ? <><Loader size={14} style={{ animation: "sdSpin 0.9s linear infinite" }} /> Uploading Voice…</> : <><CheckCircle size={14} strokeWidth={2.5} />Assign Task</>}</button>
                    <button className="g-btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showForwardModal && forwardTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); } }}>
              <div className="g-modal">
                <ModalHeader title={`Forward: ${forwardTask.title}`} sub="Delegate while preserving full context" onClose={() => { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); }} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 18 }}>
                    <div style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6 }}>{forwardTask.description}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <span>Priority: {forwardTask.priority?.toUpperCase()}</span><span>·</span>
                      <span>Due: {new Date(forwardTask.dueDate).toLocaleDateString()}</span>
                      {forwardTask.timeSlot && <span>· {forwardTask.timeSlot}</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Forward to *</label>
                    <select className="g-input" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)}>
                      <option value="">Select a team member...</option>
                      {assignableStaff.length > 0  && <optgroup label="── STAFF ──">{assignableStaff.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                      {assignableAdmins.length > 0 && <optgroup label="── ADMINS ──">{assignableAdmins.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                    </select>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label className="g-label">Notes (Optional)</label>
                    <textarea className="g-input" value={forwardNotes} onChange={(e) => setForwardNotes(e.target.value)} placeholder="Add context for the new assignee…" style={{ minHeight: 90, resize: "vertical" as const }} />
                  </div>
                  <div style={{ padding: "10px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.textSecondary, display: "flex", gap: 8 }}>
                    <GitBranch size={14} color={G.gold} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><strong style={{ color: G.gold }}>Context Linking:</strong> Full history and parent-child relationship is preserved.</div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-gold" onClick={handleForwardTask} disabled={!forwardTo} style={{ flex: 1 }}><Share2 size={14} />Forward Task</button>
                    <button className="g-btn-ghost" onClick={() => { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showHistoryModal && historyTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowHistoryModal(false); setHistoryTask(null); } }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
                <ModalHeader title={`History: ${historyTask.title}`} sub="Complete activity timeline for this task" onClose={() => { setShowHistoryModal(false); setHistoryTask(null); }} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                    <span className={priClass(historyTask.priority)}><Flag size={9} />{historyTask.priority?.toUpperCase()}</span>
                    <span className="g-badge g-badge-gold"><User size={9} />{getName(historyTask.assignedTo)}</span>
                    {historyTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                    {historyTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{historyTask.timeSlot}</span>}
                  </div>
                  <HistoryTimeline
                    history={(() => {
                      const persisted = getTaskHistory(historyTask.id, user?.email);
                      const inMemory = historyTask.history ?? [];
                      const merged = new Map<string, HistoryEntry>();
                      inMemory.forEach(e => merged.set(e.id, e));
                      persisted.forEach(e => { if (!merged.has(e.id)) merged.set(e.id, e); });
                      return Array.from(merged.values()).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    })()}
                    getNameFn={getName}
                    filterByTaskId={historyTask.id}
                    compact={false}
                  />
                  <div style={{ marginTop: 20 }}>
                    <button className="g-btn-ghost" onClick={() => { setShowHistoryModal(false); setHistoryTask(null); }} style={{ width: "100%" }}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showAdminSubmitModal && adminSubmitTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowAdminSubmitModal(false); setAdminSubmitTask(null); setAdminSubmitNotes(""); } }}>
              <div className="g-modal" style={{ maxHeight: "90vh" }}>
                <ModalHeader title={`Submit: ${adminSubmitTask.title}`} sub="Choose where to route this task after submission" onClose={() => { setShowAdminSubmitModal(false); setAdminSubmitTask(null); setAdminSubmitNotes(""); }} accent={G.gold} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Completion Notes</label>
                    <textarea className="g-input" value={adminSubmitNotes} onChange={(e) => setAdminSubmitNotes(e.target.value)} placeholder="Describe what was completed..." style={{ minHeight: 100, resize: "vertical" as const }} />
                  </div>
                  <div style={{ padding: "12px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 10, marginBottom: 16, fontSize: 12, color: G.textSecondary }}>
                    📋 Where should this task go after submission?
                  </div>
                  <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
                    <button className="g-btn-success" onClick={() => {
                      const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "completed", by: user?.email ?? "", notes: `Submitted to Admin for review. ${adminSubmitNotes}` };
                      appendHistoryEntry(adminSubmitTask.id, h, user?.email);
                      const updated = { ...adminSubmitTask, completionNotes: adminSubmitNotes, approvalStatus: "in-review" as any, completedAt: new Date().toISOString(), history: [...(adminSubmitTask.history ?? []), h] };
                      updateTask(adminSubmitTask.id, updated as never);
                      syncTaskToBackend(updated as Task);
                      toast("✓ Task submitted to Admin for review.");
                      setShowAdminSubmitModal(false); setAdminSubmitTask(null); setAdminSubmitNotes("");
                    }}><CheckCircle size={14} />Send to Admin for Review</button>
                    <button className="g-btn-gold" onClick={() => {
                      const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "approved", by: user?.email ?? "", notes: `Directly submitted to Superadmin. ${adminSubmitNotes}` };
                      appendHistoryEntry(adminSubmitTask.id, h, user?.email);
                      const updated = { ...adminSubmitTask, completionNotes: adminSubmitNotes, approvalStatus: "admin-approved" as any, completedAt: new Date().toISOString(), history: [...(adminSubmitTask.history ?? []), h] };
                      updateTask(adminSubmitTask.id, updated as never);
                      syncTaskToBackend(updated as Task);
                      toast("✓ Task sent directly to Superadmin.");
                      setShowAdminSubmitModal(false); setAdminSubmitTask(null); setAdminSubmitNotes("");
                    }}><Shield size={14} />Send to Superadmin Directly</button>
                    <button className="g-btn-ghost" onClick={() => { setShowAdminSubmitModal(false); setAdminSubmitTask(null); setAdminSubmitNotes(""); }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showReviewModal && selectedTask && (() => {
            const scoreData = (selectedTask as any).scoreData;
            const scoreReportUrl = (selectedTask as any).scoreReportUrl || (selectedTask as any).scoreData?.reportUrl;
            return (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); } }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
                <ModalHeader title={`Review: ${selectedTask.title}`} sub="Approve to forward to Superadmin, or send back for rework" onClose={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }} accent={G.gold} />
                {reviewTaskLoading && (
                  <div style={{ padding: "8px 28px", background: "rgba(0,212,255,0.05)", borderBottom: "1px solid rgba(0,212,255,0.12)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: G.cyan, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <Loader size={11} style={{ animation: "spin 1s linear infinite" }} />
                      Fetching full submission data — attachments, score, notes…
                    </div>
                    <div style={{ marginTop: 6, height: 2, background: "rgba(0,212,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: `linear-gradient(90deg, ${G.success}, ${G.cyan})`, animation: "progressBar 1.8s ease-in-out infinite" }} />
                    </div>
                  </div>
                )}
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                    <span className={priClass(selectedTask.priority)}><Flag size={9} />{selectedTask.priority?.toUpperCase()}</span>
                    <span className="g-badge g-badge-gold"><User size={9} />{getName(selectedTask.assignedTo)}</span>
                    {selectedTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                    {selectedTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{selectedTask.timeSlot}</span>}
                    {selectedTask.purpose && <span className="g-badge" style={{ background: "rgba(0,212,255,0.08)", color: G.cyan, border: `1px solid ${G.cyan}44` }}>{selectedTask.purpose}</span>}
                    {(selectedTask as any).isAutopulse && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 5, background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.35)", fontSize: 9, fontWeight: 800, color: "#c9a96e", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                        <Zap size={9} /> AUTOPULSE {(selectedTask as any).autopulseGeneration > 0 ? `#${(selectedTask as any).autopulseGeneration}` : "ACTIVE"}
                      </span>
                    )}
                  </div>

                  {/* ── Autopulse info banner — shown when approving a recurring task ── */}
                  {(selectedTask as any).isAutopulse && (
                    <div style={{
                      marginBottom: 14, padding: "12px 14px", borderRadius: 10,
                      background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.28)",
                      display: "flex", alignItems: "flex-start", gap: 10,
                    }}>
                      <Zap size={14} color="#c9a96e" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#c9a96e", marginBottom: 3 }}>
                          Autopulse Task — Approving will schedule the next cycle
                        </div>
                        <div style={{ fontSize: 11, color: G.textMuted, lineHeight: 1.6 }}>
                          This is a recurring task (every <strong style={{ color: "#c9a96e" }}>{(selectedTask as any).autopulseCycleDays ?? 7} days</strong>).
                          Once you approve, a fresh instance will be automatically assigned to{" "}
                          <strong style={{ color: G.textSecondary }}>{getName(selectedTask.assignedTo)}</strong> in{" "}
                          <strong style={{ color: "#c9a96e" }}>{(selectedTask as any).autopulseCycleDays ?? 7} days</strong>.
                          {(selectedTask as any).autopulseGeneration > 0 && (
                            <span style={{ marginLeft: 4, padding: "1px 6px", borderRadius: 3, background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)", fontSize: 9, color: "#c9a96e", fontWeight: 700 }}>
                              Generation #{(selectedTask as any).autopulseGeneration}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Voice Note — admin's brief attached to this task ── */}
                  {(selectedTask as any).voiceNote && (
                    <div style={{
                      marginBottom: 14, padding: "12px 14px", borderRadius: 10,
                      background: "rgba(201,169,110,0.07)", border: "1px solid rgba(201,169,110,0.3)",
                      display: "flex", flexDirection: "column" as const, gap: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <Radio size={11} color="#c9a96e" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a96e", textTransform: "uppercase" as const, letterSpacing: "0.7px" }}>
                          Voice Brief (attached by assigner)
                        </span>
                      </div>
                      <audio src={(selectedTask as any).voiceNote} controls style={{ width: "100%", height: 36, accentColor: "#c9a96e" }} />
                    </div>
                  )}

                  {/* ── AI Score Panel ── */}
                  {scoreData && (
                    <div style={{ padding: "16px 18px", background: "rgba(0,212,255,0.05)", border: `1px solid rgba(0,212,255,0.2)`, borderRadius: 12, marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" as const, gap: 10 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.cyan, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>🎯 AI Score Report</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 22, fontWeight: 900, color: scoreData.percentScore >= 75 ? G.success : scoreData.percentScore >= 55 ? G.amber : G.danger, fontFamily: "'Oswald',sans-serif" }}>
                            {scoreData.percentScore}/100
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: scoreData.percentScore >= 75 ? "rgba(0,255,136,0.15)" : scoreData.percentScore >= 55 ? "rgba(255,149,0,0.15)" : "rgba(255,51,102,0.15)", color: scoreData.percentScore >= 75 ? G.success : scoreData.percentScore >= 55 ? G.amber : G.danger }}>
                            Grade {scoreData.grade}
                          </span>
                          {scoreReportUrl && (
                            <a href={scoreReportUrl} target="_blank" rel="noreferrer"
                              style={{ padding: "6px 14px", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.4)", borderRadius: 8, color: G.cyan, fontSize: 11, fontWeight: 800, textDecoration: "none", display: "flex", alignItems: "center", gap: 6, boxShadow: `0 0 12px ${G.cyan}22` }}>
                              📄 View Score Report
                            </a>
                          )}
                        </div>
                      </div>
                      {scoreData.verdict && <p style={{ fontSize: 12, color: G.textSecondary, marginBottom: 10, lineHeight: 1.6 }}>{scoreData.verdict}</p>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: scoreData.grammarClean ? "rgba(0,255,136,0.1)" : "rgba(255,51,102,0.1)", color: scoreData.grammarClean ? G.success : G.danger, border: `1px solid ${scoreData.grammarClean ? "rgba(0,255,136,0.3)" : "rgba(255,51,102,0.3)"}` }}>
                          {scoreData.grammarClean ? "✓ Grammar Clean" : "⚠ Grammar Issues"}
                        </span>
                        {(scoreData.categories || []).map((c: any) => (
                          <span key={c.name} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: G.textSecondary, border: "1px solid rgba(255,255,255,0.08)" }}>
                            {c.name}: {c.score}/20
                          </span>
                        ))}
                      </div>
                      {(scoreData.strengths || []).length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 9, color: G.success, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 4 }}>Strengths</div>
                          {scoreData.strengths.slice(0, 3).map((s: string, i: number) => (
                            <div key={i} style={{ fontSize: 11, color: G.textSecondary, marginBottom: 2 }}>+ {s}</div>
                          ))}
                        </div>
                      )}
                      {(scoreData.improvements || []).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 9, color: G.amber, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 4 }}>Improvements</div>
                          {scoreData.improvements.slice(0, 3).map((s: string, i: number) => (
                            <div key={i} style={{ fontSize: 11, color: G.textSecondary, marginBottom: 2 }}>- {s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 14 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 8 }}>Description</div>
                    <p style={{ fontSize: 14, color: G.textSecondary, lineHeight: 1.65 }}>{selectedTask.description}</p>
                  </div>
                  {selectedTask.completionNotes && (
                    <div style={{ padding: "14px 16px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 10, marginBottom: 14 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.gold, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 8 }}>📝 Completion Notes</div>
                      <p style={{ fontSize: 14, color: G.textSecondary, lineHeight: 1.65 }}>{selectedTask.completionNotes}</p>
                    </div>
                  )}
                  {/* ── Score Report Banner (always shown if report exists) ── */}
                  {(() => {
                    const reportUrl = (selectedTask as any).scoreReportUrl || (selectedTask as any).scoreData?.reportUrl;
                    if (!reportUrl) return null;
                    return (
                      <div style={{ marginBottom: 14, padding: "12px 16px", background: `${G.cyan}08`, border: `1px solid ${G.cyan}25`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontSize: 24, flexShrink: 0 }}>📊</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: G.cyan, marginBottom: 2 }}>AI Score Report Attached</div>
                          <div style={{ fontSize: 10, color: G.textMuted }}>Full breakdown of scores, grammar issues, strengths and improvements</div>
                        </div>
                        <a href={reportUrl} target="_blank" rel="noreferrer"
                          style={{ flexShrink: 0, padding: "8px 18px", background: `${G.cyan}18`, border: `1px solid ${G.cyan}44`, borderRadius: 9, color: G.cyan, fontSize: 12, fontWeight: 800, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                          📄 Open Report
                        </a>
                      </div>
                    );
                  })()}

                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (() => {
                    const AttachmentPreview = ({ src, i }: { src: string; i: number }) => {
                      const [expanded, setExpanded] = React.useState(false);
                      const isImage = !!(src.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) || src.includes("/image/"));
                      const isVideo = !!(src.match(/\.(mp4|mov|webm|avi|mkv)(\?|$)/i) || src.includes("/video/"));
                      const isPdf   = !!(src.match(/\.pdf(\?|$)/i) || src.includes("/raw/") && src.includes(".pdf"));
                      const fname   = decodeURIComponent(src.split("/").pop()?.split("?")[0] || `Attachment ${i + 1}`);
                      const icon    = isImage ? "🖼" : isVideo ? "🎬" : isPdf ? "📄" : "📎";
                      const label   = isImage ? "Image" : isVideo ? "Video" : isPdf ? "PDF Document" : "File";

                      return (
                        <div style={{ border: `1px solid ${G.cyan}25`, borderRadius: 12, overflow: "hidden", background: "rgba(0,212,255,0.03)" }}>
                          {/* Header row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: expanded ? `1px solid ${G.cyan}18` : "none" }}>
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: G.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{fname}</div>
                              <div style={{ fontSize: 10, color: G.textMuted }}>{label}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={() => setExpanded(p => !p)}
                                style={{ padding: "5px 12px", background: expanded ? `${G.cyan}20` : `${G.cyan}0a`, border: `1px solid ${G.cyan}33`, borderRadius: 7, color: G.cyan, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" as const }}>
                                {expanded ? "▲ Hide" : "▼ Preview"}
                              </button>
                              <a href={src} download={fname}
                                style={{ padding: "5px 12px", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 7, color: G.success, fontSize: 10, fontWeight: 800, textDecoration: "none", textTransform: "uppercase" as const }}>
                                ⬇ Save
                              </a>
                            </div>
                          </div>

                          {/* Inline preview */}
                          {expanded && (
                            <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.3)" }}>
                              {isImage && (
                                <img src={src} alt={fname}
                                  style={{ width: "100%", maxHeight: 480, objectFit: "contain" as const, borderRadius: 8, background: "#000", display: "block" }} />
                              )}
                              {isVideo && (
                                <video src={src} controls
                                  style={{ width: "100%", maxHeight: 400, borderRadius: 8, background: "#000", display: "block" }}
                                  preload="metadata"
                                />
                              )}
                              {isPdf && (
                                <iframe src={src} title={fname}
                                  style={{ width: "100%", height: 520, border: "none", borderRadius: 8, background: "#fff", display: "block" }} />
                              )}
                              {!isImage && !isVideo && !isPdf && (
                                <div style={{ textAlign: "center", padding: "24px", color: G.textMuted, fontSize: 12 }}>
                                  Preview not available for this file type. Use the Save button to download.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 10 }}>
                          📎 Attachments ({selectedTask.attachments!.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                          {selectedTask.attachments!.map((src, i) => (
                            <AttachmentPreview key={i} src={src} i={i} />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={12} />Due: {new Date(selectedTask.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {selectedTask.timeSlot && <span style={{ color: G.gold }}>· {selectedTask.timeSlot}</span>}
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="g-label">Review Comments {reviewComments.length === 0 ? "(required for rework)" : ""}</label>
                    <textarea className="g-input" value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} placeholder="Add feedback, notes, or reason for rework…" style={{ minHeight: 100, resize: "vertical" as const }} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-success" onClick={handleApprove} style={{ flex: 1 }}><CheckCircle size={14} />Approve & Forward</button>
                    <button className="g-btn-danger"  onClick={handleRework}  style={{ flex: 1 }}><RotateCw size={14} />Send for Rework</button>
                    <button className="g-btn-ghost" onClick={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }}>Cancel</button>
                  </div>
                  {/* Reassign from review modal */}
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="g-btn-reassign"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => {
                        if (!selectedTask) return;
                        setShowReviewModal(false);
                        setReassignTask(selectedTask);
                        setReassignTo("");
                        setReassignReason("");
                        setSelectedTask(null);
                        setReviewComments("");
                        setShowReassignModal(true);
                      }}
                    >
                      <Share2 size={13} />Reassign Task to Different Doer
                    </button>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <button className="g-btn-delete" style={{ width: "100%" }} onClick={() => { setShowReviewModal(false); requestDeleteTask(selectedTask!); }}>
                      <Trash2 size={13} />Request Delete (Needs Superadmin Approval)
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {showSubmitModal && submitTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeSubmitModal(); }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
                <ModalHeader title={`Submit: ${submitTask.title}`} sub="Add completion notes and attachments before review" onClose={closeSubmitModal} accent={G.success} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                    <span className={priClass(submitTask.priority)}><Flag size={9} />{submitTask.priority?.toUpperCase()}</span>
                    {submitTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{submitTask.timeSlot}</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <Calendar size={10} />Due {new Date(submitTask.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Completion Notes *</label>
                    <textarea className="g-input" value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} placeholder="Describe what was done, blockers encountered, and the outcome…" style={{ minHeight: 120, resize: "vertical" as const }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="g-btn-ai" onClick={handleAIDraft} disabled={aiDrafting || !submitNotes.trim()}>
                        {aiDrafting ? <><Loader size={11} className="spin" />Improving…</> : <><Sparkles size={11} />AI Polish</>}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <DateTimePicker label="Submission Time Slot" hideDateInput dateValue="" timeSlot={submitTimeSlot} onDateChange={() => {}} onTimeSlotChange={setSubmitTimeSlot} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Attachments (Photos)</label>
                    <div className={`g-drop${submitDragOver ? " drag-over" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setSubmitDragOver(true); }}
                      onDragLeave={() => setSubmitDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setSubmitDragOver(false); handlePhotoAdd(e.dataTransfer.files); }}
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload size={20} color={G.textMuted} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, color: G.textSecondary }}>Drop images here or <span style={{ color: G.cyan }}>browse</span></div>
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>PNG, JPG, WEBP supported</div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handlePhotoAdd(e.target.files)} />
                    {submitPhotos.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {submitPhotos.map((src, i) => (
                          <div key={i} style={{ position: "relative" }}>
                            <img src={src} alt={`Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${G.cyan}33`, cursor: "pointer" }} onClick={() => openLightbox(submitPhotos, i)} />
                            <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: G.danger, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11 }}>
                              <X size={10} />
                            </button>
                            {aiReviewResults && (() => {
                              const r = aiReviewResults.results.find((r) => r.image === i + 1);
                              const c = r?.status === "CLEAN" ? G.success : r?.status === "ERROR" ? G.danger : G.amber;
                              return r ? <span style={{ position: "absolute", bottom: 2, left: 2, right: 2, textAlign: "center", fontSize: 8, background: `${c}cc`, color: "#fff", padding: "1px 4px", borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace" }}>{r.status}</span> : null;
                            })()}
                          </div>
                        ))}
                        <button className="g-btn-review-att" onClick={handleAIReview} disabled={aiReviewing} style={{ height: 72, minWidth: 72, flexDirection: "column" as const, gap: 4 }}>
                          {aiReviewing ? <Loader size={14} className="spin" /> : <Eye size={14} />}
                          <span style={{ fontSize: 9 }}>{aiReviewing ? "Reviewing…" : "AI Review"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {aiReviewResults && reviewPanelOpen && (
                    <div style={{ marginBottom: 16, padding: "14px 16px", background: aiReviewResults.hasErrors ? G.dangerDim : G.successDim, border: `1px solid ${aiReviewResults.hasErrors ? G.dangerBorder : G.successBorder}`, borderRadius: 10 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: aiReviewResults.hasErrors ? G.danger : G.success, letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 10 }}>
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

          {/* ════ REASSIGN TASK MODAL ════ */}
          {showReassignModal && reassignTask && (
            <div className="g-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowReassignModal(false); setReassignTask(null); } }}>
              <div className="g-modal" style={{ maxHeight: "90vh" }}>
                <ModalHeader
                  title={`Reassign: ${reassignTask.title}`}
                  sub="Cancel current doer · Assign new doer · Trigger handover voice call"
                  onClose={() => { setShowReassignModal(false); setReassignTask(null); setReassignTo(""); setReassignReason(""); }}
                  accent={G.cyan}
                />
                <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Current doer info */}
                  <div style={{ padding: "14px 16px", background: "rgba(255,45,85,0.06)", border: `1px solid ${G.dangerBorder}`, borderRadius: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: G.danger, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>Current Doer — Will Be Cancelled</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${G.danger},#cc0033)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={15} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: G.textPrimary }}>{getName(reassignTask.assignedTo)}</div>
                        <div style={{ fontSize: 11, color: G.textMuted }}>{reassignTask.assignedTo}</div>
                      </div>
                      <span className="g-badge g-badge-red" style={{ marginLeft: "auto" }}>CANCELLED</span>
                    </div>
                  </div>

                  {/* What happens note */}
                  <div style={{ padding: "12px 14px", background: "rgba(191,95,255,0.06)", border: "1px solid rgba(191,95,255,0.25)", borderRadius: 10, display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>🔄</span>
                    <div style={{ fontSize: 11, color: "rgba(191,95,255,0.85)", lineHeight: 1.7 }}>
                      <strong style={{ color: G.purple }}>A voice handover notice will be sent to the current doer</strong> instructing them to hand over all completed creatives and working files to the new assignee. Both parties will receive a Chatroom notification.
                    </div>
                  </div>

                  {/* Select new doer */}
                  <div>
                    <label className="g-label">New Doer *</label>
                    <select className="g-input" value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                      <option value="">— Select new assignee —</option>
                      {allMembers
                        .filter(m => m.email !== reassignTask.assignedTo)
                        .sort((a, b) => {
                          if (a.role === "staff" && b.role !== "staff") return -1;
                          if (a.role !== "staff" && b.role === "staff") return 1;
                          return a.name.localeCompare(b.name);
                        })
                        .map(m => (
                          <option key={m.id} value={m.email}>
                            {m.name} ({m.role === "staff" ? "Doer" : "Admin"})
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="g-label">Reason for Reassignment (Optional)</label>
                    <textarea
                      className="g-input"
                      value={reassignReason}
                      onChange={e => setReassignReason(e.target.value)}
                      placeholder="e.g., Original doer unavailable, skill mismatch, workload rebalancing…"
                      style={{ minHeight: 80, resize: "vertical" as const }}
                    />
                  </div>

                  {/* Preview of new assignee */}
                  {reassignTo && (() => {
                    const nm = allMembers.find(m => m.email === reassignTo);
                    return nm ? (
                      <div style={{ padding: "12px 14px", background: "rgba(0,245,160,0.05)", border: `1px solid ${G.successBorder}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${G.success},#00a86b)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={14} color="#001a0e" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: G.textPrimary }}>{nm.name}</div>
                          <div style={{ fontSize: 11, color: G.textMuted }}>{nm.email}</div>
                        </div>
                        <span className="g-badge g-badge-green">NEW DOER</span>
                      </div>
                    ) : null;
                  })()}

                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    <button
                      className="g-btn-gold"
                      onClick={handleReassignTask}
                      disabled={!reassignTo}
                      style={{ flex: 2 }}
                    >
                      <Share2 size={14} />Confirm Reassignment &amp; Trigger Handover
                    </button>
                    <button
                      className="g-btn-ghost"
                      onClick={() => { setShowReassignModal(false); setReassignTask(null); setReassignTo(""); setReassignReason(""); }}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ TAT EXTENSION REVIEW MODAL ════ */}
          {showTatExtModal && tatExtTask?.tatExtensionRequest && (
            <div className="g-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowTatExtModal(false); setTatExtTask(null); } }}>
              <div className="g-modal" style={{ maxHeight: "90vh" }}>
                <ModalHeader
                  title="TAT Extension Request"
                  sub="Review doer's reason · Approve to extend deadline or deny to enforce original TAT"
                  onClose={() => { setShowTatExtModal(false); setTatExtTask(null); setTatExtResponse(""); }}
                  accent={G.amber}
                />
                <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Request details */}
                  <div style={{ padding: "14px 16px", background: "rgba(255,159,10,0.06)", border: `1px solid rgba(255,159,10,0.35)`, borderRadius: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: G.amber, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 10 }}>Extension Request Details</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11 }}>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Requested by</div>
                        <div style={{ color: G.textPrimary, fontWeight: 700 }}>{getName(tatExtTask.assignedTo)}</div>
                      </div>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Task</div>
                        <div style={{ color: G.textPrimary, fontWeight: 700 }}>{tatExtTask.title}</div>
                      </div>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Original Deadline</div>
                        <div style={{ color: G.danger, fontWeight: 700 }}>
                          {new Date(tatExtTask.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {tatExtTask.timeSlot}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Requested New Deadline</div>
                        <div style={{ color: G.success, fontWeight: 700 }}>
                          {new Date(tatExtTask.tatExtensionRequest.requestedNewDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {tatExtTask.tatExtensionRequest.requestedNewTimeSlot}
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ color: G.textMuted, marginBottom: 2 }}>Requested At</div>
                        <div style={{ color: G.textSecondary }}>
                          {new Date(tatExtTask.tatExtensionRequest.requestedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Doer's reason */}
                  <div style={{ padding: "14px 16px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: G.cyan, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 8 }}>Doer's Reason for Extension</div>
                    <div style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.7 }}>
                      {tatExtTask.tatExtensionRequest.reason || <span style={{ color: G.textMuted, fontStyle: "italic" }}>No reason provided.</span>}
                    </div>
                  </div>

                  {/* Warning about denial */}
                  <div style={{ padding: "12px 14px", background: "rgba(255,45,85,0.05)", border: `1px solid ${G.dangerBorder}`, borderRadius: 10, display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
                    <div style={{ fontSize: 11, color: "rgba(255,45,85,0.80)", lineHeight: 1.7 }}>
                      <strong style={{ color: G.danger }}>If denied</strong>, the original TAT deadline remains in force. Once it is crossed, the task will be <strong>automatically frozen</strong> and will require an assistance ticket to unfreeze.
                    </div>
                  </div>

                  {/* Admin response */}
                  <div>
                    <label className="g-label">Your Response / Instructions {tatExtTask ? "(required to deny)" : ""}</label>
                    <textarea
                      className="g-input"
                      value={tatExtResponse}
                      onChange={e => setTatExtResponse(e.target.value)}
                      placeholder="e.g., Approved — ensure delivery by new date. / Denied — original deadline must be met, escalate blockers immediately…"
                      style={{ minHeight: 90, resize: "vertical" as const }}
                      onFocus={e => e.target.style.borderColor = `rgba(255,159,10,0.55)`}
                      onBlur={e => e.target.style.borderColor = `rgba(255,255,255,0.12)`}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="g-btn-success"
                      onClick={handleApproveTatExtension}
                      style={{ flex: 1 }}
                    >
                      <CheckCircle size={14} />Approve Extension
                    </button>
                    <button
                      className="g-btn-danger"
                      onClick={handleDenyTatExtension}
                      disabled={!tatExtResponse.trim()}
                      style={{ flex: 1 }}
                    >
                      <X size={14} />Deny — Hold Original TAT
                    </button>
                    <button
                      className="g-btn-ghost"
                      onClick={() => { setShowTatExtModal(false); setTatExtTask(null); setTatExtResponse(""); }}
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Prime Directive Flash Overlay ────────────────────────────────── */}
      {pdFlash && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: pdFlashDismissing
              ? "rgba(0,0,0,0)"
              : "linear-gradient(135deg, rgba(248,113,113,0.18) 0%, rgba(0,0,0,0.92) 60%)",
            backdropFilter: "blur(18px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.4s",
            animation: "pdFlashIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          <style>{`
            @keyframes pdFlashIn {
              from { opacity: 0; transform: scale(0.96); }
              to   { opacity: 1; transform: scale(1); }
            }
            @keyframes pdPulseRing {
              0%   { transform: scale(1);    opacity: 0.6; }
              100% { transform: scale(1.6);  opacity: 0; }
            }
          `}</style>

          {/* Pulse ring */}
          <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", border: "2px solid rgba(248,113,113,0.5)", animation: "pdPulseRing 1.4s ease-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", border: "2px solid rgba(248,113,113,0.3)", animation: "pdPulseRing 1.4s ease-out infinite 0.5s", pointerEvents: "none" }} />

          <div style={{
            position: "relative", width: "100%", maxWidth: 480,
            background: "linear-gradient(160deg, rgba(15,8,20,0.97), rgba(25,10,30,0.97))",
            border: "1px solid rgba(248,113,113,0.55)",
            borderRadius: 24, padding: "36px 32px",
            boxShadow: "0 0 80px rgba(248,113,113,0.25), 0 40px 80px rgba(0,0,0,0.7)",
            margin: "0 20px",
          }}>
            {/* Top label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={24} color="#f87171" />
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#f87171", letterSpacing: "0.18em", textTransform: "uppercase" as const, marginBottom: 3 }}>
                  ⚡ Prime Directive — D1 Alert
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "rgba(248,113,113,0.5)", letterSpacing: "0.12em" }}>
                  Reminder #{(pdFlash as any).pdReminderCount ?? 1} · Assigned to {getName((pdFlash as Task).assignedTo)}
                </div>
              </div>
            </div>

            {/* Task title */}
            <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>
              {(pdFlash as Task).title}
            </h2>

            {/* Description */}
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 20 }}>
              {(pdFlash as Task).description?.slice(0, 160) || "No description provided."}
            </p>

            {/* Meta row */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
              <span style={{ color: G.amber, display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={11} />Due: {new Date((pdFlash as Task).dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span style={{ color: "#f87171", display: "flex", alignItems: "center", gap: 5 }}>
                <Flag size={11} />{(pdFlash as Task).priority?.toUpperCase()}
              </span>
              <span style={{ color: G.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                <User size={11} />{getName((pdFlash as Task).assignedTo)}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              {/* Acknowledge */}
              <button
                onClick={() => {
                  const updated = { ...pdFlash, pdAcknowledgedBy: user?.email ?? "admin", pdAcknowledgedAt: new Date().toISOString() };
                  updateTask((pdFlash as Task).id, updated as never);
                  syncTaskToBackend(updated as Task);
                  // Send chatroom notification
                  sendSystemDM({
                    notifType:   "task_approved",
                    taskId:      (pdFlash as Task).id,
                    taskTitle:   (pdFlash as Task).title,
                    doerEmail:   (pdFlash as Task).assignedTo,
                    adminEmail:  user?.email ?? "",
                    adminName:   user?.name ?? user?.email ?? "Admin",
                    message:     `✅ Prime Directive acknowledged by ${user?.name ?? user?.email}. Task: "${(pdFlash as Task).title}"`,
                  });
                  toast("✓ Prime Directive acknowledged");
                  setPdFlash(null);
                }}
                style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f87171, #ef4444)", color: "#fff", fontWeight: 800, fontSize: 13, fontFamily: "'Oswald',sans-serif", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <CheckCircle size={16} /> ACKNOWLEDGE
              </button>

              {/* Snooze 2h */}
              <button
                onClick={() => {
                  const snoozeUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
                  const updated = { ...pdFlash, pdSnoozedUntil: snoozeUntil };
                  updateTask((pdFlash as Task).id, updated as never);
                  syncTaskToBackend(updated as Task);
                  toast("⏸ Snoozed for 2 hours");
                  setPdFlash(null);
                }}
                style={{ padding: "13px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}
              >
                ⏸ Snooze 2h
              </button>

              {/* Dismiss */}
              <button
                onClick={() => setPdFlash(null)}
                style={{ padding: "13px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", background: "transparent", color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showSmartAssist && activeTicket && (
            <SmartAssistModal
              ticket={activeTicket}
              onClose={() => { setShowSmartAssist(false); setActiveTicket(null); }}
              onSubmit={handleSmartAssistSubmit}
              isDoer={activeTicket.assignedTo === user?.email}
            />
          )}

          {showLightbox && lightboxPhotos.length > 0 && (
            <div className="g-lightbox" onClick={() => setShowLightbox(false)}>
              <button className="g-lightbox-close" onClick={() => setShowLightbox(false)}><X size={16} /></button>
              <button className="g-lightbox-nav prev" disabled={lightboxIndex === 0} onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.max(i - 1, 0)); }}>‹</button>
              <img className="g-lightbox-img" src={lightboxPhotos[lightboxIndex]} alt={`Photo ${lightboxIndex + 1}`} onClick={(e) => e.stopPropagation()} />
              <button className="g-lightbox-nav next" disabled={lightboxIndex === lightboxPhotos.length - 1} onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1)); }}>›</button>
              <div className="g-lightbox-counter">{lightboxIndex + 1} / {lightboxPhotos.length}</div>
            </div>
          )}
        </div>

        {toastMsg && <div className="g-toast">{toastMsg}</div>}

        {/* ── Task Assigning Overlay ── */}
        {showAssigningOverlay && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
          }}>
            <video
              autoPlay loop muted playsInline
              style={{
                width: "min(520px,80vw)", borderRadius: 20,
                boxShadow: "0 0 80px rgba(201,169,110,0.35)",
                border: "1px solid rgba(201,169,110,0.2)",
              }}
            >
              <source src="https://res.cloudinary.com/donsrpgw3/video/upload/v1773599341/5561660_Coll_wavebreak_Animation_1280x720_cm1tj7.mp4" type="video/mp4" />
            </video>
            <p style={{
              marginTop: 28, color: "#c9a96e",
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 13, letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}>
              Assigning Task…
            </p>
          </div>
        )}
      </>
    );
  };

  // ── Modal Header ──────────────────────────────────────────────────────────────
  const ModalHeader: React.FC<{ title: string; sub: string; onClose: () => void; accent?: string }> = ({ title, sub, onClose, accent = G.cyan }) => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "22px 26px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: accent, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: 6 }}>{sub}</div>
        <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary, lineHeight: 1.2, maxWidth: 460 }}>{title}</h2>
      </div>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textMuted }}>
        <X size={15} />
      </button>
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
    onDelete: () => void;
    onReassign: () => void;
    onReviewTatExt?: () => void;
    onToggleAutopulse?: () => void;
    getNameFn: (e: string) => string;
  }

  const TaskRow: React.FC<TaskRowProps> = ({ task, idx, staffName, isAdminAssignee, onReview, onViewHistory, onDelete, onReassign, onReviewTatExt, onToggleAutopulse, getNameFn }) => {
    const [hovered, setHovered] = React.useState(false);
    const hasPendingTatExt = task.tatExtensionRequest?.status === "pending";
    return (
      <div className="fade-up"
        style={{ animationDelay: `${idx * 55}ms`, background: hovered ? G.surfaceMid : G.surface, border: `1px solid ${hovered ? G.cyan + "44" : task.tatBreached ? G.dangerBorder : "rgba(255,255,255,0.09)"}`, borderRadius: 12, padding: "18px 22px", transition: "all 0.2s ease", backdropFilter: "blur(16px)" }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {/* TAT Extension pending banner */}
        {hasPendingTatExt && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, padding: "8px 14px", background: "rgba(255,159,10,0.10)", border: `1px solid rgba(255,159,10,0.40)`, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: G.amber, fontFamily: "'IBM Plex Mono',monospace" }}>
              <Clock size={11} />
              <strong>TAT EXTENSION REQUEST</strong> · {staffName} has requested a deadline extension
              <span style={{ fontSize: 10, color: G.textMuted }}>— New date: {new Date(task.tatExtensionRequest!.requestedNewDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} {task.tatExtensionRequest!.requestedNewTimeSlot}</span>
            </div>
            {onReviewTatExt && (
              <button onClick={e => { e.stopPropagation(); onReviewTatExt(); }}
                style={{ flexShrink: 0, padding: "5px 12px", background: "rgba(255,159,10,0.14)", border: `1px solid rgba(255,159,10,0.45)`, borderRadius: 7, color: G.amber, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>
                Review Extension →
              </button>
            )}
          </div>
        )}
        {/* Handover banner */}
        {task.handoverRequested && task.previousAssignee && (
          <div className="handover-banner">
            <Share2 size={11} />
            Handover triggered — <strong style={{ marginLeft: 4 }}>{getNameFn(task.previousAssignee!)}</strong> was asked to hand over creatives
          </div>
        )}
        {task.tatBreached && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 12px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 7, fontSize: 11, color: G.danger, fontFamily: "'IBM Plex Mono',monospace" }}>
            <AlertTriangle size={11} /> TAT BREACH — {task.smartAssist?.delayDuration || "Overdue"}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
          <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 2 }}>
            {String(idx + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{task.title}</h3>
              <span className={priClass(task.priority)}><Flag size={9} />{task.priority?.toUpperCase()}</span>
              {isAdminAssignee && <span className="g-badge g-badge-gold"><Shield size={9} />ADMIN</span>}
              {hasPendingTatExt && <span className="tat-ext-badge"><Clock size={9} />EXT REQUESTED</span>}
              {(task as any).isAutopulse && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 7px", borderRadius: 4,
                  background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.3)",
                  fontSize: 8, fontWeight: 800, color: "#c9a96e",
                  textTransform: "uppercase" as const, letterSpacing: "0.5px",
                }}>
                  <Zap size={7} /> AUTOPULSE {(task as any).autopulseGeneration > 0 ? `#${(task as any).autopulseGeneration}` : ""}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
              {task.description}
            </p>
            {/* ── Voice Note player ── */}
            {(task as any).voiceNote && (
              <div style={{
                margin: "0 0 10px",
                padding: "8px 12px", borderRadius: 9,
                background: "rgba(201,169,110,0.07)", border: "1px solid rgba(201,169,110,0.28)",
                display: "flex", flexDirection: "column" as const, gap: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Radio size={10} color="#c9a96e" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#c9a96e", textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>Voice Brief</span>
                </div>
                <audio src={(task as any).voiceNote} controls style={{ width: "100%", height: 32, accentColor: "#c9a96e" }} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: isAdminAssignee ? G.gold : G.textSecondary }}>
                {isAdminAssignee ? <Shield size={10} color={G.gold} /> : <User size={10} />}{staffName}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={10} />{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {task.timeSlot && <span style={{ color: G.gold }}>· {task.timeSlot}</span>}
              </span>
              {task.completionNotes && <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.cyan }}><FileText size={10} />Has notes</span>}
              {task.history && task.history.length > 0 && (
                <button onClick={onViewHistory} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: G.cyan, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: 0 }}>
                  <ListTree size={10} />History ({task.history.length})
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 2, flexDirection: "column" as const }}>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Pause / Resume Autopulse */}
              {(task as any).isAutopulse && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAutopulse?.();
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "9px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: "pointer", border: "1px solid rgba(201,169,110,0.3)",
                    background: "rgba(201,169,110,0.07)", color: "#c9a96e",
                    fontFamily: "inherit", whiteSpace: "nowrap" as const,
                  }}
                  title={(task as any).autopulsePaused ? "Resume Autopulse" : "Pause Autopulse"}
                >
                  {(task as any).autopulsePaused ? <><Zap size={11} />Resume</> : <>⏸ Pause</>}
                </button>
              )}
              <button onClick={onReview}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: hovered ? `linear-gradient(135deg,${G.cyan},#60efff)` : "rgba(255,255,255,0.05)", color: hovered ? "#001a26" : G.textSecondary, border: `1px solid ${hovered ? G.cyan : "rgba(255,255,255,0.10)"}`, borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap" as const, boxShadow: hovered ? `0 0 20px ${G.cyan}55` : "none" }}>
                <Eye size={12} />Review<ChevronRight size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="g-btn-delete"
                style={{ padding: "9px 12px" }}
                title="Delete task"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {/* Reassign button — always available on review tasks */}
            <button
              className="g-btn-reassign"
              onClick={e => { e.stopPropagation(); onReassign(); }}
              title="Reassign this task to a different doer"
              style={{ width: "100%", fontSize: 11 }}
            >
              <Share2 size={11} />Reassign Doer
            </button>
          </div>
        </div>
      </div>
    );
  };

  export default AdminDashboard;
