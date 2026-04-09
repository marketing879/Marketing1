import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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
  currentUser?: { _id: string; name: string; email: string };
  apiBase?: string;
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function padTwo(n: number) { return String(n).padStart(2, '0'); }

const CSS = `
@keyframes ccBlink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes ccPulse{0%,100%{border-left-color:#fabc45}50%{border-left-color:#5b3800}}
.cc-root{display:flex;flex-direction:column;height:100vh;background:#02040a;color:#eef2ff;font-family:'DM Sans',sans-serif;overflow:hidden;}
.cc-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:56px;background:rgba(2,4,10,0.7);border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;position:relative;z-index:10;}
.cc-topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#d4a847,transparent);opacity:.4;}
.cc-main{display:flex;flex:1;overflow:hidden;}
.cc-left{width:40%;display:flex;flex-direction:column;border-right:1px solid rgba(212,168,71,0.2);padding:14px;gap:10px;background:rgba(2,4,10,0.3);}
.cc-right{width:60%;display:flex;flex-direction:column;padding:14px;gap:10px;overflow-y:auto;background:rgba(4,8,20,0.2);}
.cc-video-main{flex:1;border-radius:14px;overflow:hidden;border:2px solid rgba(99,102,241,0.25);background:#0d1117;position:relative;display:flex;align-items:center;justify-content:center;min-height:0;}
.cc-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;}
.cc-thumb{aspect-ratio:16/9;border-radius:8px;background:rgba(16,22,36,0.8);border:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;}
.cc-toolbar{background:rgba(16,22,36,0.8);backdrop-filter:blur(16px);border-radius:10px;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
.cc-tb-btn{width:30px;height:30px;border-radius:7px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8b9ab8;font-size:12px;transition:.15s;}
.cc-tb-btn:hover{background:rgba(255,255,255,0.08);color:#eef2ff;}
.cc-filters{display:flex;gap:7px;flex-wrap:wrap;}
.cc-pill{background:rgba(16,22,36,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:4px 11px;font-size:11px;color:#8b9ab8;display:flex;align-items:center;gap:4px;cursor:pointer;}
.cc-pill b{color:#eef2ff;font-weight:600;}
.cc-banner{background:rgba(16,22,36,0.8);border-radius:12px;border:1px solid rgba(212,168,71,0.2);border-left:3px solid #fabc45;padding:9px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;animation:ccPulse 3s ease-in-out infinite;flex-shrink:0;}
.cc-select{background:#02040a;border:1px solid rgba(212,168,71,0.4);border-radius:7px;color:#fabc45;font-size:11px;padding:4px 9px;outline:none;cursor:pointer;font-family:'DM Sans',sans-serif;}
.cc-commit-btn{background:#fabc45;border:none;border-radius:7px;padding:5px 13px;font-size:11px;font-weight:700;color:#1a1200;cursor:pointer;text-transform:uppercase;letter-spacing:.05em;transition:.15s;}
.cc-commit-btn:hover{filter:brightness(1.1);}
.cc-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
.cc-tab{padding:7px 15px;font-size:12px;color:#8b9ab8;cursor:pointer;border-bottom:2px solid transparent;transition:.2s;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;}
.cc-tab.active{color:#fabc45;border-bottom-color:#fabc45;font-weight:600;}
.cc-metrics{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;}
.cc-metric{background:rgba(16,22,36,0.8);border-radius:10px;padding:9px 6px;border:1px solid rgba(255,255,255,0.07);text-align:center;transition:.2s;}
.cc-metric:hover{border-color:rgba(212,168,71,0.2);}
.cc-chart-row{display:flex;gap:9px;flex:1;min-height:0;}
.cc-chart-box{background:rgba(16,22,36,0.8);border-radius:12px;border:1px solid rgba(255,255,255,0.07);padding:11px;flex:1;display:flex;flex-direction:column;gap:6px;overflow:hidden;}
.cc-bar-row{display:flex;align-items:center;gap:6px;}
.cc-bar-track{flex:1;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;}
.cc-bar-fill{height:100%;border-radius:4px;}
.cc-table-wrap{background:rgba(16,22,36,0.8);border-radius:12px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;flex-shrink:0;}
.cc-table{width:100%;border-collapse:collapse;font-size:11px;}
.cc-table th{padding:7px 10px;color:#4a5568;font-weight:700;text-align:left;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(2,4,10,0.5);font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
.cc-table td{padding:6px 10px;color:#8b9ab8;border-bottom:1px solid rgba(255,255,255,0.04);}
.cc-table tr:last-child td{border-bottom:none;}
.cc-table tr:hover td{background:rgba(255,255,255,0.02);}
.cc-badge{padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700;}
.cc-av{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;margin-right:4px;}
.cc-ps-hero{background:rgba(16,22,36,0.8);border-radius:14px;border:1px solid rgba(212,168,71,0.2);padding:16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.cc-history{background:rgba(16,22,36,0.8);border-radius:14px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;flex:1;display:flex;flex-direction:column;min-height:0;}
.cc-history-hdr{padding:9px 13px;font-size:10px;color:#4a5568;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(2,4,10,0.4);font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
.cc-history-body{overflow-y:auto;flex:1;}
.cc-history-row{display:flex;align-items:center;justify-content:space-between;padding:7px 13px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;gap:8px;}
.cc-history-row:last-child{border-bottom:none;}
.cc-history-row:hover{background:rgba(255,255,255,0.02);}
.cc-empty{padding:28px;text-align:center;font-size:11px;color:#4a5568;line-height:1.8;}
.cc-update-bar{background:rgba(16,22,36,0.8);border-radius:12px;border:1px solid rgba(255,255,255,0.07);padding:9px 13px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
`;

const CommandCenter: React.FC<CommandCenterProps> = ({ currentUser, apiBase }) => {
  const navigate = useNavigate();
  const API = apiBase ?? process.env.REACT_APP_API_URL ?? 'https://roswalt-backend-production.up.railway.app';

  const [activeTab,         setActiveTab]         = useState<'overview' | 'promise'>('overview');
  const [promiseTabVisible, setPromiseTabVisible] = useState(false);
  const [bannerVisible,     setBannerVisible]     = useState(true);
  const [selectedScore,     setSelectedScore]     = useState<number>(0);
  const [updateScore,       setUpdateScore]       = useState<number>(0);
  const [scores,            setScores]            = useState<PromiseScore[]>([]);
  const [loadingScores,     setLoadingScores]     = useState(false);
  const [elapsed,           setElapsed]           = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const timerDisplay = `${padTwo(Math.floor(elapsed / 3600))}:${padTwo(Math.floor((elapsed % 3600) / 60))}:${padTwo(elapsed % 60)}`;

  const loadScores = useCallback(async () => {
    if (!currentUser?._id) return;
    setLoadingScores(true);
    try {
      const res = await fetch(`${API}/api/promise-score/${currentUser._id}`);
      const data: PromiseScore[] = await res.json();
      setScores(data);
      if (data.length > 0) { setPromiseTabVisible(true); setBannerVisible(false); }
    } catch (e) { console.error(e); }
    finally { setLoadingScores(false); }
  }, [API, currentUser?._id]);

  useEffect(() => { loadScores(); }, [loadScores]);

  const saveScore = async (score: number) => {
    if (!currentUser?._id) return;
    const now  = new Date();
    const week = getWeekNumber(now);
    await fetch(`${API}/api/promise-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser._id, week, weekLabel: `Week ${week}`, score, date: now.toISOString(), outcome: 'pending' }),
    });
    await loadScores();
  };

  const markOutcome = async (entry: PromiseScore, outcome: 'met' | 'missed') => {
    await fetch(`${API}/api/promise-score/${entry.userId}/${entry.week}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
    await loadScores();
  };

  const handleCommitBanner = async () => {
    await saveScore(selectedScore);
    setBannerVisible(false);
    setPromiseTabVisible(true);
    setActiveTab('promise');
  };

  const latestScore   = scores.length ? [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null;
  const currentActual = 78;
  const targetScore   = latestScore ? Math.round(currentActual * (1 + latestScore.score / 100)) : null;
  const diff          = targetScore !== null ? currentActual - targetScore : null;
  const nextWeek      = getWeekNumber(new Date()) + 1;
  const userInitials  = currentUser?.name?.slice(0, 2).toUpperCase() ?? 'SC';

  const PARTICIPANTS = [
    { ini: 'JD', bg: 'rgba(31,111,235,0.2)',  c: '#afc6ff', name: 'James D.'  },
    { ini: 'AM', bg: 'rgba(238,152,0,0.2)',   c: '#ffb95f', name: 'Anna M.'   },
    { ini: 'PG', bg: 'rgba(34,197,94,0.2)',   c: '#4ade80', name: 'Pushkaraj' },
    { ini: '+12',bg: 'rgba(99,102,241,0.15)', c: '#a78bfa', name: ''          },
  ];

  const METRICS = [
    { label:'Approved',   value:24,    color:'#4ade80' },
    { label:'Pending',    value:12,    color:'#fbbf24' },
    { label:'Assigned',   value:48,    color:'#60a5fa' },
    { label:'Avg Score',  value:'9.2', color:'#c4b5fd' },
    { label:'Rework',     value:'03',  color:'#fb7185' },
    { label:'In TAT',     value:'94%', color:'#2dd4bf' },
    { label:'Out of TAT', value:'06%', color:'#f87171' },
  ];

  const BARS = [
    { label:'Research',    val:'4.2h', pct:75, color:'#6366f1' },
    { label:'Design Sync', val:'1.8h', pct:40, color:'#8b5cf6' },
    { label:'Dev Review',  val:'5.1h', pct:90, color:'#afc6ff' },
    { label:'Ad Copy',     val:'3.2h', pct:65, color:'#f59e0b' },
    { label:'Floor Plan',  val:'3.6h', pct:72, color:'#f97316' },
  ];

  const TASKS = [
    { task:'Zaiden Reel',      ini:'PG', ic:'#afc6ff', ib:'rgba(31,111,235,0.2)',  name:'Pushkaraj', st:'Approved', sc:'#4ade80', sb:'rgba(34,197,94,0.1)',    score:92, rw:0, dur:'3.5h', tat:'In TAT',  tc:'#4ade80' },
    { task:'Property Ad Copy', ini:'SK', ic:'#fbbf24', ib:'rgba(245,158,11,0.2)', name:'Shreya K.', st:'Pending',  sc:'#fbbf24', sb:'rgba(245,158,11,0.1)',  score:74, rw:1, dur:'2.1h', tat:'In TAT',  tc:'#4ade80' },
    { task:'Floor Plan',       ini:'AM', ic:'#4ade80', ib:'rgba(34,197,94,0.2)',   name:'Aarav M.',  st:'Assigned', sc:'#60a5fa', sb:'rgba(96,165,250,0.1)',  score:0,  rw:0, dur:'4.8h', tat:'Out TAT', tc:'#f87171' },
    { task:'Instagram Reel',   ini:'VN', ic:'#c4b5fd', ib:'rgba(167,139,250,0.2)',name:'Varun N.',  st:'Approved', sc:'#4ade80', sb:'rgba(34,197,94,0.1)',    score:88, rw:2, dur:'5.2h', tat:'Out TAT', tc:'#f87171' },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="cc-root">

        {/* Topbar */}
        <header className="cc-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <button onClick={() => navigate('/supremo')} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#8b9ab8', fontSize:12, padding:'5px 12px', cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>← Back</button>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:30, height:30, borderRadius:7, background:'linear-gradient(135deg,#b8860b,#d4a847,#f0c060)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, color:'#1a1200' }}>SC</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'#f0c060', lineHeight:1 }}>SmartCue</div>
                <div style={{ fontSize:9, color:'#8b9ab8' }}>Command Center</div>
              </div>
            </div>
            <nav style={{ display:'flex', gap:18, marginLeft:6 }}>
              {['Dashboard','Analytics','Team','Settings'].map(item => (
                <span key={item} style={{ fontSize:12, color: item === 'Dashboard' ? '#afc6ff' : '#8b9ab8', fontWeight: item === 'Dashboard' ? 600 : 400, cursor:'pointer' }}>{item}</span>
              ))}
            </nav>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ background:'rgba(10,14,20,0.8)', borderRadius:20, padding:'5px 13px', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontSize:11, color:'#4a5568' }}>🔍</span>
              <input style={{ background:'transparent', border:'none', outline:'none', fontSize:11, color:'#eef2ff', width:150, fontFamily:'DM Sans,sans-serif' }} placeholder="Search Command Center..." />
            </div>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#a5b4fc' }}>{userInitials}</div>
          </div>
        </header>

        <main className="cc-main">

          {/* LEFT: Live Meet */}
          <section className="cc-left">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'ccBlink 1.5s infinite' }} />
                  <span style={{ fontWeight:700, fontSize:13, color:'#eef2ff' }}>Operations Alignment</span>
                </div>
                <div style={{ fontSize:9, color:'#4a5568', textTransform:'uppercase', letterSpacing:'.1em', marginTop:2 }}>Live Feed · Private Channel</div>
              </div>
              <div style={{ background:'rgba(16,22,36,0.8)', padding:'4px 10px', borderRadius:7, border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ fontSize:11 }}>🕐</span>
                <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:600 }}>{timerDisplay}</span>
              </div>
            </div>

            <div className="cc-video-main">
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, opacity:.55 }}>
                <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(31,111,235,0.2)', border:'2px solid rgba(31,111,235,0.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#afc6ff' }}>SJ</div>
                <span style={{ fontSize:10, color:'#8b9ab8' }}>Sarah Jenkins (CEO)</span>
              </div>
              <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', padding:'3px 9px', borderRadius:5, fontSize:10, color:'#eef2ff', border:'1px solid rgba(255,255,255,0.1)' }}>Sarah Jenkins (CEO)</div>
              <div style={{ position:'absolute', top:7, right:7, background:'rgba(31,111,235,0.12)', border:'1px solid rgba(31,111,235,0.25)', borderRadius:4, padding:'2px 6px', fontSize:9, color:'#afc6ff' }}>HD</div>
            </div>

            <div className="cc-thumbs">
              {PARTICIPANTS.map(({ ini, bg, c, name }) => (
                <div key={ini} className="cc-thumb">
                  <div style={{ width:26, height:26, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:c }}>{ini}</div>
                  {name && <span style={{ fontSize:8, color:'#4a5568' }}>{name}</span>}
                </div>
              ))}
            </div>

            <div className="cc-toolbar">
              {['🎙','📹','🖥','👥','💬'].map((icon, i) => (
                <div key={i} className="cc-tb-btn">{icon}</div>
              ))}
              <button style={{ marginLeft:4, background:'#dc2626', border:'none', borderRadius:7, padding:'0 14px', height:30, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>End</button>
            </div>
          </section>

          {/* RIGHT: Analytics */}
          <section className="cc-right">

            <div className="cc-filters">
              <div className="cc-pill">📅 <b>Week {getWeekNumber(new Date())}</b></div>
              <div className="cc-pill">📅 <b>April 2026</b></div>
              <div className="cc-pill">👤 <b>All Users</b> ▾</div>
            </div>

            {bannerVisible && (
              <div className="cc-banner">
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:34, height:34, background:'rgba(153,108,0,0.15)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🎖</div>
                  <span style={{ fontSize:12, color:'#c2c6d6' }}>
                    <span style={{ color:'#fabc45', fontWeight:600 }}>What would be your promise score</span> for the next week?
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <select className="cc-select" value={selectedScore} onChange={e => setSelectedScore(Number(e.target.value))}>
                    {[0,-1,-2,-3,-4,-5].map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                  <button className="cc-commit-btn" onClick={handleCommitBanner}>Commit ✓</button>
                </div>
              </div>
            )}

            <div className="cc-tabs">
              <button className={`cc-tab${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
              {promiseTabVisible && (
                <button className={`cc-tab${activeTab === 'promise' ? ' active' : ''}`} onClick={() => setActiveTab('promise')}>⭐ Promise Score</button>
              )}
              <span style={{ marginLeft:'auto', fontSize:9, color:'#4a5568', alignSelf:'center', fontFamily:'monospace', paddingRight:4 }}>Updated: just now</span>
            </div>

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                <div className="cc-metrics">
                  {METRICS.map(({ label, value, color }) => (
                    <div key={label} className="cc-metric">
                      <div style={{ fontSize:8, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:'#eef2ff', lineHeight:1 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="cc-chart-row">
                  <div className="cc-chart-box" style={{ flex:1.3 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8b9ab8', display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:3, height:10, background:'#afc6ff', borderRadius:2, display:'inline-block' }} />
                      Task Completion Duration
                    </div>
                    {BARS.map(({ label, val, pct, color }) => (
                      <div key={label} className="cc-bar-row">
                        <span style={{ fontSize:9, color:'#4a5568', width:60, textAlign:'right', flexShrink:0 }}>{label}</span>
                        <div className="cc-bar-track"><div className="cc-bar-fill" style={{ width:`${pct}%`, background:color }} /></div>
                        <span style={{ fontSize:9, color:'#8b9ab8', width:26, flexShrink:0 }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="cc-chart-box">
                    <div style={{ fontSize:10, fontWeight:600, color:'#8b9ab8', display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:3, height:10, background:'#fabc45', borderRadius:2, display:'inline-block' }} />
                      In TAT vs Out of TAT
                    </div>
                    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
                      <svg width="84" height="84" viewBox="0 0 90 90">
                        <circle cx="45" cy="45" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
                        <circle cx="45" cy="45" r="32" fill="none" stroke="#2dd4bf" strokeWidth="11" strokeDasharray="120 81" strokeLinecap="round" transform="rotate(-90 45 45)" />
                        <circle cx="45" cy="45" r="32" fill="none" stroke="#f87171" strokeWidth="11" strokeDasharray="81 120" strokeDashoffset="-120" strokeLinecap="round" transform="rotate(-90 45 45)" />
                        <text x="45" y="41" textAnchor="middle" fill="#eef2ff" fontSize="13" fontWeight="700">94%</text>
                        <text x="45" y="53" textAnchor="middle" fill="#8b9ab8" fontSize="7">In TAT</text>
                      </svg>
                      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                        {[{ c:'#2dd4bf', l:'On Schedule' }, { c:'#f87171', l:'Delayed' }].map(({ c, l }) => (
                          <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#8b9ab8' }}>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }} />{l}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cc-table-wrap">
                  <div style={{ padding:'9px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:600, fontSize:12, color:'#eef2ff' }}>Recent Active Tasks</span>
                    <span style={{ fontSize:11, color:'#6366f1', cursor:'pointer', fontWeight:600 }}>View All</span>
                  </div>
                  <table className="cc-table">
                    <thead>
                      <tr>{['Task','Assigned','Status','Score','Rework','Dur.','TAT'].map(h => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {TASKS.map(row => (
                        <tr key={row.task}>
                          <td style={{ color:'#eef2ff', fontWeight:500 }}>{row.task}</td>
                          <td>
                            <span className="cc-av" style={{ width:17, height:17, background:row.ib, color:row.ic }}>{row.ini}</span>
                            {row.name}
                          </td>
                          <td><span className="cc-badge" style={{ background:row.sb, color:row.sc, border:`1px solid ${row.sc}33` }}>{row.st}</span></td>
                          <td style={{ color: row.score > 0 ? '#4ade80' : '#4a5568', fontFamily:'monospace' }}>{row.score > 0 ? row.score : '—'}</td>
                          <td>{row.rw}</td>
                          <td>{row.dur}</td>
                          <td style={{ color:row.tc, fontWeight:600 }}>{row.tat}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* PROMISE SCORE */}
            {activeTab === 'promise' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1, overflow:'hidden' }}>
                {latestScore && (
                  <div className="cc-ps-hero">
                    <div>
                      <div style={{ fontSize:9, color:'#4a5568', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Latest Commitment</div>
                      <div style={{ fontSize:42, fontWeight:800, color:'#fabc45', lineHeight:1 }}>{latestScore.score}%</div>
                      <div style={{ fontSize:10, color:'#8b9ab8', marginTop:4 }}>Committed {formatDate(latestScore.date)} — {latestScore.weekLabel}</div>
                      {diff !== null && (
                        <div style={{ marginTop:7, display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:7, background: diff >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(244,63,94,0.1)', fontSize:10, color: diff >= 0 ? '#4ade80' : '#fb7185', border:`1px solid ${diff >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(244,63,94,0.25)'}` }}>
                          {diff >= 0 ? `↑ ${diff} pts above threshold` : `↓ ${Math.abs(diff)} pts below threshold`}
                        </div>
                      )}
                    </div>
                    <svg width="96" height="96" viewBox="0 0 90 90">
                      <path d="M15 75 A40 40 0 1 1 75 75" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" strokeLinecap="round" />
                      <path d="M15 75 A40 40 0 1 1 75 75" fill="none" stroke="#fabc45" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${Math.round(((latestScore.score + 5) / 5) * 158)} 200`} />
                      <text x="45" y="55" textAnchor="middle" fill="#fabc45" fontSize="14" fontWeight="700">{currentActual}</text>
                      <text x="45" y="67" textAnchor="middle" fill="#8b9ab8" fontSize="7">Current</text>
                    </svg>
                  </div>
                )}

                <div className="cc-history">
                  <div className="cc-history-hdr">
                    <span>Committed Promise Scores — All Weeks</span>
                    <span style={{ color:'#6366f1', fontFamily:'monospace' }}>{scores.length} entries</span>
                  </div>
                  <div className="cc-history-body">
                    {loadingScores ? (
                      <div className="cc-empty">Loading history…</div>
                    ) : scores.length === 0 ? (
                      <div className="cc-empty">No promise scores committed yet.<br />Use the banner above to commit your first score.</div>
                    ) : (
                      [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                        <div key={`${entry.week}-${entry.date}`} className="cc-history-row">
                          <span style={{ color:'#eef2ff', fontWeight:500, width:56 }}>{entry.weekLabel}</span>
                          <span style={{ color:'#4a5568', flex:1, fontSize:10 }}>{formatDate(entry.date)}</span>
                          <span style={{ color:'#fabc45', fontWeight:700, width:30, textAlign:'center' }}>{entry.score}%</span>
                          <span className="cc-badge" style={{
                            background: entry.outcome==='met' ? 'rgba(34,197,94,0.1)' : entry.outcome==='missed' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)',
                            color:      entry.outcome==='met' ? '#4ade80' : entry.outcome==='missed' ? '#fb7185' : '#fbbf24',
                            border:    `1px solid ${entry.outcome==='met' ? 'rgba(34,197,94,0.25)' : entry.outcome==='missed' ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                          }}>{entry.outcome}</span>
                          {entry.outcome === 'pending' && (
                            <div style={{ display:'flex', gap:4, marginLeft:4 }}>
                              <button onClick={() => markOutcome(entry,'met')}    style={{ padding:'2px 6px', fontSize:9, background:'rgba(34,197,94,0.1)',  color:'#4ade80', border:'1px solid rgba(34,197,94,0.2)',  borderRadius:4, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Met</button>
                              <button onClick={() => markOutcome(entry,'missed')} style={{ padding:'2px 6px', fontSize:9, background:'rgba(244,63,94,0.1)', color:'#fb7185', border:'1px solid rgba(244,63,94,0.2)', borderRadius:4, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Missed</button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="cc-update-bar">
                  <div>
                    <div style={{ fontSize:11, color:'#eef2ff', fontWeight:500 }}>Commit promise score</div>
                    <div style={{ fontSize:9, color:'#4a5568', marginTop:2 }}>For <span style={{ color:'#fabc45' }}>Week {nextWeek}</span></div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <select className="cc-select" value={updateScore} onChange={e => setUpdateScore(Number(e.target.value))}>
                      {[0,-1,-2,-3,-4,-5].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                    <button className="cc-commit-btn" onClick={() => saveScore(updateScore)}>Commit ✓</button>
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
