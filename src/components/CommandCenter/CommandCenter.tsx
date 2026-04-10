import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface PromiseScore {
  _id?: string; userId: string; week: number; weekLabel: string;
  score: number; date: string; outcome: 'pending' | 'met' | 'missed';
}
interface LiveTask {
  _id: string; title: string; status: string; assignedTo: string;
  assignedToName?: string; priority: string; dueDate: string;
  tatBreached: boolean; exactDeadline?: string; isFrozen?: boolean;
  scoreData?: { percentScore?: number }; reworkCount?: number;
  updatedAt?: string; createdAt?: string;
}
interface LiveUser {
  _id: string; name: string; email: string; role: string;
}
interface CommandCenterProps {
  currentUser?: { _id: string; name: string; email: string };
  apiBase?: string;
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function padTwo(n: number) { return String(n).padStart(2, '0'); }
function initials(name: string) {
  return (name || '').split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '??';
}
async function fetchWithTimeout(url: string, ms = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(timer); return r; }
  catch (e) { clearTimeout(timer); throw e; }
}

const AV = [
  { bg: 'rgba(99,102,241,0.3)', c: '#a5b4fc' }, { bg: 'rgba(34,197,94,0.25)', c: '#4ade80' },
  { bg: 'rgba(245,158,11,0.25)', c: '#fbbf24' }, { bg: 'rgba(244,63,94,0.25)', c: '#fb7185' },
  { bg: 'rgba(14,165,233,0.25)', c: '#38bdf8' }, { bg: 'rgba(168,85,247,0.25)', c: '#d8b4fe' },
  { bg: 'rgba(249,115,22,0.25)', c: '#fb923c' },
];
const av = (i: number) => AV[i % AV.length];

function statusColor(s: string) {
  switch (s) {
    case 'approved': case 'completed': return { sc: '#4ade80', sb: 'rgba(34,197,94,0.12)' };
    case 'in_progress': return { sc: '#60a5fa', sb: 'rgba(96,165,250,0.12)' };
    case 'pending': return { sc: '#fbbf24', sb: 'rgba(245,158,11,0.12)' };
    case 'rework': return { sc: '#fb923c', sb: 'rgba(249,115,22,0.12)' };
    default: return { sc: '#8b9ab8', sb: 'rgba(139,154,184,0.08)' };
  }
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TASKS_PER_PAGE = 10;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
@keyframes ccBlink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes ccPulse{0%,100%{border-left-color:#f0c060}50%{border-left-color:#7a5c00}}
@keyframes ccFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes ccGlow{0%,100%{box-shadow:0 0 8px rgba(34,197,94,0.4)}50%{box-shadow:0 0 20px rgba(34,197,94,0.7)}}
.cc-root{display:flex;flex-direction:column;height:100vh;background:linear-gradient(135deg,#020409 0%,#040c1c 40%,#020409 100%);color:#eef2ff;font-family:'DM Sans',sans-serif;overflow:hidden;}
.cc-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:52px;background:rgba(4,8,22,0.96);border-bottom:1px solid rgba(212,168,71,0.15);flex-shrink:0;position:relative;z-index:10;backdrop-filter:blur(24px);}
.cc-topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(212,168,71,0.7),transparent);}
.cc-main{display:flex;flex:1;overflow:hidden;position:relative;}
.cc-left{width:38%;display:flex;flex-direction:column;border-right:1px solid rgba(212,168,71,0.1);padding:12px;gap:9px;background:rgba(2,4,12,0.5);}
.cc-video-main{flex:1;border-radius:14px;overflow:hidden;border:1px solid rgba(99,102,241,0.2);background:linear-gradient(135deg,#080d1c,#0c1120);position:relative;display:flex;align-items:center;justify-content:center;min-height:0;}
.cc-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
.cc-thumb{aspect-ratio:16/9;border-radius:9px;background:linear-gradient(135deg,rgba(14,20,40,0.95),rgba(8,12,24,0.95));border:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:.2s;cursor:pointer;position:relative;overflow:hidden;}
.cc-thumb:hover{border-color:rgba(99,102,241,0.4);transform:translateY(-1px);}
.cc-thumb.calling{border-color:rgba(34,197,94,0.6);animation:ccGlow 1.5s ease-in-out infinite;}
.cc-toolbar{background:rgba(8,12,24,0.9);border-radius:10px;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
.cc-tb-btn{width:30px;height:30px;border-radius:7px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8b9ab8;font-size:12px;transition:.2s;}
.cc-tb-btn:hover{background:rgba(255,255,255,0.08);color:#eef2ff;}
.cc-tb-btn.active{background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.4);color:#4ade80;}
.cc-call-overlay{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(4,8,22,0.98),rgba(4,8,22,0.85),transparent);border-radius:0 0 14px 14px;padding:10px 14px;animation:ccFadeIn .3s ease;}
.cc-right{width:62%;display:flex;flex-direction:column;padding:12px;gap:9px;overflow-y:auto;background:rgba(3,6,18,0.4);}
.cc-filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.cc-filter-btn{background:rgba(8,12,26,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:5px 11px;font-size:11px;color:#8b9ab8;display:flex;align-items:center;gap:5px;cursor:pointer;transition:.2s;font-family:'DM Sans',sans-serif;position:relative;white-space:nowrap;}
.cc-filter-btn:hover{border-color:rgba(212,168,71,0.3);color:#f0c060;}
.cc-filter-btn.active{border-color:rgba(212,168,71,0.45);color:#f0c060;background:rgba(212,168,71,0.09);}
.cc-filter-btn b{color:#eef2ff;font-weight:600;}
.cc-dropdown{position:absolute;top:calc(100% + 4px);left:0;min-width:180px;background:rgba(8,12,24,0.99);border:1px solid rgba(212,168,71,0.25);border-radius:10px;padding:4px;z-index:9999;box-shadow:0 12px 40px rgba(0,0,0,0.7);animation:ccFadeIn .15s ease;}
.cc-dropdown-item{padding:7px 10px;border-radius:6px;font-size:11px;color:#8b9ab8;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:.15s;}
.cc-dropdown-item:hover{background:rgba(212,168,71,0.08);color:#eef2ff;}
.cc-dropdown-item.selected{color:#f0c060;background:rgba(212,168,71,0.1);}
.cc-dropdown-divider{height:1px;background:rgba(255,255,255,0.06);margin:3px 0;}
.cc-banner{background:linear-gradient(135deg,rgba(14,20,38,0.97),rgba(18,26,48,0.97));border-radius:12px;border:1px solid rgba(212,168,71,0.2);border-left:3px solid #f0c060;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;animation:ccPulse 3s ease-in-out infinite;flex-shrink:0;}
.cc-select{background:#02040a;border:1px solid rgba(212,168,71,0.4);border-radius:7px;color:#f0c060;font-size:11px;padding:4px 9px;outline:none;cursor:pointer;font-family:'DM Sans',sans-serif;}
.cc-commit-btn{background:linear-gradient(135deg,#c49b2a,#f0c060);border:none;border-radius:7px;padding:5px 14px;font-size:11px;font-weight:700;color:#1a1200;cursor:pointer;text-transform:uppercase;letter-spacing:.05em;transition:.2s;box-shadow:0 2px 12px rgba(212,168,71,0.35);}
.cc-commit-btn:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(212,168,71,0.5);}
.cc-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
.cc-tab{padding:7px 15px;font-size:12px;color:#8b9ab8;cursor:pointer;border-bottom:2px solid transparent;transition:.2s;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;}
.cc-tab.active{color:#f0c060;border-bottom-color:#f0c060;font-weight:600;}
.cc-metrics{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;}
.cc-metric{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:10px;padding:9px 6px;border:1px solid rgba(255,255,255,0.07);text-align:center;transition:.2s;position:relative;overflow:hidden;}
.cc-metric:hover{transform:translateY(-2px);border-color:rgba(255,255,255,0.12);}
.cc-chart-row{display:flex;gap:8px;min-height:155px;}
.cc-chart-box{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:12px;border:1px solid rgba(255,255,255,0.07);padding:11px;flex:1;display:flex;flex-direction:column;gap:6px;overflow:hidden;}
.cc-bar-row{display:flex;align-items:center;gap:6px;}
.cc-bar-track{flex:1;height:7px;background:rgba(255,255,255,0.04);border-radius:4px;overflow:hidden;}
.cc-bar-fill{height:100%;border-radius:4px;transition:width .8s ease;}
.cc-table-wrap{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:12px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;flex-shrink:0;}
.cc-table{width:100%;border-collapse:collapse;font-size:11px;}
.cc-table th{padding:7px 10px;color:#4a5568;font-weight:700;text-align:left;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(2,4,12,0.7);font-size:9px;text-transform:uppercase;letter-spacing:.6px;}
.cc-table td{padding:6px 10px;color:#8b9ab8;border-bottom:1px solid rgba(255,255,255,0.04);}
.cc-table tr:last-child td{border-bottom:none;}
.cc-table tr:hover td{background:rgba(255,255,255,0.025);}
.cc-badge{padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;text-transform:capitalize;}
.cc-av{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;margin-right:4px;flex-shrink:0;}
.cc-ps-hero{background:linear-gradient(135deg,rgba(18,26,50,0.97),rgba(14,20,40,0.97));border-radius:14px;border:1px solid rgba(212,168,71,0.25);padding:16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:relative;overflow:hidden;}
.cc-ps-hero::before{content:'';position:absolute;top:-40px;right:-40px;width:130px;height:130px;background:radial-gradient(circle,rgba(212,168,71,0.1),transparent 70%);pointer-events:none;}
.cc-history{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:14px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;flex:1;display:flex;flex-direction:column;min-height:0;}
.cc-history-hdr{padding:9px 13px;font-size:9px;color:#4a5568;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(2,4,12,0.6);font-weight:700;text-transform:uppercase;letter-spacing:.6px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
.cc-history-body{overflow-y:auto;flex:1;}
.cc-history-row{display:flex;align-items:center;justify-content:space-between;padding:7px 13px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;gap:8px;transition:.15s;}
.cc-history-row:last-child{border-bottom:none;}
.cc-history-row:hover{background:rgba(255,255,255,0.025);}
.cc-empty{padding:28px;text-align:center;font-size:11px;color:#4a5568;line-height:1.8;}
.cc-update-bar{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:12px;border:1px solid rgba(255,255,255,0.07);padding:9px 13px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.cc-error{background:rgba(244,63,94,0.07);border:1px solid rgba(244,63,94,0.2);border-radius:10px;padding:9px 13px;font-size:11px;color:#fb7185;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.cc-pagination{display:flex;align-items:center;gap:6px;justify-content:flex-end;padding:7px 10px;border-top:1px solid rgba(255,255,255,0.06);}
.cc-page-btn{padding:3px 9px;border-radius:5px;font-size:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#8b9ab8;cursor:pointer;font-family:'DM Sans',sans-serif;transition:.15s;}
.cc-page-btn:hover:not(:disabled){background:rgba(212,168,71,0.1);border-color:rgba(212,168,71,0.3);color:#f0c060;}
.cc-page-btn:disabled{opacity:.3;cursor:default;}
.cc-page-btn.active{background:rgba(212,168,71,0.15);border-color:rgba(212,168,71,0.4);color:#f0c060;font-weight:600;}
.cc-user-score-card{background:linear-gradient(135deg,rgba(212,168,71,0.08),rgba(99,102,241,0.08));border:1px solid rgba(212,168,71,0.2);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:10px;flex-shrink:0;}
.cc-analytics-card{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:12px;border:1px solid rgba(255,255,255,0.07);padding:13px;display:flex;flex-direction:column;gap:8px;}
.cc-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex-shrink:0;}
.cc-kpi{background:linear-gradient(145deg,rgba(14,20,40,0.95),rgba(8,12,26,0.95));border-radius:10px;padding:10px;border:1px solid rgba(255,255,255,0.07);text-align:center;position:relative;overflow:hidden;}
.cc-cmp-bar-group{display:flex;flex-direction:column;gap:8px;}
.cc-cmp-row{display:flex;align-items:center;gap:8px;}
.cc-cmp-label{font-size:9px;color:#4a5568;width:58px;text-align:right;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;}
.cc-cmp-bars{flex:1;display:flex;flex-direction:column;gap:3px;}
.cc-cmp-bar{height:9px;border-radius:3px;transition:width .8s ease;min-width:3px;}
.cc-worm-chart{position:relative;height:80px;overflow:hidden;}
.cc-worm-svg{width:100%;height:80px;}
`;

const CommandCenter: React.FC<CommandCenterProps> = ({ currentUser, apiBase }) => {
  const navigate = useNavigate();
  const API = apiBase ?? process.env.REACT_APP_API_URL ?? 'https://adaptable-patience-production-45da.up.railway.app';

  const [activeTab, setActiveTab]               = useState<'overview'|'analytics'|'promise'>('overview');
  const [promiseTabVisible, setPromiseTabVisible] = useState(false);
  const [bannerVisible, setBannerVisible]         = useState(true);
  const [selectedScore, setSelectedScore]         = useState(0);
  const [updateScore, setUpdateScore]             = useState(0);
  const [scores, setScores]                       = useState<PromiseScore[]>([]);
  const [loadingScores, setLoadingScores]         = useState(false);
  const [elapsed, setElapsed]                     = useState(0);
  const [tasks, setTasks]                         = useState<LiveTask[]>([]);
  const [users, setUsers]                         = useState<LiveUser[]>([]);
  const [loadingData, setLoadingData]             = useState(true);
  const [fetchError, setFetchError]               = useState<string|null>(null);
  const [lastRefresh, setLastRefresh]             = useState(new Date());
  const [selectedUser, setSelectedUser]           = useState<string>('all');
  const [selectedWeek, setSelectedWeek]           = useState<number|'all'>('all');
  const [selectedMonth, setSelectedMonth]         = useState<number|'all'>('all');
  const [showUserDrop, setShowUserDrop]           = useState(false);
  const [showWeekDrop, setShowWeekDrop]           = useState(false);
  const [showMonthDrop, setShowMonthDrop]         = useState(false);
  const [taskPage, setTaskPage]                   = useState(1);
  const [callingUser, setCallingUser]             = useState<LiveUser|null>(null);
  const [inCall, setInCall]                       = useState(false);
  const [micMuted, setMicMuted]                   = useState(false);
  const [camOff, setCamOff]                       = useState(false);
  const localVidRef  = useRef<HTMLVideoElement>(null);
  const [roleUpdating, setRoleUpdating]           = useState<string|null>(null);
  const [roleMsg, setRoleMsg]                     = useState<{id:string;ok:boolean;text:string}|null>(null);

  const currentWeek  = getWeekNumber(new Date());
  const currentMonth = new Date().getMonth();

  useEffect(() => { const t = setInterval(() => setElapsed(s=>s+1),1000); return ()=>clearInterval(t); }, []);
  const timerDisplay = `${padTwo(Math.floor(elapsed/3600))}:${padTwo(Math.floor((elapsed%3600)/60))}:${padTwo(elapsed%60)}`;

  useEffect(() => {
    const h = () => { setShowUserDrop(false); setShowWeekDrop(false); setShowMonthDrop(false); };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, []);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const [tr, ur] = await Promise.all([
        fetchWithTimeout(`${API}/api/tasks`, 30000),
        fetchWithTimeout(`${API}/api/users`, 30000).catch(() => null),
      ]);
      if (tr.ok) {
        const raw = await tr.json();
        const arr: any[] = Array.isArray(raw) ? raw : (raw.tasks || []);
        const now = new Date();
        setTasks(arr.map((t: any) => ({
          ...t, _id: t._id || t.id,
          tatBreached: t.tatBreached ?? (t.status !== 'completed' && t.status !== 'approved' && t.exactDeadline && new Date(t.exactDeadline) < now),
          assignedToName: t.assignedToName || (t.assignedTo ? t.assignedTo.split('@')[0].replace(/\./g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase()) : ''),
        })));
      } else { setFetchError(`Tasks API ${tr.status}`); }
      if (ur?.ok) { const ud = await ur.json(); const ua: any[] = Array.isArray(ud)?ud:(ud.users||[]); if(ua.length>0)setUsers(ua); }
      setLastRefresh(new Date());
    } catch (e: any) { setFetchError(e?.name==='AbortError'?'Request timed out':e?.message||'Network error'); }
    finally { setLoadingData(false); }
  }, [API]);

  useEffect(() => { fetchData(); const p=setInterval(fetchData,30000); return ()=>clearInterval(p); }, [fetchData]);

  const loadScores = useCallback(async () => {
    if (!currentUser?._id) return;
    setLoadingScores(true);
    try {
      const r = await fetchWithTimeout(`${API}/api/promise-score/${currentUser._id}`);
      const d: PromiseScore[] = await r.json();
      setScores(d);
      if (d.length > 0) { setPromiseTabVisible(true); setBannerVisible(false); }
    } catch(e) { console.error(e); } finally { setLoadingScores(false); }
  }, [API, currentUser?._id]);
  useEffect(() => { loadScores(); }, [loadScores]);

  const saveScore = async (score: number) => {
    if (!currentUser?._id) return;
    const now = new Date(); const week = getWeekNumber(now);
    await fetch(`${API}/api/promise-score`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:currentUser._id, week, weekLabel:`Week ${week}`, score, date:now.toISOString(), outcome:'pending' }) });
    await loadScores();
  };
  const markOutcome = async (entry: PromiseScore, outcome: 'met'|'missed') => {
    await fetch(`${API}/api/promise-score/${entry.userId}/${entry.week}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ outcome }) });
    await loadScores();
  };
  const handleCommitBanner = async () => { await saveScore(selectedScore); setBannerVisible(false); setPromiseTabVisible(true); setActiveTab('promise'); };

  const startCall = async (user: LiveUser) => {
    try { const s = await navigator.mediaDevices.getUserMedia({video:true,audio:true}); if(localVidRef.current)localVidRef.current.srcObject=s; } catch(e){}
    setCallingUser(user); setInCall(true);
  };
  const endCall = () => {
    if(localVidRef.current?.srcObject)(localVidRef.current.srcObject as MediaStream).getTracks().forEach(t=>t.stop());
    if(localVidRef.current)localVidRef.current.srcObject=null;
    setCallingUser(null); setInCall(false);
  };

  const updateRole = async (user: LiveUser, newRole: string) => {
    setRoleUpdating(user._id);
    try {
      const res = await fetch(`${API}/api/users/${user._id}/role`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === user._id ? { ...u, role: newRole } : u));
        setRoleMsg({ id: user._id, ok: true, text: `${user.name.split(' ')[0]} is now ${newRole}` });
        setTimeout(() => setRoleMsg(null), 3000);
      } else { setRoleMsg({ id: user._id, ok: false, text: 'Update failed' }); setTimeout(() => setRoleMsg(null), 3000); }
    } catch(e) { setRoleMsg({ id: user._id, ok: false, text: 'Network error' }); setTimeout(() => setRoleMsg(null), 3000); }
    finally { setRoleUpdating(null); }
  };

  const userMap = new Map<string, LiveUser>();
  users.forEach(u => { userMap.set(u.email,u); userMap.set(u._id,u); });

  const filteredTasks = tasks.filter(t => {
    if (selectedUser !== 'all') { const u=users.find(u=>u._id===selectedUser||u.email===selectedUser); if(!u||t.assignedTo?.toLowerCase()!==u.email?.toLowerCase())return false; }
    if (selectedMonth !== 'all') { const d=new Date(t.createdAt||t.dueDate||''); if(d.getMonth()!==selectedMonth)return false; }
    if (selectedWeek !== 'all') { const d=new Date(t.createdAt||t.dueDate||''); if(getWeekNumber(d)!==selectedWeek)return false; }
    return true;
  });

  const selectedUserObj = selectedUser!=='all'?users.find(u=>u._id===selectedUser||u.email===selectedUser):null;
  const userScoredTasks = selectedUser!=='all'?filteredTasks.filter(t=>t.scoreData?.percentScore!=null):[];
  const userAvgScore = userScoredTasks.length?(userScoredTasks.reduce((s,t)=>s+(t.scoreData?.percentScore??0),0)/userScoredTasks.length).toFixed(1):null;

  const ft=filteredTasks;
  const approved=ft.filter(t=>t.status==='approved'||t.status==='completed').length;
  const pendingCnt=ft.filter(t=>t.status==='pending').length;
  const assigned=ft.filter(t=>!['approved','completed'].includes(t.status)).length;
  const rework=ft.filter(t=>t.status==='rework').length;
  const inTat=ft.filter(t=>!t.tatBreached).length;
  const outTat=ft.filter(t=>t.tatBreached).length;
  const total=ft.length;
  const scoredTasks=ft.filter(t=>t.scoreData?.percentScore!=null);
  const avgScore=scoredTasks.length?(scoredTasks.reduce((s,t)=>s+t.scoreData!.percentScore!,0)/scoredTasks.length).toFixed(1):'—';
  const inTatPct=total?Math.round((inTat/total)*100):0;
  const outTatPct=total?Math.round((outTat/total)*100):0;
  const inTatArc=total?Math.round((inTat/total)*201):0;

  const sortedTasks=[...ft].sort((a,b)=>new Date(b.updatedAt||b.createdAt||'').getTime()-new Date(a.updatedAt||a.createdAt||'').getTime());
  const totalPages=Math.max(1,Math.ceil(sortedTasks.length/TASKS_PER_PAGE));
  const pagedTasks=sortedTasks.slice((taskPage-1)*TASKS_PER_PAGE,taskPage*TASKS_PER_PAGE);
  useEffect(()=>{setTaskPage(1);},[selectedUser,selectedWeek,selectedMonth]);

  // Analytics
  const now2=new Date();
  const prevWk=currentWeek-1;
  const thisWkTasks=tasks.filter(t=>{const d=new Date(t.updatedAt||t.createdAt||'');return getWeekNumber(d)===currentWeek;});
  const prevWkTasks=tasks.filter(t=>{const d=new Date(t.updatedAt||t.createdAt||'');return getWeekNumber(d)===prevWk;});
  const wkCmp=[
    {label:'Completed',tw:thisWkTasks.filter(t=>t.status==='approved'||t.status==='completed').length,pw:prevWkTasks.filter(t=>t.status==='approved'||t.status==='completed').length,color:'#4ade80'},
    {label:'Rework',   tw:thisWkTasks.filter(t=>t.status==='rework').length,   pw:prevWkTasks.filter(t=>t.status==='rework').length,   color:'#fb923c'},
    {label:'Pending',  tw:thisWkTasks.filter(t=>t.status==='pending').length,  pw:prevWkTasks.filter(t=>t.status==='pending').length,  color:'#fbbf24'},
    {label:'Breached', tw:thisWkTasks.filter(t=>t.tatBreached).length,         pw:prevWkTasks.filter(t=>t.tatBreached).length,         color:'#f87171'},
    {label:'Frozen',   tw:thisWkTasks.filter(t=>(t as any).isFrozen).length,   pw:prevWkTasks.filter(t=>(t as any).isFrozen).length,  color:'#60a5fa'},
  ];
  const wkCmpMax=Math.max(1,...wkCmp.flatMap(r=>[r.tw,r.pw]));

  // Worm data
  const wormData=Array.from({length:14},(_,i)=>{
    const d=new Date(now2); d.setDate(d.getDate()-(13-i));
    const ds=d.toISOString().slice(0,10);
    const dt=tasks.filter(t=>(t.updatedAt||t.createdAt||'').slice(0,10)===ds);
    return {day:`${d.getDate()}/${d.getMonth()+1}`,completed:dt.filter(t=>t.status==='approved'||t.status==='completed').length,rework:dt.filter(t=>t.status==='rework').length,pending:dt.filter(t=>t.status==='pending').length};
  });
  const wormMax=Math.max(1,...wormData.map(d=>Math.max(d.completed,d.rework,d.pending)));
  const W=560; const H=80;
  const mkPath=(vals:number[],color:string)=>{
    if(!vals.length)return null;
    const pts=vals.map((v,i)=>[i*(W/(vals.length-1||1)),H-(v/wormMax)*H*0.85-4]);
    const line=pts.map((p,i)=>i===0?`M${p[0].toFixed(1)},${p[1].toFixed(1)}`:`L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const fill=[...pts,[W,H],[0,H]].map((p,i)=>i===0?`M${(p[0] as number).toFixed(1)},${(p[1] as number).toFixed(1)}`:`L${(p[0] as number).toFixed(1)},${(p[1] as number).toFixed(1)}`).join(' ')+'Z';
    return <g key={color}><path d={fill} fill={color} fillOpacity="0.07"/><path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>{pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color} opacity="0.8"/>)}</g>;
  };

  const calleeStats = (() => {
    if (!callingUser) return null;
    const ut=tasks.filter(t=>t.assignedTo?.toLowerCase()===callingUser.email?.toLowerCase());
    const done=ut.filter(t=>t.status==='approved'||t.status==='completed').length;
    const breach=ut.filter(t=>t.tatBreached).length;
    const sc=ut.filter(t=>t.scoreData?.percentScore!=null).map(t=>t.scoreData!.percentScore!);
    const avg=sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):null;
    return {total:ut.length,done,breach,avg};
  })();

  const latestScore=scores.length?[...scores].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())[0]:null;
  const currentActual=scoredTasks.length?Math.round(scoredTasks.reduce((s,t)=>s+t.scoreData!.percentScore!,0)/scoredTasks.length):0;
  const targetScore=latestScore?Math.round(currentActual*(1+latestScore.score/100)):null;
  const diff=targetScore!==null?currentActual-targetScore!:null;
  const nextWeek=currentWeek+1;
  const userInitials=currentUser?.name?.slice(0,2).toUpperCase()??'SC';
  const availableWeeks=Array.from(new Set(tasks.map(t=>getWeekNumber(new Date(t.createdAt||t.dueDate||''))))).filter(Boolean).sort((a,b)=>b-a).slice(0,20);
  const participants=[
    ...users.filter(u=>u.role==='staff'||u.role==='admin').slice(0,3).map((u,i)=>({user:u,ini:initials(u.name||''),bg:av(i).bg,c:av(i).c,name:(u.name||'').split(' ')[0]})),
    ...(users.length>3?[{user:null as any,ini:`+${users.length-3}`,bg:'rgba(99,102,241,0.15)',c:'#a78bfa',name:''}]:[]),
  ];
  const METRICS=[
    {label:'Approved', value:approved,                         color:'#4ade80'},
    {label:'Pending',  value:pendingCnt,                       color:'#fbbf24'},
    {label:'Assigned', value:assigned,                         color:'#60a5fa'},
    {label:'Avg Score',value:avgScore,                         color:'#c4b5fd'},
    {label:'Rework',   value:String(rework).padStart(2,'0'),   color:'#fb7185'},
    {label:'In TAT',   value:`${inTatPct}%`,                   color:'#2dd4bf'},
    {label:'Out TAT',  value:`${outTatPct}%`,                  color:'#f87171'},
  ];
  const BARS=[
    {label:'Approved',   val:approved,   pct:total?Math.round((approved/total)*100):0,  color:'#4ade80'},
    {label:'In Progress',val:ft.filter(t=>t.status==='in_progress').length, pct:total?Math.round((ft.filter(t=>t.status==='in_progress').length/total)*100):0, color:'#60a5fa'},
    {label:'Pending',    val:pendingCnt, pct:total?Math.round((pendingCnt/total)*100):0, color:'#fbbf24'},
    {label:'Rework',     val:rework,     pct:total?Math.round((rework/total)*100):0,     color:'#fb923c'},
    {label:'Breached',   val:outTat,     pct:total?Math.round((outTat/total)*100):0,     color:'#f87171'},
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="cc-root" onClick={()=>{setShowUserDrop(false);setShowWeekDrop(false);setShowMonthDrop(false);}}>

        {/* TOPBAR */}
        <header className="cc-topbar">
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <button onClick={()=>navigate('/supremo')} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,color:'#8b9ab8',fontSize:12,padding:'5px 12px',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>← Back</button>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:30,height:30,borderRadius:7,background:'linear-gradient(135deg,#b8860b,#d4a847,#f0c060)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,color:'#1a1200',boxShadow:'0 2px 8px rgba(212,168,71,0.3)'}}>SC</div>
              <div><div style={{fontWeight:700,fontSize:13,color:'#f0c060',lineHeight:1}}>SmartCue</div><div style={{fontSize:9,color:'#8b9ab8'}}>Command Center</div></div>
            </div>
            <nav style={{display:'flex',gap:18,marginLeft:6}}>
              {['Dashboard','Analytics','Team','Settings'].map(item=>(
                <span key={item} style={{fontSize:12,color:item==='Dashboard'?'#afc6ff':'#8b9ab8',fontWeight:item==='Dashboard'?600:400,cursor:'pointer'}}>{item}</span>
              ))}
            </nav>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {fetchError
              ? <span style={{fontSize:10,color:'#fb7185',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={fetchError}>⚠ {fetchError}</span>
              : <span style={{fontSize:10,color:'#22c55e',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',display:'inline-block',animation:'ccBlink 1.5s infinite'}}/>Live · {lastRefresh.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            }
            <button onClick={fetchData} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#8b9ab8',fontSize:11,padding:'4px 10px',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>↺</button>
            <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.3))',border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#a5b4fc'}}>{userInitials}</div>
          </div>
        </header>

        <main className="cc-main">
          {/* LEFT */}
          <section className="cc-left">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',display:'inline-block',animation:'ccBlink 1.5s infinite'}}/>
                  <span style={{fontWeight:700,fontSize:13,color:'#eef2ff'}}>Operations Alignment</span>
                </div>
                <div style={{fontSize:9,color:'#4a5568',textTransform:'uppercase',letterSpacing:'.1em',marginTop:2}}>Live Feed · Private Channel</div>
              </div>
              <span style={{fontSize:11,color:'#f0c060',fontFamily:'JetBrains Mono,monospace',fontWeight:600,background:'rgba(212,168,71,0.08)',padding:'3px 9px',borderRadius:6,border:'1px solid rgba(212,168,71,0.15)'}}>{timerDisplay}</span>
            </div>

            <div className="cc-video-main">
              {inCall&&callingUser?(
                <>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#080d1c,#0c1225)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                      <div style={{width:70,height:70,borderRadius:'50%',background:av(0).bg,border:'3px solid rgba(34,197,94,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:av(0).c,boxShadow:'0 0 20px rgba(34,197,94,0.2)'}}>{initials(callingUser.name||'')}</div>
                      <span style={{fontSize:11,color:'#eef2ff',fontWeight:600}}>{callingUser.name}</span>
                      <span style={{fontSize:9,color:'#22c55e',display:'flex',alignItems:'center',gap:4}}><span style={{width:5,height:5,borderRadius:'50%',background:'#22c55e',animation:'ccBlink .8s infinite',display:'inline-block'}}/>In Call</span>
                    </div>
                  </div>
                  <video ref={localVidRef} autoPlay muted playsInline style={{position:'absolute',bottom:48,right:8,width:80,height:55,borderRadius:6,border:'1px solid rgba(212,168,71,0.3)',objectFit:'cover',background:'#000'}}/>
                  <div style={{position:'absolute',top:8,left:8,background:'rgba(0,0,0,0.8)',padding:'3px 9px',borderRadius:5,fontSize:10,color:'#eef2ff',border:'1px solid rgba(34,197,94,0.3)',display:'flex',alignItems:'center',gap:4}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:'#22c55e',animation:'ccBlink .8s infinite',display:'inline-block'}}/>{callingUser.name}
                  </div>
                  {calleeStats&&(
                    <div className="cc-call-overlay">
                      <div style={{fontSize:9,color:'#f0c060',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>📊 {callingUser.name.split(' ')[0]}'s Live Stats</div>
                      <div style={{display:'flex',gap:14}}>
                        {[{l:'Tasks',v:calleeStats.total,c:'#afc6ff'},{l:'Done',v:calleeStats.done,c:'#4ade80'},{l:'Breach',v:calleeStats.breach,c:'#f87171'},{l:'Score',v:calleeStats.avg!=null?`${calleeStats.avg}%`:'—',c:'#f0c060'}].map(({l,v,c})=>(
                          <div key={l} style={{textAlign:'center'}}>
                            <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:'JetBrains Mono,monospace',lineHeight:1}}>{v}</div>
                            <div style={{fontSize:8,color:'#4a5568',textTransform:'uppercase',marginTop:2}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ):(
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,opacity:.55}}>
                  <div style={{width:64,height:64,borderRadius:'50%',background:'linear-gradient(135deg,rgba(31,111,235,0.25),rgba(99,102,241,0.25))',border:'2px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'#afc6ff'}}>{userInitials}</div>
                  <span style={{fontSize:10,color:'#8b9ab8'}}>{currentUser?.name||'Supremo'}</span>
                  <span style={{fontSize:9,color:'#4a5568'}}>Click participant to connect</span>
                </div>
              )}
              <div style={{position:'absolute',top:7,right:7,background:'rgba(31,111,235,0.15)',border:'1px solid rgba(31,111,235,0.3)',borderRadius:4,padding:'2px 6px',fontSize:9,color:'#afc6ff'}}>HD</div>
            </div>

            <div className="cc-thumbs">
              {(participants.length>0?participants:[{user:null as any,ini:'...',bg:'rgba(99,102,241,0.1)',c:'#a5b4fc',name:''}]).slice(0,4).map(({user,ini,bg,c,name},i)=>(
                <div key={i} className={`cc-thumb${inCall&&callingUser?._id===user?._id?' calling':''}`}
                  onClick={()=>user&&(inCall&&callingUser?._id===user._id?endCall():startCall(user))}>
                  <div style={{width:26,height:26,borderRadius:'50%',background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:c}}>{ini}</div>
                  {name&&<span style={{fontSize:8,color:'#4a5568'}}>{name}</span>}
                  {user&&inCall&&callingUser?._id===user._id&&<div style={{position:'absolute',top:3,right:3,width:6,height:6,borderRadius:'50%',background:'#22c55e',animation:'ccBlink .8s infinite'}}/>}
                </div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {[{label:'Total',value:tasks.length,color:'#afc6ff',bg:'rgba(99,102,241,0.08)'},{label:'Breached',value:tasks.filter(t=>t.tatBreached).length,color:'#f87171',bg:'rgba(244,63,94,0.08)'},{label:'Team',value:users.length,color:'#4ade80',bg:'rgba(34,197,94,0.08)'}].map(({label,value,color,bg})=>(
                <div key={label} style={{background:bg,border:`1px solid ${color}20`,borderRadius:8,padding:'8px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:700,color,fontFamily:'JetBrains Mono,monospace',lineHeight:1}}>{value}</div>
                  <div style={{fontSize:8,color:'#4a5568',textTransform:'uppercase',letterSpacing:'.06em',marginTop:3}}>{label}</div>
                </div>
              ))}
            </div>

            <div className="cc-toolbar">
              <div className={`cc-tb-btn${micMuted?' active':''}`} onClick={()=>setMicMuted(m=>!m)}>{micMuted?'🔇':'🎙'}</div>
              <div className={`cc-tb-btn${camOff?' active':''}`} onClick={()=>setCamOff(c=>!c)}>{camOff?'📷':'📹'}</div>
              <div className="cc-tb-btn">🖥</div><div className="cc-tb-btn">👥</div><div className="cc-tb-btn">💬</div>
              {inCall
                ?<button onClick={endCall} style={{marginLeft:4,background:'linear-gradient(135deg,#dc2626,#ef4444)',border:'none',borderRadius:7,padding:'0 12px',height:30,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px rgba(220,38,38,0.4)'}}>End Call</button>
                :<button style={{marginLeft:4,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,padding:'0 12px',height:30,color:'#8b9ab8',fontSize:11,cursor:'pointer'}}>End</button>
              }
            </div>
          </section>

          {/* RIGHT */}
          <section className="cc-right">
            {/* FILTERS */}
            <div className="cc-filters" onClick={e=>e.stopPropagation()}>
              <div style={{position:'relative'}}>
                <button className={`cc-filter-btn${selectedWeek!=='all'?' active':''}`} onClick={()=>{setShowWeekDrop(v=>!v);setShowMonthDrop(false);setShowUserDrop(false);}}>
                  📅 <b>Week {selectedWeek==='all'?currentWeek:selectedWeek}</b> ▾
                </button>
                {showWeekDrop&&(
                  <div className="cc-dropdown">
                    <div className={`cc-dropdown-item${selectedWeek==='all'?' selected':''}`} onClick={()=>{setSelectedWeek('all');setShowWeekDrop(false);}}>All Weeks</div>
                    <div className="cc-dropdown-divider"/>
                    {availableWeeks.map(w=>(
                      <div key={w} className={`cc-dropdown-item${selectedWeek===w?' selected':''}`} onClick={()=>{setSelectedWeek(w);setShowWeekDrop(false);}}>Week {w} {w===currentWeek?'(current)':w===prevWk?'(last week)':''}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{position:'relative'}}>
                <button className={`cc-filter-btn${selectedMonth!=='all'?' active':''}`} onClick={()=>{setShowMonthDrop(v=>!v);setShowWeekDrop(false);setShowUserDrop(false);}}>
                  📅 <b>{selectedMonth==='all'?MONTHS[currentMonth]:MONTHS[selectedMonth as number]} {new Date().getFullYear()}</b> ▾
                </button>
                {showMonthDrop&&(
                  <div className="cc-dropdown">
                    <div className={`cc-dropdown-item${selectedMonth==='all'?' selected':''}`} onClick={()=>{setSelectedMonth('all');setShowMonthDrop(false);}}>All Months</div>
                    <div className="cc-dropdown-divider"/>
                    {MONTHS.map((m,i)=>(
                      <div key={m} className={`cc-dropdown-item${selectedMonth===i?' selected':''}`} onClick={()=>{setSelectedMonth(i);setShowMonthDrop(false);}}>{m} {new Date().getFullYear()}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{position:'relative'}}>
                <button className={`cc-filter-btn${selectedUser!=='all'?' active':''}`} onClick={()=>{setShowUserDrop(v=>!v);setShowWeekDrop(false);setShowMonthDrop(false);}}>
                  👤 <b>{selectedUser==='all'?`All (${users.length})`:(users.find(u=>u._id===selectedUser||u.email===selectedUser)?.name?.split(' ')[0]||'User')}</b> ▾
                </button>
                {showUserDrop&&(
                  <div className="cc-dropdown" style={{minWidth:230}}>
                    <div className={`cc-dropdown-item${selectedUser==='all'?' selected':''}`} onClick={()=>{setSelectedUser('all');setShowUserDrop(false);}}>
                      <span>All Users</span><span style={{fontSize:9,color:'#4a5568'}}>{tasks.length} tasks</span>
                    </div>
                    <div className="cc-dropdown-divider"/>
                    {users.filter(u=>u.role!=='superadmin').map((u,i)=>{
                      const uT=tasks.filter(t=>t.assignedTo?.toLowerCase()===u.email?.toLowerCase());
                      const uS=uT.filter(t=>t.scoreData?.percentScore!=null);
                      const uA=uS.length?(uS.reduce((s,t)=>s+(t.scoreData?.percentScore??0),0)/uS.length).toFixed(0):null;
                      return (
                        <div key={u._id} className={`cc-dropdown-item${selectedUser===u._id||selectedUser===u.email?' selected':''}`} onClick={()=>{setSelectedUser(u._id||u.email);setShowUserDrop(false);}}>
                          <div style={{display:'flex',alignItems:'center',gap:7}}>
                            <span style={{width:20,height:20,borderRadius:'50%',background:av(i).bg,color:av(i).c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,flexShrink:0}}>{initials(u.name||'')}</span>
                            <span style={{color:'#eef2ff'}}>{u.name}</span>
                          </div>
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            {uA&&<span style={{fontSize:9,color:Number(uA)>=85?'#4ade80':'#f87171',fontFamily:'monospace'}}>{uA}%</span>}
                            <span style={{fontSize:9,color:'#4a5568'}}>{uT.length}t</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="cc-filter-btn" style={{cursor:'default',color:fetchError?'#fb7185':loadingData?'#fbbf24':'#22c55e'}}>
                {fetchError?'⚠ Error':loadingData?'⏳ Loading…':'● Live'}
              </div>
              {(selectedUser!=='all'||selectedWeek!=='all'||selectedMonth!=='all')&&(
                <button className="cc-filter-btn" onClick={()=>{setSelectedUser('all');setSelectedWeek('all');setSelectedMonth('all');}} style={{color:'#fb7185',borderColor:'rgba(244,63,94,0.2)'}}>✕ Clear</button>
              )}
            </div>

            {selectedUserObj&&userAvgScore&&(
              <div className="cc-user-score-card">
                <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,rgba(212,168,71,0.2),rgba(99,102,241,0.2))',border:'1px solid rgba(212,168,71,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#f0c060',flexShrink:0}}>{initials(selectedUserObj.name||'')}</div>
                <div><div style={{fontSize:11,color:'#eef2ff',fontWeight:600}}>{selectedUserObj.name}</div><div style={{fontSize:9,color:'#8b9ab8',marginTop:1}}>{userScoredTasks.length} scored · {filteredTasks.length} total</div></div>
                <div style={{marginLeft:'auto',textAlign:'right'}}>
                  <div style={{fontSize:22,fontWeight:800,color:Number(userAvgScore)>=85?'#4ade80':'#f87171',fontFamily:'JetBrains Mono,monospace',lineHeight:1}}>{userAvgScore}%</div>
                  <div style={{fontSize:9,color:'#4a5568',marginTop:2}}>Avg Score</div>
                </div>
              </div>
            )}

            {fetchError&&(
              <div className="cc-error">
                <span>⚠ {fetchError}</span>
                <button onClick={fetchData} style={{background:'rgba(244,63,94,0.15)',border:'1px solid rgba(244,63,94,0.3)',borderRadius:6,color:'#fb7185',fontSize:11,padding:'4px 10px',cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Retry</button>
              </div>
            )}

            {bannerVisible&&(
              <div className="cc-banner">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:34,height:34,background:'linear-gradient(135deg,rgba(153,108,0,0.2),rgba(212,168,71,0.1))',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>🎖</div>
                  <span style={{fontSize:12,color:'#c2c6d6'}}><span style={{color:'#f0c060',fontWeight:600}}>What would be your promise score</span> for the next week?</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <select className="cc-select" value={selectedScore} onChange={e=>setSelectedScore(Number(e.target.value))}>
                    {[0,-1,-2,-3,-4,-5].map(v=><option key={v} value={v}>{v}%</option>)}
                  </select>
                  <button className="cc-commit-btn" onClick={handleCommitBanner}>Commit ✓</button>
                </div>
              </div>
            )}

            <div className="cc-tabs">
              <button className={`cc-tab${activeTab==='overview'?' active':''}`} onClick={()=>setActiveTab('overview')}>Overview</button>
              <button className={`cc-tab${activeTab==='analytics'?' active':''}`} onClick={()=>setActiveTab('analytics')}>📈 Analytics</button>
              {promiseTabVisible&&<button className={`cc-tab${activeTab==='promise'?' active':''}`} onClick={()=>setActiveTab('promise')}>⭐ Promise Score</button>}
              <span style={{marginLeft:'auto',fontSize:9,color:'#4a5568',alignSelf:'center',fontFamily:'monospace',paddingRight:4}}>{filteredTasks.length}/{tasks.length} · {lastRefresh.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
            </div>

            {/* OVERVIEW */}
            {activeTab==='overview'&&(
              <>
                <div className="cc-metrics">
                  {METRICS.map(({label,value,color})=>(
                    <div key={label} className="cc-metric">
                      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`,borderRadius:'10px 10px 0 0'}}/>
                      <div style={{fontSize:8,fontWeight:700,color,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:3}}>{label}</div>
                      <div style={{fontSize:20,fontWeight:800,color:'#eef2ff',lineHeight:1}}>{loadingData?'…':value}</div>
                    </div>
                  ))}
                </div>
                <div className="cc-chart-row">
                  <div className="cc-chart-box" style={{flex:1.3}}>
                    <div style={{fontSize:10,fontWeight:600,color:'#8b9ab8',display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:3,height:10,background:'linear-gradient(180deg,#afc6ff,#6366f1)',borderRadius:2,display:'inline-block'}}/>Task Status Distribution
                    </div>
                    {BARS.map(({label,val,pct,color})=>(
                      <div key={label} className="cc-bar-row">
                        <span style={{fontSize:9,color:'#4a5568',width:64,textAlign:'right',flexShrink:0}}>{label}</span>
                        <div className="cc-bar-track"><div className="cc-bar-fill" style={{width:`${Math.max(pct,1)}%`,background:`linear-gradient(90deg,${color}66,${color})`}}/></div>
                        <span style={{fontSize:9,color:'#8b9ab8',width:22,flexShrink:0}}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="cc-chart-box">
                    <div style={{fontSize:10,fontWeight:600,color:'#8b9ab8',display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:3,height:10,background:'linear-gradient(180deg,#f0c060,#d4a847)',borderRadius:2,display:'inline-block'}}/>In TAT vs Out of TAT
                    </div>
                    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
                      <svg width="84" height="84" viewBox="0 0 90 90">
                        <circle cx="45" cy="45" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11"/>
                        <circle cx="45" cy="45" r="32" fill="none" stroke="#2dd4bf" strokeWidth="11" strokeDasharray={`${inTatArc} ${201-inTatArc}`} strokeLinecap="round" transform="rotate(-90 45 45)"/>
                        <circle cx="45" cy="45" r="32" fill="none" stroke="#f87171" strokeWidth="11" strokeDasharray={`${201-inTatArc} ${inTatArc}`} strokeDashoffset={-inTatArc} strokeLinecap="round" transform="rotate(-90 45 45)"/>
                        <text x="45" y="41" textAnchor="middle" fill="#eef2ff" fontSize="13" fontWeight="700">{inTatPct}%</text>
                        <text x="45" y="53" textAnchor="middle" fill="#8b9ab8" fontSize="7">In TAT</text>
                      </svg>
                      <div style={{display:'flex',flexDirection:'column',gap:7}}>
                        {[{c:'#2dd4bf',l:`On Schedule — ${inTat}`},{c:'#f87171',l:`Delayed — ${outTat}`}].map(({c,l})=>(
                          <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#8b9ab8'}}><span style={{width:8,height:8,borderRadius:'50%',background:c,display:'inline-block'}}/>{l}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="cc-table-wrap">
                  <div style={{padding:'9px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(2,4,12,0.6)'}}>
                    <span style={{fontWeight:600,fontSize:12,color:'#eef2ff'}}>{selectedUser!=='all'?`${selectedUserObj?.name}'s Tasks`:'All Tasks'}</span>
                    <span style={{fontSize:10,color:'#4a5568'}}>Page {taskPage} of {totalPages} · {filteredTasks.length} total</span>
                  </div>
                  {loadingData?<div style={{padding:20,textAlign:'center',fontSize:11,color:'#fbbf24'}}>⏳ Loading tasks…</div>:(
                    <>
                      <table className="cc-table">
                        <thead><tr>{['Task','Assigned To','Status','Score','TAT'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                        <tbody>
                          {pagedTasks.map((task,idx)=>{
                            const name=task.assignedToName||userMap.get(task.assignedTo)?.name||task.assignedTo?.split('@')[0]||'—';
                            const ini=initials(name); const col=av(idx);
                            const {sc,sb}=statusColor(task.status);
                            const score=task.scoreData?.percentScore;
                            return (
                              <tr key={task._id}>
                                <td style={{color:'#eef2ff',fontWeight:500,maxWidth:155,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={task.title}>{task.title}</td>
                                <td><div style={{display:'flex',alignItems:'center',gap:4}}><span className="cc-av" style={{width:18,height:18,background:col.bg,color:col.c}}>{ini}</span><span style={{maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span></div></td>
                                <td><span className="cc-badge" style={{background:sb,color:sc,border:`1px solid ${sc}33`}}>{task.status.replace(/_/g,' ')}</span></td>
                                <td style={{color:score!=null?(score>=85?'#4ade80':'#f87171'):'#4a5568',fontFamily:'monospace',fontWeight:score!=null?600:400}}>{score!=null?score:'—'}</td>
                                <td><span style={{color:task.tatBreached?'#f87171':'#4ade80',fontWeight:600,fontSize:10,background:task.tatBreached?'rgba(244,63,94,0.08)':'rgba(34,197,94,0.08)',padding:'2px 6px',borderRadius:4}}>{task.tatBreached?'Out TAT':'In TAT'}</span></td>
                              </tr>
                            );
                          })}
                          {pagedTasks.length===0&&<tr><td colSpan={5} style={{textAlign:'center',color:'#4a5568',padding:24}}>No tasks for selected filters</td></tr>}
                        </tbody>
                      </table>
                      {totalPages>1&&(
                        <div className="cc-pagination">
                          <span style={{fontSize:10,color:'#4a5568',marginRight:4}}>{filteredTasks.length} tasks</span>
                          <button className="cc-page-btn" onClick={()=>setTaskPage(1)} disabled={taskPage===1}>«</button>
                          <button className="cc-page-btn" onClick={()=>setTaskPage(p=>Math.max(1,p-1))} disabled={taskPage===1}>‹</button>
                          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{const s=Math.max(1,Math.min(taskPage-2,totalPages-4));const p=s+i;return p<=totalPages?<button key={p} className={`cc-page-btn${taskPage===p?' active':''}`} onClick={()=>setTaskPage(p)}>{p}</button>:null;})}
                          <button className="cc-page-btn" onClick={()=>setTaskPage(p=>Math.min(totalPages,p+1))} disabled={taskPage===totalPages}>›</button>
                          <button className="cc-page-btn" onClick={()=>setTaskPage(totalPages)} disabled={taskPage===totalPages}>»</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ANALYTICS TAB */}
            {activeTab==='analytics'&&(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {/* KPI Strip */}
                <div className="cc-kpi-strip">
                  {[
                    {label:'This Week Done',  value:thisWkTasks.filter(t=>t.status==='approved'||t.status==='completed').length, color:'#4ade80', icon:'✅'},
                    {label:'Frozen Tickets',  value:tasks.filter(t=>(t as any).isFrozen).length,                                color:'#60a5fa', icon:'🧊'},
                    {label:'Rework This Wk',  value:thisWkTasks.filter(t=>t.status==='rework').length,                           color:'#fb923c', icon:'↺'},
                    {label:'TAT Breaches',    value:tasks.filter(t=>t.tatBreached).length,                                       color:'#f87171', icon:'⚠'},
                  ].map(({label,value,color,icon})=>(
                    <div key={label} className="cc-kpi">
                      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>
                      <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                      <div style={{fontSize:24,fontWeight:800,color,fontFamily:'JetBrains Mono,monospace',lineHeight:1}}>{value}</div>
                      <div style={{fontSize:9,color:'#4a5568',marginTop:4,textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Week-on-week comparison */}
                <div className="cc-analytics-card">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#eef2ff',display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:3,height:12,background:'linear-gradient(180deg,#f0c060,#d4a847)',borderRadius:2,display:'inline-block'}}/>
                      Week-on-Week Comparison
                    </div>
                    <div style={{display:'flex',gap:10,fontSize:9,color:'#4a5568'}}>
                      <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:10,height:3,background:'rgba(212,168,71,0.7)',display:'inline-block',borderRadius:1}}/>Wk {currentWeek} (this)</span>
                      <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:10,height:3,background:'rgba(99,102,241,0.6)',display:'inline-block',borderRadius:1}}/>Wk {prevWk} (last)</span>
                    </div>
                  </div>
                  <div className="cc-cmp-bar-group">
                    {wkCmp.map(({label,tw,pw,color})=>(
                      <div key={label} className="cc-cmp-row">
                        <span className="cc-cmp-label">{label}</span>
                        <div className="cc-cmp-bars">
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div className="cc-cmp-bar" style={{width:`${Math.round((tw/wkCmpMax)*100)}%`,background:`linear-gradient(90deg,${color}55,${color})`}}/>
                            <span style={{fontSize:9,color,fontFamily:'monospace',minWidth:14}}>{tw}</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div className="cc-cmp-bar" style={{width:`${Math.round((pw/wkCmpMax)*100)}%`,background:'linear-gradient(90deg,rgba(99,102,241,0.4),rgba(99,102,241,0.7))',opacity:.75}}/>
                            <span style={{fontSize:9,color:'#818cf8',fontFamily:'monospace',minWidth:14}}>{pw}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Worm chart */}
                <div className="cc-analytics-card">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#eef2ff',display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:3,height:12,background:'linear-gradient(180deg,#4ade80,#16a34a)',borderRadius:2,display:'inline-block'}}/>
                      14-Day Task Worm Trend
                    </div>
                    <div style={{display:'flex',gap:10,fontSize:9,color:'#4a5568'}}>
                      {[{c:'#4ade80',l:'Completed'},{c:'#fb923c',l:'Rework'},{c:'#fbbf24',l:'Pending'}].map(({c,l})=>(
                        <span key={l} style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:14,height:2,background:c,display:'inline-block',borderRadius:1}}/>{l}</span>
                      ))}
                    </div>
                  </div>
                  <div className="cc-worm-chart">
                    <svg className="cc-worm-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      {mkPath(wormData.map(d=>d.completed),'#4ade80')}
                      {mkPath(wormData.map(d=>d.rework),'#fb923c')}
                      {mkPath(wormData.map(d=>d.pending),'#fbbf24')}
                    </svg>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                    {wormData.filter((_,i)=>i%2===0).map(d=>(
                      <span key={d.day} style={{fontSize:8,color:'#4a5568'}}>{d.day}</span>
                    ))}
                  </div>
                </div>

                {/* Team performance table */}
                <div className="cc-analytics-card">
                  <div style={{fontSize:11,fontWeight:600,color:'#eef2ff',marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
                    <span style={{width:3,height:12,background:'linear-gradient(180deg,#c4b5fd,#8b5cf6)',borderRadius:2,display:'inline-block'}}/>
                    Team Performance Summary <span style={{fontSize:9,color:'#4a5568',fontWeight:400,marginLeft:4}}>· click row to filter</span>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                    <thead>
                      <tr>{['Member','Tasks','Done','Rework','Breach','Avg Score','Role'].map(h=>(
                        <th key={h} style={{padding:'5px 8px',color:'#4a5568',fontWeight:700,textAlign:'left',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:9,textTransform:'uppercase',letterSpacing:'.5px'}}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {users.filter(u=>u.role==='staff'||u.role==='admin').map((u,i)=>{
                        const ut=tasks.filter(t=>t.assignedTo?.toLowerCase()===u.email?.toLowerCase());
                        const done=ut.filter(t=>t.status==='approved'||t.status==='completed').length;
                        const rw=ut.filter(t=>t.status==='rework').length;
                        const br=ut.filter(t=>t.tatBreached).length;
                        const sc=ut.filter(t=>t.scoreData?.percentScore!=null).map(t=>t.scoreData!.percentScore!);
                        const avg=sc.length?(sc.reduce((a,b)=>a+b,0)/sc.length).toFixed(0):null;
                        const pct=ut.length?Math.round((done/ut.length)*100):0;
                        return (
                          <tr key={u._id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',transition:'.15s'}} onClick={()=>{setSelectedUser(u._id);setActiveTab('overview');}}>
                            <td style={{padding:'6px 8px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{width:20,height:20,borderRadius:'50%',background:av(i).bg,color:av(i).c,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,flexShrink:0}}>{initials(u.name||'')}</span>
                                <span style={{color:'#eef2ff',fontWeight:500}}>{u.name}</span>
                              </div>
                            </td>
                            <td style={{padding:'6px 8px',color:'#afc6ff',fontFamily:'monospace'}}>{ut.length}</td>
                            <td style={{padding:'6px 8px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:5}}>
                                <div style={{width:36,height:4,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden'}}>
                                  <div style={{height:'100%',width:`${pct}%`,background:pct>=85?'#4ade80':'#f87171',borderRadius:2}}/>
                                </div>
                                <span style={{color:pct>=85?'#4ade80':'#f87171',fontFamily:'monospace'}}>{done}</span>
                              </div>
                            </td>
                            <td style={{padding:'6px 8px',color:rw>0?'#fb923c':'#4a5568',fontFamily:'monospace'}}>{rw}</td>
                            <td style={{padding:'6px 8px',color:br>0?'#f87171':'#4ade80',fontFamily:'monospace'}}>{br}</td>
                            <td style={{padding:'6px 8px',color:avg?Number(avg)>=85?'#4ade80':'#f87171':'#4a5568',fontFamily:'monospace',fontWeight:600}}>{avg?`${avg}%`:'—'}</td>
                            <td style={{padding:'6px 8px'}} onClick={e=>e.stopPropagation()}>
                              {roleUpdating===u._id
                                ? <span style={{fontSize:9,color:'#fbbf24'}}>Updating…</span>
                                : roleMsg?.id===u._id
                                  ? <span style={{fontSize:9,color:roleMsg.ok?'#4ade80':'#f87171'}}>{roleMsg.text}</span>
                                  : <div style={{display:'flex',gap:4}}>
                                      {['staff','admin'].filter(r=>r!==u.role).map(r=>(
                                        <button key={r} onClick={()=>updateRole(u,r)} style={{padding:'2px 8px',fontSize:9,fontWeight:600,borderRadius:4,border:'none',cursor:'pointer',background:r==='admin'?'rgba(212,168,71,0.15)':'rgba(99,102,241,0.15)',color:r==='admin'?'#f0c060':'#a5b4fc',textTransform:'capitalize'}}>→ {r}</button>
                                      ))}
                                      <span style={{padding:'2px 7px',fontSize:9,fontWeight:700,borderRadius:4,background:u.role==='admin'?'rgba(212,168,71,0.1)':'rgba(99,102,241,0.1)',color:u.role==='admin'?'#f0c060':'#a5b4fc',border:'1px solid '+(u.role==='admin'?'rgba(212,168,71,0.3)':'rgba(99,102,241,0.3)')}}>{u.role}</span>
                                    </div>
              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PROMISE SCORE */}
            {activeTab==='promise'&&(
              <div style={{display:'flex',flexDirection:'column',gap:10,flex:1,overflow:'hidden'}}>
                {latestScore&&(
                  <div className="cc-ps-hero">
                    <div>
                      <div style={{fontSize:9,color:'#4a5568',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:4}}>Latest Commitment</div>
                      <div style={{fontSize:42,fontWeight:800,color:'#f0c060',lineHeight:1}}>{latestScore.score}%</div>
                      <div style={{fontSize:10,color:'#8b9ab8',marginTop:4}}>Committed {formatDate(latestScore.date)} — {latestScore.weekLabel}</div>
                      {diff!==null&&(
                        <div style={{marginTop:7,display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:7,background:diff>=0?'rgba(34,197,94,0.1)':'rgba(244,63,94,0.1)',fontSize:10,color:diff>=0?'#4ade80':'#fb7185',border:`1px solid ${diff>=0?'rgba(34,197,94,0.25)':'rgba(244,63,94,0.25)'}`}}>
                          {diff>=0?`↑ ${diff} pts above threshold`:`↓ ${Math.abs(diff)} pts below threshold`}
                        </div>
                      )}
                    </div>
                    <svg width="96" height="96" viewBox="0 0 90 90">
                      <path d="M15 75 A40 40 0 1 1 75 75" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" strokeLinecap="round"/>
                      <path d="M15 75 A40 40 0 1 1 75 75" fill="none" stroke="#f0c060" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.round(((latestScore.score+5)/5)*158)} 200`}/>
                      <text x="45" y="55" textAnchor="middle" fill="#f0c060" fontSize="14" fontWeight="700">{currentActual}</text>
                      <text x="45" y="67" textAnchor="middle" fill="#8b9ab8" fontSize="7">Avg Score</text>
                    </svg>
                  </div>
                )}
                <div className="cc-history">
                  <div className="cc-history-hdr">
                    <span>Committed Promise Scores — All Weeks</span>
                    <span style={{color:'#6366f1',fontFamily:'monospace'}}>{scores.length} entries</span>
                  </div>
                  <div className="cc-history-body">
                    {loadingScores?<div className="cc-empty">Loading…</div>
                    :scores.length===0?<div className="cc-empty">No promise scores yet.</div>
                    :[...scores].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(entry=>(
                      <div key={`${entry.week}-${entry.date}`} className="cc-history-row">
                        <span style={{color:'#eef2ff',fontWeight:500,width:56}}>{entry.weekLabel}</span>
                        <span style={{color:'#4a5568',flex:1,fontSize:10}}>{formatDate(entry.date)}</span>
                        <span style={{color:'#f0c060',fontWeight:700,width:30,textAlign:'center'}}>{entry.score}%</span>
                        <span className="cc-badge" style={{background:entry.outcome==='met'?'rgba(34,197,94,0.1)':entry.outcome==='missed'?'rgba(244,63,94,0.1)':'rgba(245,158,11,0.1)',color:entry.outcome==='met'?'#4ade80':entry.outcome==='missed'?'#fb7185':'#fbbf24',border:`1px solid ${entry.outcome==='met'?'rgba(34,197,94,0.25)':entry.outcome==='missed'?'rgba(244,63,94,0.25)':'rgba(245,158,11,0.25)'}`}}>{entry.outcome}</span>
                        {entry.outcome==='pending'&&(
                          <div style={{display:'flex',gap:4,marginLeft:4}}>
                            <button onClick={()=>markOutcome(entry,'met')} style={{padding:'2px 6px',fontSize:9,background:'rgba(34,197,94,0.1)',color:'#4ade80',border:'1px solid rgba(34,197,94,0.2)',borderRadius:4,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Met</button>
                            <button onClick={()=>markOutcome(entry,'missed')} style={{padding:'2px 6px',fontSize:9,background:'rgba(244,63,94,0.1)',color:'#fb7185',border:'1px solid rgba(244,63,94,0.2)',borderRadius:4,cursor:'pointer',fontFamily:'DM Sans,sans-serif'}}>Missed</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cc-update-bar">
                  <div>
                    <div style={{fontSize:11,color:'#eef2ff',fontWeight:500}}>Commit promise score</div>
                    <div style={{fontSize:9,color:'#4a5568',marginTop:2}}>For <span style={{color:'#f0c060'}}>Week {nextWeek}</span></div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <select className="cc-select" value={updateScore} onChange={e=>setUpdateScore(Number(e.target.value))}>
                      {[0,-1,-2,-3,-4,-5].map(v=><option key={v} value={v}>{v}%</option>)}
                    </select>
                    <button className="cc-commit-btn" onClick={()=>saveScore(updateScore)}>Commit ✓</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
};

export default CommandCenter;

// deploy 18:50:12