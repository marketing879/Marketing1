import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
  import { useNavigate } from "react-router-dom";
  import { useUser } from "../contexts/UserContext";
  import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
  import {
    Plus, Upload, LogOut, CheckCircle, Eye, X,
    Zap, User, ChevronRight, Calendar, Flag,
    FileText, MessageSquare, Shield, Sparkles, Loader,
    TrendingUp, Clock, Activity, BarChart3,
    GitBranch, ListTree,
    AlertTriangle, AlertCircle, History, Radio, Share2, RotateCw, Trash2,
  } from "lucide-react";
  import ClaudeChat from "./ClaudeChat";
  import HistoryTimeline from "./Historytimeline";
  import SmartAssistModal from "./Smartassistmodal";
  import ProgressTracker from "./Progresstracker";
  import { sendTaskWhatsApp } from "../services/WhatsAppService";
  import { greetUser, setElevenLabsVoice, announceVoice, speakText } from "../services/VoiceModule";


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
      assistanceTickets, approveAssistanceTicket,
    } = useUser() as ReturnType<typeof useUser> & {
      deleteTask: (id: string) => void;
      deleteAllTasks: () => void;
      tasks: Task[];
      assistanceTickets: import("../contexts/UserContext").AssistanceTicket[];
      approveAssistanceTicket: (ticketId: string, adminComment: string) => void;
    };

    // ── Live polling: fetch tasks directly from backend every 15s ───────────
    const [liveTasks, setLiveTasks] = React.useState<Task[] | null>(null);
    const freshTasks = React.useMemo<Task[]>(
      () => (liveTasks ?? (allContextTasks as Task[])),
      [liveTasks, allContextTasks]
    );
    useEffect(() => {
      const poll = () =>
        fetch("https://roswalt-backend-production.up.railway.app/api/tasks")
          .then(r => r.ok ? r.json() : Promise.reject())
          .then((data: any[]) => setLiveTasks(data.map((t: any) => ({ ...t, id: t.id || String(t._id) }))))
          .catch(() => {});
      poll();
      const iv = setInterval(poll, 15000);
      return () => clearInterval(iv);
    }, []);

    const navigate = useNavigate();

    const allMembers     = teamMembers as TeamMember[];
    const activeProjects = (projects as Project[]).filter((p) => !p.status || p.status === "active");

    const [activeTab,       setActiveTab]       = useState("analytics");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAIPanel,     setShowAIPanel]     = useState(false);
    const [toastMsg,        setToastMsg]        = useState<string | null>(null);
    const [adminProfileImg, setAdminProfileImg] = useState<string | null>(null);
    const [roswalLogo,      setRoswalLogo]      = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileInputRef = useRef<HTMLInputElement | null>(null);
    const logoInputRef = useRef<HTMLInputElement | null>(null);

    // ── Delete confirmation state ─────────────────────────────────────────────
    const [confirmDelete, setConfirmDelete] = useState<{
      message: string;
      onConfirm: () => void;
    } | null>(null);

    const requestDeleteTask = (task: Task) => {
      setConfirmDelete({
        message: `Delete "${task.title}"? This action cannot be undone.`,
        onConfirm: () => {
          deleteTask(task.id);
          fetch(`https://roswalt-backend-production.up.railway.app/api/tasks/${task.id}`, { method: "DELETE" }).catch(() => {});
          toast("🗑 Task deleted.");
          setConfirmDelete(null);
        },
      });
    };

    const requestDeleteAll = () => {
      setConfirmDelete({
        message: `Delete ALL ${allTasksCombined.length} tasks permanently? This cannot be undone.`,
        onConfirm: () => {
          deleteAllTasks();
          fetch("https://roswalt-backend-production.up.railway.app/api/tasks/all", { method: "DELETE" }).catch(() => {});
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

    const [showGlobalHistory, setShowGlobalHistory] = useState(false);

    const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
    const [lightboxIndex,  setLightboxIndex]  = useState(0);
    const [showLightbox,   setShowLightbox]   = useState(false);

    const [newTask, setNewTask] = useState({
      title: "", description: "", priority: "medium", dueDate: "",
      assignedTo: "", projectId: "", timeSlot: "18:00", purpose: "",
    });

    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardTask,      setForwardTask]      = useState<Task | null>(null);
    const [forwardTo,        setForwardTo]        = useState("");
    const [forwardNotes,     setForwardNotes]     = useState("");

    // ── Reassign modal state ──────────────────────────────────────────────────
    const [showReassignModal,  setShowReassignModal]  = useState(false);
    const [reassignTask,       setReassignTask]       = useState<Task | null>(null);
    const [reassignTo,         setReassignTo]         = useState("");
    const [reassignReason,     setReassignReason]     = useState("");

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

    useEffect(() => {
      const loadRoswalLogo = async () => {
        try {
          const response = await fetch("/logos/roswalt-logo-golden-8k.png");
          if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onload = (e) => {
              if (typeof e.target?.result === "string") setRoswalLogo(e.target.result);
            };
            reader.readAsDataURL(blob);
          }
        } catch { /* no logo found */ }
      };
      loadRoswalLogo();
    }, []);

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
      // 1. ElevenLabs time-of-day greeting
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
    const reviewNow = tasksToReview.length;
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

    const tasksToReview = (freshTasks as Task[]).filter(t =>
      t.approvalStatus === "in-review"
    );
    const myAssignedTasks = (freshTasks as unknown as Task[]).filter(t => ((t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase() || (t.assignedTo ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()) &&
      t.title && t.description &&
      !t.title.toLowerCase().includes("test") &&
      !t.description.toLowerCase().includes("test")
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
      (freshTasks as Task[])
        .filter(t =>
          t.title && t.description &&
          !t.title.toLowerCase().includes("test") &&
          !t.description.toLowerCase().includes("test")
        )
        .forEach(t => map.set(t.id, t));
      return Array.from(map.values());
    }, [freshTasks, user]);
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

    const toast = (msg: string): void => {
      setToastMsg(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
    };

    // ── Sync task updates to backend ──────────────────────────────────────────
    const syncTaskToBackend = async (task: Task): Promise<void> => {
      try {
        await fetch(`https://roswalt-backend-production.up.railway.app/api/tasks/${task.id}`, {
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

    const handlePhotoAdd = (files: FileList | null): void => {
      if (!files) return;
      Array.from(files).forEach((file: File) => {
        if (!file.type.startsWith("image/")) return;
        const r = new FileReader();
        r.onload = (e) => {
          if (typeof e.target?.result === "string") {
            setSubmitPhotos((prev) => [...prev, e.target!.result as string]);
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
      appendHistoryEntry(submitTask.id, histEntry, user?.email); // persist independently
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
        const res = await fetch("https://roswalt-backend-production.up.railway.app/api/draft-notes", {
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
        const res = await fetch("https://roswalt-backend-production.up.railway.app/api/review-attachments", {
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
      appendHistoryEntry(forwardTask.id, h, user?.email); // persist independently
      const updatedTask = { ...forwardTask, assignedTo: forwardTo, assignedBy: user?.email, forwardedFrom: forwardTask.assignedTo, history: [...(forwardTask.history ?? []), h] };
      updateTask(forwardTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask as Task);
      toast(`✓ Task forwarded to ${getName(forwardTo)}`);
      setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes("");
    };

  const handleApprove = (): void => {
    if (!selectedTask) return;
    const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "approved", by: user?.email ?? "", notes: reviewComments };
    appendHistoryEntry(selectedTask.id, h, user?.email); // persist independently
    // Merge history + approvalStatus in ONE update so adminReviewTask can't overwrite history
    const updatedTask: Task = {
      ...selectedTask,
      approvalStatus: "admin-approved",
      adminComments: reviewComments,
      history: [...(selectedTask.history ?? []), h],
    };
    updateTask(selectedTask.id, updatedTask as never);
    syncTaskToBackend(updatedTask);

    const assignee = allMembers.find((m) => m.email === selectedTask.assignedTo);
    if (assignee?.phone) {
      sendTaskWhatsApp({
        recipientPhone:  assignee.phone,
        taskTitle:       selectedTask.title,
        taskDescription: `✅ Your task has been APPROVED by ${(user as { name?: string }).name ?? user?.email ?? "Admin"}. ${reviewComments ? "Notes: " + reviewComments : ""}`,
        priority:        selectedTask.priority,
        dueDate:         selectedTask.dueDate,
        timeSlot:        selectedTask.timeSlot ?? "",
        assignedByName:  (user as { name?: string }).name ?? user?.email ?? "Admin",
        projectName:     activeProjects.find((p) => p.id === selectedTask.projectId)?.name ?? "—",
        taskId:          selectedTask.id,
      });
    }
    setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
    speakText("Task approved and forwarded to Superadmin for final sign-off.");
    toast("✓ Approved — forwarded to Superadmin.");
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
      appendHistoryEntry(selectedTask.id, h, user?.email); // persist independently
      // Single update with full state — no second context call that could overwrite history
      const updatedTask: Task = {
        ...selectedTask,
        approvalStatus: "rejected",
        adminComments: reviewComments,
        history: [...(selectedTask.history ?? []), h],
      };
      updateTask(selectedTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask);
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
      appendHistoryEntry(reassignTask.id, histEntry, user?.email);

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

      // ── WhatsApp to new doer ──────────────────────────────────────────────
      const newMember = allMembers.find(m => m.email === reassignTo);
      if (newMember?.phone) {
        try {
          sendTaskWhatsApp({
            recipientPhone:  newMember.phone,
            taskTitle,
            taskDescription: `🔄 This task has been REASSIGNED to you from ${previousName}. ${reassignReason ? "Reason: " + reassignReason + ". " : ""}Please coordinate with ${previousName} for handover of any existing creatives.`,
            priority:        reassignTask.priority,
            dueDate:         reassignTask.dueDate,
            timeSlot:        reassignTask.timeSlot ?? "",
            assignedByName:  (user as { name?: string }).name ?? user?.email ?? "Admin",
            projectName:     activeProjects.find(p => p.id === reassignTask.projectId)?.name ?? "—",
            taskId:          reassignTask.id,
          });
        } catch { /* WhatsApp failure is non-blocking */ }
      }

      // ── WhatsApp to original doer (cancellation notice) ──────────────────
      const prevMember = allMembers.find(m => m.email === previousAssignee);
      if (prevMember?.phone) {
        try {
          sendTaskWhatsApp({
            recipientPhone:  prevMember.phone,
            taskTitle,
            taskDescription: `⚠️ Your assignment for this task has been CANCELLED and reassigned to ${newName}. Please hand over all your work-in-progress creatives and files to ${newName} immediately.`,
            priority:        reassignTask.priority,
            dueDate:         reassignTask.dueDate,
            timeSlot:        reassignTask.timeSlot ?? "",
            assignedByName:  (user as { name?: string }).name ?? user?.email ?? "Admin",
            projectName:     activeProjects.find(p => p.id === reassignTask.projectId)?.name ?? "—",
            taskId:          reassignTask.id,
          });
        } catch { /* WhatsApp failure is non-blocking */ }
      }

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
      appendHistoryEntry(tatExtTask.id, histEntry, user?.email);

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
      appendHistoryEntry(tatExtTask.id, histEntry, user?.email);

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
      // Persist history independently of UserContext
      history.forEach(e => appendHistoryEntry(taskId, e, user?.email));

  // ── Voice callout to doer ──
      speakText(`New task assigned. ${newTask.title} has been assigned to ${allMembers.find(m => m.email === newTask.assignedTo)?.name || newTask.assignedTo}.`);

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
        purpose:        newTask.purpose,
        exactDeadline,
        history,
        createdAt:      now,
      };

      addTask(newTaskObj as never);
      
      syncTaskToBackend(newTaskObj).then(() => {
      console.log("✅ Task created with history:", history);
    }).catch(err => {
      console.error("❌ Backend sync failed:", err);
      toast("⚠ Task created locally but backend sync failed");
    });
      

  if (member.phone) {
        try {
          sendTaskWhatsApp({
            recipientPhone:  member.phone,
            taskTitle:       newTask.title,
            taskDescription: newTask.description,
            priority:        newTask.priority as "high" | "medium" | "low",
            dueDate:         newTask.dueDate,
            timeSlot:        newTask.timeSlot,
            assignedByName:  (user as { name?: string }).name ?? user?.email ?? "Admin",
            projectName:     activeProjects.find((p) => p.id === newTask.projectId)?.name ?? "—",
            taskId,
          });
          toast(`✓ Task assigned to ${member.name} — WhatsApp sent to ${member.phone}`);
        } catch (err) {
          console.error("WhatsApp send failed:", err);
          toast(`✓ Task assigned to ${member.name} — ⚠ WhatsApp failed`);
        }
      } else {
        toast(`✓ Task assigned to ${member.name} — ⚠ No phone on file (WhatsApp skipped)`);
        console.warn(`WhatsApp skipped: "${member.name}" (${member.email}) has no phone number.`);
      }

      setNewTask({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "", projectId: "", timeSlot: "18:00", purpose: "" });
      setShowCreateModal(false);
    };  // ← this closing brace for handleCreateTask MUST be here

    // ── handleLogout ──────────────────────────────────────────────────────────
    const handleLogout = (): void => {
      if (window.confirm("Sign out?")) { logout(); navigate("/login", { replace: true }); }
    };

    const activeSmartAssistCount = countActiveTickets(smartAssistTickets);
    // Assistance tickets sent to THIS admin for review
    const pendingAssistanceTickets = (assistanceTickets ?? []).filter(
      t => t.status === "pending-admin" &&
           (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
    );

    const TABS = [
      { id: "analytics",  label: "Analytics",  icon: TrendingUp  },
      { id: "overview",   label: "Overview",   icon: BarChart3   },
      { id: "review",     label: "Review",     icon: Eye         },
      { id: "tickets",    label: "Tickets",    icon: AlertCircle },
      { id: "mytasks",    label: "My Tasks",   icon: User        },
      { id: "progress",   label: "Progress",   icon: Activity    },
      { id: "taskmap",    label: "Task Map",   icon: GitBranch   },
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

                {/* ── DELETE ALL TASKS BUTTON ── */}
                {allTasksCombined.length > 0 && (
                  <button
                    className="g-btn-delete"
                    style={{ padding: "9px 14px", gap: 6 }}
                    onClick={requestDeleteAll}
                    title={`Delete all ${allTasksCombined.length} tasks`}
                  >
                    <Trash2 size={14} />
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.06em" }}>
                      Delete All ({allTasksCombined.length})
                    </span>
                  </button>
                )}

                <div style={{ display: "flex", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: 3 }}>
                  {TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", background: activeTab === tab.id ? "rgba(0,212,255,0.14)" : "transparent", color: activeTab === tab.id ? G.cyan : G.textSecondary, border: activeTab === tab.id ? `1px solid ${G.cyan}44` : "1px solid transparent", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.2s", position: "relative" as const }}>
                      <tab.icon size={12} />{tab.label}
                      {tab.id === "review"   && tasksToReview.length > 0        && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger,  borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{tasksToReview.length}</span>}
                      {tab.id === "tickets"  && pendingAssistanceTickets.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: "#ff9500", borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{pendingAssistanceTickets.length}</span>}
                      {tab.id === "mytasks"  && myPendingTasks.length > 0        && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger,  borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{myPendingTasks.length}</span>}
                    </button>
                  ))}
                </div>
                <button className="g-btn-gold" onClick={() => setShowCreateModal(true)}><Plus size={14} strokeWidth={2.5} />New Task</button>
                <button className="g-btn-ghost" onClick={() => setShowAIPanel(!showAIPanel)} style={{ padding: "9px 13px", borderColor: showAIPanel ? `${G.cyan}55` : undefined }}><MessageSquare size={16} color={showAIPanel ? G.cyan : undefined} /></button>
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
                  {[
                    { title: "Total Tasks",     value: analytics.totalTasks,       subtitle: "All time",          color: G.cyan,    tasks: analytics.allTasks },
                    { title: "Completion Rate", value: `${analytics.completionRate}%`, subtitle: "Success ratio",  color: G.success, tasks: analytics.allTasks.filter(t => t.approvalStatus === "superadmin-approved") },
                    { title: "Avg Completion",  value: analytics.avgCompletionTime,subtitle: "Per task",           color: G.purple,  tasks: analytics.allTasks.filter(t => t.completedAt) },
                    { title: "Active Tasks",    value: analytics.inProgressTasks,  subtitle: "In progress",        color: G.amber,   tasks: analytics.allTasks.filter(t => (["in-review","admin-approved"] as string[]).includes(t.approvalStatus)) },
                    { title: "TAT Breached",    value: analytics.tatBreachedCount, subtitle: "Deadline misses",    color: G.danger,  tasks: analytics.allTasks.filter(t => t.tatBreached) },
                    { title: "Smart Assist",    value: analytics.activeTicketCount,subtitle: "Open escalations",   color: G.amber,   tasks: [] },
                    { title: "Assigned by Me",  value: analytics.allTasks.filter(t => (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()).length, subtitle: "Tasks I created", color: G.cyan, tasks: analytics.allTasks.filter(t => (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()) },
                    { title: "Pending Review",  value: tasksToReview.length, subtitle: "Awaiting approval", color: G.gold, tasks: tasksToReview },
                  ].map((card, i) => (
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
                      const canSubmit  = task.approvalStatus === "assigned" || task.approvalStatus === "rejected";
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
                              </div>
                              {task.assignedBy && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "4px 12px", borderRadius: 99, background: G.goldDim, border: `1px solid ${G.goldBorder}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.gold }}>
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
                              {canForward && <button className="g-btn-ghost" onClick={() => { setForwardTask(task); setShowForwardModal(true); }} style={{ padding: "9px 14px", fontSize: 12 }}><Share2 size={13} />Forward</button>}
                              {canSubmit  && <button className="g-btn-gold"  onClick={() => openSubmitModal(task)} style={{ padding: "9px 16px", fontSize: 12 }}><Upload size={13} />Submit</button>}
                              <button className="g-btn-delete" onClick={() => requestDeleteTask(task)} style={{ padding: "9px 14px" }}><Trash2 size={13} />Delete</button>
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
                        onReview={() => { setSelectedTask(task); setShowReviewModal(true); }}
                        onViewHistory={() => { setHistoryTask(task); setShowHistoryModal(true); }}
                        onDelete={() => requestDeleteTask(task)}
                        onReassign={() => { setReassignTask(task); setReassignTo(""); setReassignReason(""); setShowReassignModal(true); }}
                        onReviewTatExt={task.tatExtensionRequest?.status === "pending" ? () => { setTatExtTask(task); setTatExtResponse(""); setShowTatExtModal(true); } : undefined}
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
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary }}>
                      Assistance <em style={{ color: "#ff9500" }}>Tickets</em>
                    </h2>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                      {pendingAssistanceTickets.length} pending · {(assistanceTickets ?? []).filter(t => t.assignedBy?.toLowerCase() === user?.email?.toLowerCase() && t.status === "admin-approved").length} approved
                    </p>
                  </div>
                  {pendingAssistanceTickets.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff9500", boxShadow: "0 0 8px #ff9500", animation: "pulse 1.5s infinite" }} />
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#ff9500" }}>ACTION REQUIRED</span>
                    </div>
                  )}
                </div>

                {/* All tickets for this admin (sent by staff they manage) */}
                {(() => {
                  const adminTickets = (assistanceTickets ?? []).filter(
                    t => (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
                  );
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

                  const statusOrder = { "pending-admin": 0, "open": 1, "admin-approved": 2, "resolved": 3 };
                  const sorted = [...adminTickets].sort((a, b) =>
                    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sorted.map(ticket => {
                        const isPending  = ticket.status === "pending-admin";
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
            {activeTab === "taskmap" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>Task <em style={{ color: G.purple }}>Map</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Parent-child forwarding tree with full context</p>
                <ForwardedTaskTree tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} onSelectTask={(task: Task) => { setSelectedTask(task); setShowReviewModal(true); }} />
              </section>
            )}
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
                      background: "rgba(255,149,0,0.12)",
                      border: "1px solid rgba(255,149,0,0.35)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>🎫</div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: G.textPrimary, fontFamily: "'Oswald',sans-serif" }}>
                        Review Assistance Ticket
                      </div>
                      <div style={{ fontSize: 10, color: "#ff9500", marginTop: 3, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.06em" }}>
                        {selectedTicket.id} · ACTION REQUIRED
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

                  {/* What approval does */}
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
                        approveAssistanceTicket(selectedTicket.id, ticketReviewNote.trim());
                        // Append to global history log so it's visible in Master History
                        const linkedTaskId = selectedTicket.taskId;
                        appendHistoryEntry(linkedTaskId, {
                          id:        crypto.randomUUID(),
                          timestamp: new Date().toISOString(),
                          action:    `assistance_ticket_approved · Ticket ${selectedTicket.id} · "${ticketReviewNote.trim().slice(0, 80)}${ticketReviewNote.trim().length > 80 ? "…" : ""}"`,
                          by:        user?.email ?? "Admin",
                          notes:     ticketReviewNote.trim(),
                        });
                        speakText(`Assistance ticket approved for ${selectedTicket.taskTitle}. The task has been unfrozen and the staff member has been notified.`);
                        setShowTicketModal(false);
                        setSelectedTicket(null);
                        toast("✓ Ticket approved — task unfrozen · Doer notified");
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
                      <CheckCircle size={14} /> Approve & Unfreeze Task
                    </button>
                  </div>
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
                if (isReviewable) { setSelectedTask(task); setShowReviewModal(true); }
                else { setHistoryTask(task); setShowHistoryModal(true); }
              }}
            />
          )}

          {showGlobalHistory && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGlobalHistory(false); }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
                <ModalHeader title="Master History Log" sub="All task activity across the system — chronological" onClose={() => setShowGlobalHistory(false)} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <HistoryTimeline
                    history={(() => {
                      // Merge persisted store entries with in-memory task history
                      // so history survives UserContext resets
                      const storeEntries = getAllHistoryEntries(user?.email);
                      const taskTitleMap = Object.fromEntries(allTasksCombined.map(t => [t.id, t.title]));
                      const merged = new Map<string, HistoryEntry & { taskTitle?: string; taskId: string }>();
                      // First add in-memory entries
                      allTasksCombined.flatMap(t =>
                        (t.history ?? []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id }))
                      ).forEach(e => merged.set(e.id, e));
                      // Then overlay with persisted entries (these survive context resets)
                      storeEntries.forEach(e => {
                        if (!merged.has(e.id)) {
                          merged.set(e.id, { ...e, taskTitle: taskTitleMap[e.taskId] ?? e.taskId });
                        }
                      });
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
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-gold" onClick={handleCreateTask} style={{ flex: 1 }}><CheckCircle size={14} strokeWidth={2.5} />Assign Task</button>
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

          {showReviewModal && selectedTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); } }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
                <ModalHeader title={`Review: ${selectedTask.title}`} sub="Approve to forward to Superadmin, or send back for rework" onClose={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }} accent={G.gold} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                    <span className={priClass(selectedTask.priority)}><Flag size={9} />{selectedTask.priority?.toUpperCase()}</span>
                    <span className="g-badge g-badge-gold"><User size={9} />{getName(selectedTask.assignedTo)}</span>
                    {selectedTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                    {selectedTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{selectedTask.timeSlot}</span>}
                    {selectedTask.purpose && <span className="g-badge" style={{ background: "rgba(0,212,255,0.08)", color: G.cyan, border: `1px solid ${G.cyan}44` }}>{selectedTask.purpose}</span>}
                  </div>
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
                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 10 }}>Attachments ({selectedTask.attachments.length})</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {selectedTask.attachments.map((src, i) => (
                          <div key={i} style={{ position: "relative", cursor: "pointer" }} onClick={() => openLightbox(selectedTask.attachments!, i)}>
                            <img src={src} alt={`Attachment ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${G.cyan}33` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <button className="g-btn-delete" style={{ width: "100%" }} onClick={() => { setShowReviewModal(false); requestDeleteTask(selectedTask); }}>
                      <Trash2 size={13} />Delete This Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                      <strong style={{ color: G.purple }}>A voice handover notice will be sent to the current doer</strong> instructing them to hand over all completed creatives and working files to the new assignee. Both parties will also receive WhatsApp notifications.
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
    getNameFn: (e: string) => string;
  }

  const TaskRow: React.FC<TaskRowProps> = ({ task, idx, staffName, isAdminAssignee, onReview, onViewHistory, onDelete, onReassign, onReviewTatExt, getNameFn }) => {
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
            </div>
            <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
              {task.description}
            </p>
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
