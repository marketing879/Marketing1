import React, { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PromiseScore {
  _id?: string;
  userId: string;
  week: number;
  weekLabel: string;
  score: number;
  date: string;
  outcome: 'pending' | 'met' | 'missed';
}

interface CommandCenterProps {
  /** Pass currentUser from your UserContext */
  currentUser?: { _id: string; name: string; email: string };
  /** Override API base; defaults to REACT_APP_API_URL env var */
  apiBase?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function padTwo(n: number) { return String(n).padStart(2, '0'); }

// ── Sub-components ────────────────────────────────────────────────────────────

const MetricCard = ({
  label, value, color,
}: { label: string; value: string | number; color: string }) => (
  <div className="bg-[#181c22] p-4 rounded-xl border border-[#424754]/10 hover:bg-[#1c2026] transition-all">
    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${color}`}>{label}</div>
    <div className="text-2xl font-black text-[#dfe2eb]">{value}</div>
  </div>
);

const OutcomeBadge = ({ outcome }: { outcome: PromiseScore['outcome'] }) => {
  const map = {
    met:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    missed:  'bg-rose-500/10    text-rose-400    border-rose-500/20',
    pending: 'bg-amber-500/10   text-amber-400   border-amber-500/20',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase ${map[outcome]}`}>
      {outcome}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const CommandCenter: React.FC<CommandCenterProps> = ({ currentUser, apiBase }) => {
  const API = apiBase ?? process.env.REACT_APP_API_URL ?? '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState<'overview' | 'promise'>('overview');
  const [promiseTabVisible, setPromiseTabVisible] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [selectedScore, setSelectedScore] = useState<number>(0);
  const [updateScore, setUpdateScore]     = useState<number>(0);
  const [scores, setScores]               = useState<PromiseScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [elapsed, setElapsed]             = useState(0);

  // ── Live timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const timerDisplay = `${padTwo(Math.floor(elapsed / 3600))}:${padTwo(Math.floor((elapsed % 3600) / 60))}:${padTwo(elapsed % 60)}`;

  // ── API calls ──────────────────────────────────────────────────────────────
  const loadScores = useCallback(async () => {
    if (!currentUser?._id) return;
    setLoadingScores(true);
    try {
      const res = await fetch(`${API}/api/promise-score/${currentUser._id}`);
      const data: PromiseScore[] = await res.json();
      setScores(data);
      if (data.length > 0) { setPromiseTabVisible(true); setBannerVisible(false); }
    } catch (e) { console.error('Failed to load promise scores', e); }
    finally { setLoadingScores(false); }
  }, [API, currentUser?._id]);

  useEffect(() => { loadScores(); }, [loadScores]);

  const saveScore = async (score: number) => {
    if (!currentUser?._id) return;
    const now   = new Date();
    const week  = getWeekNumber(now);
    const body: Omit<PromiseScore, '_id'> = {
      userId:    currentUser._id,
      week,
      weekLabel: `Week ${week}`,
      score,
      date:      now.toISOString(),
      outcome:   'pending',
    };
    await fetch(`${API}/api/promise-score`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    await loadScores();
  };

  const markOutcome = async (entry: PromiseScore, outcome: 'met' | 'missed') => {
    await fetch(`${API}/api/promise-score/${entry.userId}/${entry.week}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ outcome }),
    });
    await loadScores();
  };

  const handleCommitBanner = async () => {
    await saveScore(selectedScore);
    setBannerVisible(false);
    setPromiseTabVisible(true);
    setActiveTab('promise');
  };

  const handleCommitPanel = async () => {
    await saveScore(updateScore);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const latestScore  = scores.length
    ? [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;
  const currentActual = 78; // TODO: replace with real score from your metrics API
  const targetScore   = latestScore ? Math.round(currentActual * (1 + latestScore.score / 100)) : null;
  const diff          = targetScore !== null ? currentActual - targetScore : null;
  const nextWeek      = getWeekNumber(new Date()) + 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dark bg-[#10141a] text-[#dfe2eb] font-['Inter'] overflow-hidden h-screen flex flex-col">

      {/* ── Top Nav ── */}
      <header className="bg-[#10141a] text-[#afc6ff] text-sm flex justify-between items-center w-full px-6 h-16 shrink-0 z-50 border-b border-[#c2c6d6]/20">
        <div className="flex items-center gap-8">
          <span className="text-xl font-black text-[#dfe2eb]">SmartCue</span>
          <nav className="hidden md:flex gap-6">
            {['Dashboard', 'Analytics', 'Team', 'Settings'].map(item => (
              <a key={item}
                className={`pb-1 transition-colors ${item === 'Dashboard'
                  ? 'text-[#afc6ff] font-bold border-b-2 border-[#afc6ff]'
                  : 'text-[#c2c6d6] hover:text-[#dfe2eb]'}`}
                href="#">
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative bg-[#0a0e14] px-4 py-1.5 rounded-full flex items-center gap-2 border border-[#424754]/20">
            <span className="material-symbols-outlined text-sm text-[#c2c6d6]">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-xs w-48 text-[#dfe2eb] outline-none"
              placeholder="Search Command Center..." type="text" />
          </div>
          <button className="material-symbols-outlined text-[#c2c6d6] hover:text-[#afc6ff] p-2 rounded-full hover:bg-[#262a31]">notifications</button>
          <button className="material-symbols-outlined text-[#c2c6d6] hover:text-[#afc6ff] p-2 rounded-full hover:bg-[#262a31]">videocam</button>
          <div className="h-8 w-8 rounded-full bg-[#1f6feb] flex items-center justify-center text-xs font-bold text-white border border-[#424754]/30">
            {currentUser?.name?.slice(0, 2).toUpperCase() ?? 'PG'}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex overflow-hidden">

        {/* ── LEFT: Live Meet ── */}
        <section className="w-[40%] flex flex-col bg-[#10141a] border-r border-[#fabc45]/30 relative h-full">

          {/* Meet header */}
          <div className="p-6 flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-lg font-bold tracking-tight text-[#dfe2eb]">Operations Alignment</h2>
              </div>
              <span className="text-xs font-mono text-[#c2c6d6] uppercase tracking-widest mt-1">Live Feed • Private Channel</span>
            </div>
            <div className="bg-[#262a31] px-3 py-1.5 rounded-lg border border-[#424754]/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#afc6ff]">schedule</span>
              <span className="text-sm font-mono font-medium">{timerDisplay}</span>
            </div>
          </div>

          {/* Primary video tile */}
          <div className="flex-1 px-6 pb-4 flex flex-col justify-center">
            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-[#afc6ff]/40 shadow-[0_0_20px_rgba(175,198,255,0.2)]">
              <div className="w-full h-full bg-[#1c2026] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 opacity-60">
                  <span className="material-symbols-outlined text-4xl text-[#afc6ff]">videocam</span>
                  <span className="text-xs text-[#c2c6d6]">Camera feed</span>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 bg-[#10141a]/80 backdrop-blur-md px-3 py-1 rounded-md border border-[#424754]/30 flex items-center gap-2">
                <span className="text-xs font-semibold text-[#dfe2eb]">Sarah Jenkins (CEO)</span>
                <span className="material-symbols-outlined text-xs text-[#afc6ff]">mic</span>
              </div>
            </div>
          </div>

          {/* Participant thumbnails */}
          <div className="px-6 pb-24 grid grid-cols-4 gap-3">
            {[
              { initials: 'JD', bg: 'bg-[#1f6feb]/30', color: 'text-[#afc6ff]', name: 'James D.' },
              { initials: 'AM', bg: 'bg-[#ee9800]/30', color: 'text-[#ffb95f]', name: 'Anna M.' },
              { initials: 'PG', bg: 'bg-emerald-900/40', color: 'text-emerald-400', name: 'Pushkaraj' },
              { initials: '+12', bg: 'bg-[#262a31]', color: 'text-[#fabc45]', name: '' },
            ].map(({ initials, bg, color, name }) => (
              <div key={initials} className="aspect-video rounded-lg overflow-hidden border border-[#424754]/20 relative flex flex-col items-center justify-center gap-1">
                <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-xs font-bold ${color}`}>{initials}</div>
                {name && <span className="text-[8px] text-[#c2c6d6]">{name}</span>}
              </div>
            ))}
          </div>

          {/* Floating toolbar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-[#1c2026]/80 backdrop-blur-xl rounded-full border border-[#424754]/20 shadow-2xl">
            {['mic', 'videocam', 'present_to_all'].map(icon => (
              <button key={icon} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#31353c] transition-colors text-[#dfe2eb]">
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
            <div className="w-px h-6 bg-[#424754]/30 mx-1" />
            {['group', 'chat'].map(icon => (
              <button key={icon} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#31353c] transition-colors text-[#dfe2eb]">
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
            <button className="ml-2 px-6 h-10 bg-red-700 rounded-full text-white font-bold text-sm tracking-wide hover:opacity-90 transition-opacity">
              End
            </button>
          </div>
        </section>

        {/* ── RIGHT: Analytics ── */}
        <section className="w-[60%] flex flex-col bg-[#10141a] overflow-y-auto">

          {/* Filter pills */}
          <div className="px-8 pt-8 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex bg-[#1c2026] rounded-lg p-1 border border-[#424754]/10">
                <button className="px-4 py-1.5 rounded-md text-xs font-bold text-[#fabc45] bg-[#10141a] shadow-sm">
                  Week {getWeekNumber(new Date())}
                </button>
                <button className="px-4 py-1.5 rounded-md text-xs font-medium text-[#c2c6d6] hover:text-[#dfe2eb]">April 2026</button>
              </div>
              <div className="h-8 w-px bg-[#424754]/20" />
              <div className="flex -space-x-2">
                {['JD', 'AM', 'PG'].map((init, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#10141a] bg-[#1f6feb] flex items-center justify-center text-[8px] font-bold text-white">
                    {init}
                  </div>
                ))}
                <button className="w-8 h-8 rounded-full border-2 border-[#10141a] bg-[#31353c] flex items-center justify-center text-[10px] text-[#c2c6d6] font-bold">+</button>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-1.5 bg-[#262a31] rounded-lg text-xs font-medium border border-[#424754]/20 hover:bg-[#31353c] transition-colors text-[#dfe2eb]">
              <span className="material-symbols-outlined text-sm">filter_list</span>
              More Filters
            </button>
          </div>

          {/* Promise Score Banner */}
          {bannerVisible && (
            <div className="px-8 py-4">
              <div className="bg-[#1c2026] rounded-xl p-4 flex items-center justify-between border border-[#424754]/10 border-l-4 border-l-[#fabc45] shadow-lg shadow-black/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#996c00]/20 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#fabc45]">military_tech</span>
                  </div>
                  <span className="text-sm font-medium text-[#dfe2eb]">
                    What would be your promise score for the next week?
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <select
                    className="bg-[#0a0e14] border border-[#424754]/30 text-xs rounded-lg px-3 py-1.5 text-[#dfe2eb] outline-none focus:border-[#fabc45]"
                    value={selectedScore}
                    onChange={e => setSelectedScore(Number(e.target.value))}
                  >
                    {[0, -1, -2, -3, -4, -5].map(v => (
                      <option key={v} value={v}>{v}%</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCommitBanner}
                    className="bg-[#fabc45] text-[#422c00] px-6 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-md"
                  >
                    Commit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab Bar */}
          <div className="px-8 border-b border-[#424754]/10 flex items-center justify-between">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-4 text-sm font-bold relative transition-colors ${activeTab === 'overview' ? 'text-[#dfe2eb]' : 'text-[#c2c6d6] hover:text-[#dfe2eb]'}`}
              >
                Overview
                {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#fabc45]" />}
              </button>
              {promiseTabVisible && (
                <button
                  onClick={() => setActiveTab('promise')}
                  className={`pb-4 text-sm font-medium relative transition-colors ${activeTab === 'promise' ? 'text-[#dfe2eb] font-bold' : 'text-[#c2c6d6] hover:text-[#dfe2eb]'}`}
                >
                  ⭐ Promise Score
                  {activeTab === 'promise' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#fabc45]" />}
                </button>
              )}
            </div>
            <div className="pb-4">
              <span className="text-[10px] font-mono text-[#c2c6d6] uppercase tracking-tighter">Updated: just now</span>
            </div>
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="p-8 space-y-8">

              {/* 7 Metric Cards */}
              <div className="grid grid-cols-7 gap-4">
                <MetricCard label="Approved"   value={24}    color="text-emerald-400" />
                <MetricCard label="Pending"    value={12}    color="text-amber-400" />
                <MetricCard label="Assigned"   value={48}    color="text-blue-400" />
                <MetricCard label="Avg Score"  value="9.2"   color="text-purple-400" />
                <MetricCard label="Rework"     value="03"    color="text-rose-400" />
                <MetricCard label="In TAT"     value="94%"   color="text-teal-400" />
                <MetricCard label="Out of TAT" value="06%"   color="text-rose-500" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-8">
                {/* Bar chart */}
                <div className="bg-[#1c2026] p-6 rounded-xl border border-[#424754]/10">
                  <h3 className="text-sm font-bold text-[#dfe2eb] mb-6 flex items-center gap-2">
                    <span className="w-1 h-3 bg-[#afc6ff] rounded-full" />
                    Task Completion Duration
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Research Phase', val: '4.2h', pct: 75 },
                      { label: 'Design Sync',    val: '1.8h', pct: 40 },
                      { label: 'Dev Review',     val: '5.1h', pct: 90 },
                    ].map(({ label, val, pct }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-[#c2c6d6]">
                          <span>{label}</span><span>{val}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#10141a] rounded-full overflow-hidden">
                          <div className="h-full bg-[#afc6ff] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut */}
                <div className="bg-[#1c2026] p-6 rounded-xl border border-[#424754]/10 flex flex-col">
                  <h3 className="text-sm font-bold text-[#dfe2eb] mb-6 flex items-center gap-2">
                    <span className="w-1 h-3 bg-[#fabc45] rounded-full" />
                    In TAT vs Out of TAT
                  </h3>
                  <div className="flex-1 flex items-center justify-center gap-8">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke="#262a31" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none" stroke="#14b8a6" strokeWidth="3"
                          strokeDasharray="94, 100" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-[#dfe2eb]">94%</span>
                        <span className="text-[8px] uppercase tracking-tighter text-[#c2c6d6]">Optimal</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span className="text-[10px] text-[#c2c6d6]">On Schedule (TAT)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[10px] text-[#c2c6d6]">Delayed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Table */}
              <div className="bg-[#1c2026] rounded-xl border border-[#424754]/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#424754]/10 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#dfe2eb]">Recent Active Tasks</h3>
                  <button className="text-xs font-bold text-[#afc6ff] hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#181c22] text-[#c2c6d6]">
                        {['Task Name', 'Assigned To', 'Status', 'Score', 'Duration', 'TAT'].map(h => (
                          <th key={h} className="px-6 py-3 font-bold uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#424754]/5">
                      {[
                        { task: 'UI: Command Panel', initials: 'JD', name: 'James D.', status: 'In Progress', statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', score: 9.8, dur: '04:12h', tat: 'OK',   tatColor: 'text-emerald-500' },
                        { task: 'Backend Schema',    initials: 'AM', name: 'Anna M.',  status: 'Review',      statusColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   score: 8.5, dur: '08:45h', tat: 'Late', tatColor: 'text-rose-500'    },
                      ].map(row => (
                        <tr key={row.task} className="hover:bg-[#262a31] transition-colors">
                          <td className="px-6 py-4 font-medium text-[#dfe2eb]">{row.task}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#1f6feb]/30 flex items-center justify-center text-[8px] font-bold text-[#afc6ff]">{row.initials}</div>
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase ${row.statusColor}`}>{row.status}</span>
                          </td>
                          <td className="px-6 py-4 text-center font-mono">{row.score}</td>
                          <td className="px-6 py-4 text-[#c2c6d6]">{row.dur}</td>
                          <td className={`px-6 py-4 font-bold ${row.tatColor}`}>{row.tat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── PROMISE SCORE TAB ── */}
          {activeTab === 'promise' && (
            <div className="p-8 space-y-6">

              {/* Hero card */}
              {latestScore && (
                <div className="bg-[#1c2026] rounded-xl border border-[#fabc45]/20 p-6 flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="text-[10px] text-[#c2c6d6] uppercase tracking-widest">Latest commitment</div>
                    <div className="text-5xl font-black text-[#fabc45]">{latestScore.score}%</div>
                    <div className="text-xs text-[#c2c6d6]">
                      Committed on {formatDate(latestScore.date)} — {latestScore.weekLabel}
                    </div>
                    {diff !== null && (
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        <span className="material-symbols-outlined text-sm">{diff >= 0 ? 'trending_up' : 'trending_down'}</span>
                        {diff >= 0
                          ? `You are ${diff} pts above your committed threshold`
                          : `You are ${Math.abs(diff)} pts below your committed threshold`}
                      </div>
                    )}
                  </div>
                  {/* Arc gauge */}
                  <div className="relative w-36 h-36">
                    <svg className="w-full h-full" viewBox="0 0 90 90">
                      <path d="M15 75 A40 40 0 1 1 75 75" fill="none" stroke="#262a31" strokeWidth="10" strokeLinecap="round" />
                      <path d="M15 75 A40 40 0 1 1 75 75" fill="none" stroke="#fabc45" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${Math.round(((latestScore.score + 5) / 5) * 158)} 200`} />
                      <text x="45" y="56" textAnchor="middle" fill="#fabc45" fontSize="13" fontWeight="600">{currentActual}</text>
                      <text x="45" y="68" textAnchor="middle" fill="#8c90a0" fontSize="7">Current</text>
                    </svg>
                    {targetScore !== null && (
                      <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-[#c2c6d6]">
                        Target: {targetScore} ({latestScore.score}%)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History ledger */}
              <div className="bg-[#1c2026] rounded-xl border border-[#424754]/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#424754]/10 flex items-center justify-between bg-[#181c22]">
                  <h3 className="text-sm font-bold text-[#dfe2eb]">Committed promise scores — all weeks</h3>
                  <span className="text-[10px] text-[#c2c6d6] font-mono">{scores.length} entries</span>
                </div>

                {loadingScores ? (
                  <div className="px-6 py-8 text-center text-xs text-[#c2c6d6]">Loading history…</div>
                ) : scores.length === 0 ? (
                  <div className="px-6 py-8 text-center text-xs text-[#c2c6d6]">
                    No promise scores committed yet. Use the banner above to commit your first score.
                  </div>
                ) : (
                  <div className="divide-y divide-[#424754]/5 max-h-64 overflow-y-auto">
                    {[...scores]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(entry => (
                        <div key={`${entry.week}-${entry.date}`} className="px-6 py-3 flex items-center justify-between hover:bg-[#262a31] transition-colors">
                          <span className="text-sm text-[#dfe2eb] font-medium w-24">{entry.weekLabel}</span>
                          <span className="text-xs text-[#c2c6d6] flex-1 px-4">{formatDate(entry.date)}</span>
                          <span className="text-sm font-bold text-[#fabc45] w-12 text-center">{entry.score}%</span>
                          <div className="flex items-center gap-2">
                            <OutcomeBadge outcome={entry.outcome} />
                            {/* Mark met/missed buttons for pending entries */}
                            {entry.outcome === 'pending' && (
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => markOutcome(entry, 'met')}
                                  className="px-2 py-0.5 text-[9px] bg-emerald-900/30 text-emerald-400 rounded border border-emerald-500/20 hover:bg-emerald-900/50 transition-colors"
                                >Met</button>
                                <button
                                  onClick={() => markOutcome(entry, 'missed')}
                                  className="px-2 py-0.5 text-[9px] bg-rose-900/30 text-rose-400 rounded border border-rose-500/20 hover:bg-rose-900/50 transition-colors"
                                >Missed</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Commit next week */}
              <div className="bg-[#1c2026] rounded-xl border border-[#424754]/10 p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#dfe2eb]">Commit promise score</div>
                  <div className="text-[10px] text-[#c2c6d6]">
                    For <span className="text-[#fabc45]">Week {nextWeek}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="bg-[#0a0e14] border border-[#424754]/30 text-xs rounded-lg px-3 py-1.5 text-[#dfe2eb] outline-none focus:border-[#fabc45]"
                    value={updateScore}
                    onChange={e => setUpdateScore(Number(e.target.value))}
                  >
                    {[0, -1, -2, -3, -4, -5].map(v => (
                      <option key={v} value={v}>{v}%</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCommitPanel}
                    className="bg-[#fabc45] text-[#422c00] px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all"
                  >
                    Commit ✓
                  </button>
                </div>
              </div>

            </div>
          )}

        </section>
      </main>
    </div>
  );
};

export default CommandCenter;