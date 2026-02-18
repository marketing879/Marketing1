import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useUser } from "../contexts/UserContext";
import ClaudeChat from "./ClaudeChat";

type Tab = "overview" | "approvals" | "users" | "addUser" | "ai";

// ── Hardcoded default passwords — keep in sync with UserContext defaultUsers ──
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

const SADashboard: React.FC = () => {
  const {
    tasks = [],
    teamMembers = [],
    addUser,
    superadminReviewTask,
    logout,
    user,
  } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [mounted, setMounted] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "staff",
    password: "",
  });
  const [successMsg, setSuccessMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  const pendingApprovals = tasks.filter(
    (t) => t.approvalStatus === "admin-approved"
  );
  const fullyApproved = tasks.filter(
    (t) => t.approvalStatus === "superadmin-approved"
  );
  const inReview = tasks.filter((t) => t.approvalStatus === "in-review");
  const rejected = tasks.filter((t) => t.approvalStatus === "rejected");

  const handleApprove = (taskId: string) => {
    superadminReviewTask(taskId, true, "Approved by Superadmin");
    showSuccess("Task fully approved ✓");
  };

  const handleReject = (taskId: string) => {
    superadminReviewTask(taskId, false, "Rejected by Superadmin");
    showSuccess("Task rejected");
  };

  const handleAddUser = () => {
    if (
      !newUser.name.trim() ||
      !newUser.email.trim() ||
      !newUser.password.trim()
    )
      return;
    const result = addUser(newUser as any);
    if (result.success) {
      setNewUser({ name: "", email: "", role: "staff", password: "" });
      showSuccess("User added successfully ✓");
    } else {
      showSuccess(`⚠ ${result.message}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const getStaffName = (email: string) => {
    const m = teamMembers.find((t) => t.email === email);
    return m ? m.name : email;
  };

  // ── Export credentials to .xlsx ──────────────────────────────────────────
  const handleExportCredentials = () => {
    setExporting(true);

    const sorted = [...teamMembers].sort(
      (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
    );

    const rows = sorted.map((member, idx) => ({
      "#": String(idx + 1),
      "Full Name": member.name,
      Email: member.email,
      Role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
      "OTP / Password": DEFAULT_PASSWORDS[member.email.toLowerCase()] ?? "—",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["#", "Full Name", "Email", "Role", "OTP / Password"],
    });

    ws["!cols"] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 36 },
      { wch: 14 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "User Credentials");
    XLSX.writeFile(
      wb,
      `Roswalt_Credentials_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    setExporting(false);
    showSuccess("Credentials exported ✓");
  };

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: "overview", label: "Overview", icon: "◈" },
    {
      id: "approvals",
      label: "Approvals",
      icon: "✦",
      count: pendingApprovals.length,
    },
    { id: "users", label: "Users", icon: "◆", count: teamMembers.length },
    { id: "addUser", label: "Add User", icon: "+" },
    { id: "ai", label: "Claude AI", icon: "✦" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sa { min-height: 100vh; background: #080810; color: #e8ddd0; font-family: 'DM Sans', sans-serif; display: flex; }
        .sa-sidebar { width: 260px; min-height: 100vh; background: rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; padding: 32px 20px; position: sticky; top: 0; height: 100vh; backdrop-filter: blur(20px); }
        .sa-logo { margin-bottom: 48px; padding: 0 8px; }
        .sa-logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, rgba(201,169,110,0.25), rgba(201,169,110,0.08)); border: 1px solid rgba(201,169,110,0.3); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 14px; }
        .sa-logo-name { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; letter-spacing: 0.06em; color: #f0e6d3; }
        .sa-logo-role { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(201,169,110,0.5); margin-top: 2px; }
        .sa-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .sa-nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; background: transparent; border: none; cursor: pointer; color: rgba(255,255,255,0.3); font-size: 13px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.04em; transition: all 0.2s ease; text-align: left; width: 100%; position: relative; }
        .sa-nav-item:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); }
        .sa-nav-item.active { background: rgba(201,169,110,0.1); color: #c9a96e; border: 1px solid rgba(201,169,110,0.2); }
        .sa-nav-icon { font-size: 15px; width: 20px; text-align: center; }
        .sa-nav-badge { margin-left: auto; min-width: 20px; height: 20px; background: linear-gradient(135deg, #c9a96e, #a07840); border-radius: 10px; font-size: 10px; font-weight: 600; color: #080810; display: flex; align-items: center; justify-content: center; padding: 0 6px; }
        .sa-user-card { margin-top: 24px; padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .sa-user-name { font-size: 13px; color: rgba(255,255,255,0.7); margin-bottom: 2px; }
        .sa-user-email { font-size: 11px; color: rgba(255,255,255,0.25); margin-bottom: 12px; }
        .sa-export-btn { width: 100%; margin-bottom: 8px; padding: 10px; background: linear-gradient(135deg, rgba(22,163,74,0.15), rgba(22,163,74,0.08)); border: 1px solid rgba(22,163,74,0.25); border-radius: 8px; color: #86efac; font-size: 12px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .sa-export-btn:hover { background: rgba(22,163,74,0.22); border-color: rgba(22,163,74,0.4); transform: translateY(-1px); }
        .sa-export-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .sa-logout { width: 100%; padding: 10px; background: rgba(220,60,60,0.08); border: 1px solid rgba(220,60,60,0.15); border-radius: 8px; color: #e87070; font-size: 12px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; }
        .sa-logout:hover { background: rgba(220,60,60,0.14); border-color: rgba(220,60,60,0.25); }
        .sa-main { flex: 1; padding: 40px 48px; overflow-y: auto; transition: opacity 0.6s ease; }
        .sa-page-header { margin-bottom: 40px; }
        .sa-page-title { font-family: 'Cormorant Garamond', serif; font-size: 40px; font-weight: 300; letter-spacing: 0.03em; color: #f0e6d3; line-height: 1.1; margin-bottom: 6px; }
        .sa-page-title em { font-style: italic; color: #c9a96e; }
        .sa-page-sub { font-size: 13px; color: rgba(255,255,255,0.25); font-weight: 300; }
        .sa-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 40px; }
        .sa-stat { padding: 24px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; transition: all 0.25s ease; }
        .sa-stat:hover { border-color: rgba(201,169,110,0.2); background: rgba(201,169,110,0.04); }
        .sa-stat-icon { font-size: 20px; margin-bottom: 14px; }
        .sa-stat-num { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 300; color: #f0e6d3; line-height: 1; margin-bottom: 6px; }
        .sa-stat-label { font-size: 11px; color: rgba(255,255,255,0.25); letter-spacing: 0.12em; text-transform: uppercase; }
        .sa-toast { position: fixed; top: 24px; right: 24px; z-index: 999; padding: 14px 20px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; color: #6ee7b7; font-size: 13px; transition: all 0.3s ease; pointer-events: none; }
        .sa-toast.visible { opacity: 1; transform: translateY(0); }
        .sa-toast.hidden { opacity: 0; transform: translateY(-10px); }
        .sa-section-title { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 400; color: #f0e6d3; margin-bottom: 20px; letter-spacing: 0.03em; }
        .sa-task-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; margin-bottom: 14px; transition: all 0.25s ease; }
        .sa-task-card:hover { border-color: rgba(201,169,110,0.2); background: rgba(201,169,110,0.03); }
        .sa-task-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
        .sa-task-title { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 400; color: #f0e6d3; margin-bottom: 6px; }
        .sa-task-desc { font-size: 13px; color: rgba(255,255,255,0.3); line-height: 1.5; }
        .sa-task-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
        .sa-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
        .sa-badge-gold { background: rgba(201,169,110,0.12); color: #c9a96e; border: 1px solid rgba(201,169,110,0.2); }
        .sa-badge-green { background: rgba(16,185,129,0.1); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
        .sa-badge-red { background: rgba(220,60,60,0.1); color: #e87070; border: 1px solid rgba(220,60,60,0.2); }
        .sa-badge-blue { background: rgba(96,165,250,0.1); color: #93c5fd; border: 1px solid rgba(96,165,250,0.2); }
        .sa-task-actions { display: flex; gap: 10px; flex-shrink: 0; }
        .sa-btn-approve { padding: 10px 20px; background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.08)); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: #6ee7b7; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; }
        .sa-btn-approve:hover { background: rgba(16,185,129,0.2); border-color: rgba(16,185,129,0.5); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(16,185,129,0.15); }
        .sa-btn-reject { padding: 10px 20px; background: rgba(220,60,60,0.08); border: 1px solid rgba(220,60,60,0.2); border-radius: 8px; color: #e87070; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; }
        .sa-btn-reject:hover { background: rgba(220,60,60,0.14); border-color: rgba(220,60,60,0.4); transform: translateY(-1px); }
        .sa-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); margin: 32px 0; }
        .sa-table-wrap { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; }
        .sa-table { width: 100%; border-collapse: collapse; }
        .sa-th { padding: 14px 20px; text-align: left; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 500; }
        .sa-td { padding: 16px 20px; font-size: 13px; color: rgba(255,255,255,0.55); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .sa-tr:last-child .sa-td { border-bottom: none; }
        .sa-tr:hover .sa-td { background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.75); }
        .sa-form { max-width: 520px; }
        .sa-field { margin-bottom: 20px; }
        .sa-field-label { display: block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 8px; font-weight: 500; }
        .sa-field-input { width: 100%; padding: 13px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #f0e6d3; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: all 0.25s ease; }
        .sa-field-input::placeholder { color: rgba(255,255,255,0.15); }
        .sa-field-input:focus { border-color: rgba(201,169,110,0.4); background: rgba(201,169,110,0.04); box-shadow: 0 0 0 3px rgba(201,169,110,0.07); }
        .sa-btn-submit { padding: 14px 32px; background: linear-gradient(135deg, #c9a96e, #a07840); border: none; border-radius: 10px; color: #080810; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.3s ease; }
        .sa-btn-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,169,110,0.25); }
        .sa-btn-submit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .sa-empty { text-align: center; padding: 56px 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; }
        .sa-empty-icon { font-size: 40px; margin-bottom: 16px; opacity: 0.4; }
        .sa-empty-text { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 300; color: rgba(255,255,255,0.3); }
        .sa-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; background: radial-gradient(ellipse 60% 50% at 10% 20%, rgba(201,169,110,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(96,165,250,0.05) 0%, transparent 60%); }
        .sa-export-banner { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: linear-gradient(135deg, rgba(22,163,74,0.08), rgba(22,163,74,0.04)); border: 1px solid rgba(22,163,74,0.2); border-radius: 14px; margin-bottom: 28px; }
        .sa-export-banner-text { font-size: 13px; color: rgba(255,255,255,0.4); }
        .sa-export-banner-title { font-family: 'Cormorant Garamond', serif; font-size: 18px; color: #86efac; margin-bottom: 4px; }
        .sa-export-main-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, rgba(22,163,74,0.2), rgba(22,163,74,0.1)); border: 1px solid rgba(22,163,74,0.35); border-radius: 10px; color: #86efac; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0; }
        .sa-export-main-btn:hover { background: rgba(22,163,74,0.28); border-color: rgba(22,163,74,0.5); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(22,163,74,0.2); }
        .sa-export-main-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>

      <div className="sa-bg" />

      <div className="sa" style={{ position: "relative", zIndex: 1 }}>
        {/* SIDEBAR */}
        <aside className="sa-sidebar">
          <div className="sa-logo">
            <div className="sa-logo-icon">📋</div>
            <div className="sa-logo-name">TaskFlow</div>
            <div className="sa-logo-role">Superadmin Console</div>
          </div>

          <nav className="sa-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`sa-nav-item ${
                  activeTab === tab.id ? "active" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sa-nav-icon">{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="sa-nav-badge">{tab.count}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="sa-user-card">
            <div className="sa-user-name">{user?.name || "Superadmin"}</div>
            <div className="sa-user-email">{user?.email || ""}</div>

            {/* ── Export button visible only to superadmin ── */}
            {user?.role === "superadmin" && (
              <button
                className="sa-export-btn"
                onClick={handleExportCredentials}
                disabled={exporting}
                title="Download all user credentials as Excel"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                </svg>
                {exporting ? "Exporting…" : "Export Credentials"}
              </button>
            )}

            <button className="sa-logout" onClick={handleLogout}>
              ⎋ Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="sa-main" style={{ opacity: mounted ? 1 : 0 }}>
          <div className={`sa-toast ${successMsg ? "visible" : "hidden"}`}>
            {successMsg}
          </div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <div className="sa-page-header">
                <div className="sa-page-title">
                  Command <em>Centre</em>
                </div>
                <div className="sa-page-sub">
                  Full visibility across tasks, approvals and team members
                </div>
              </div>
              <div className="sa-stats">
                {[
                  {
                    icon: "⏳",
                    num: pendingApprovals.length,
                    label: "Pending Approval",
                  },
                  {
                    icon: "✦",
                    num: fullyApproved.length,
                    label: "Fully Approved",
                  },
                  { icon: "◈", num: inReview.length, label: "Under Review" },
                  { icon: "◆", num: teamMembers.length, label: "Team Members" },
                ].map((s, i) => (
                  <div className="sa-stat" key={i}>
                    <div className="sa-stat-icon">{s.icon}</div>
                    <div className="sa-stat-num">{s.num}</div>
                    <div className="sa-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="sa-section-title">All Tasks ({tasks.length})</div>
              {tasks.length === 0 ? (
                <div className="sa-empty">
                  <div className="sa-empty-icon">◈</div>
                  <div className="sa-empty-text">No tasks yet</div>
                </div>
              ) : (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th className="sa-th">Title</th>
                        <th className="sa-th">Assigned To</th>
                        <th className="sa-th">Status</th>
                        <th className="sa-th">Approval</th>
                        <th className="sa-th">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr className="sa-tr" key={task.id}>
                          <td className="sa-td" style={{ color: "#f0e6d3" }}>
                            {task.title}
                          </td>
                          <td className="sa-td">
                            {getStaffName(task.assignedTo)}
                          </td>
                          <td className="sa-td">{task.status}</td>
                          <td className="sa-td">
                            <span
                              className={`sa-badge ${
                                task.approvalStatus === "superadmin-approved"
                                  ? "sa-badge-green"
                                  : task.approvalStatus === "admin-approved"
                                  ? "sa-badge-gold"
                                  : task.approvalStatus === "rejected"
                                  ? "sa-badge-red"
                                  : "sa-badge-blue"
                              }`}
                            >
                              {task.approvalStatus}
                            </span>
                          </td>
                          <td className="sa-td">
                            {task.createdAt
                              ? new Date(task.createdAt).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* APPROVALS */}
          {activeTab === "approvals" && (
            <>
              <div className="sa-page-header">
                <div className="sa-page-title">
                  Final <em>Approvals</em>
                </div>
                <div className="sa-page-sub">
                  Tasks approved by admin — awaiting your sign-off
                </div>
              </div>
              {pendingApprovals.length === 0 ? (
                <div className="sa-empty">
                  <div className="sa-empty-icon">✦</div>
                  <div className="sa-empty-text">
                    All tasks reviewed — nothing pending
                  </div>
                </div>
              ) : (
                pendingApprovals.map((task) => (
                  <div className="sa-task-card" key={task.id}>
                    <div className="sa-task-top">
                      <div style={{ flex: 1 }}>
                        <div className="sa-task-title">{task.title}</div>
                        <div className="sa-task-desc">{task.description}</div>
                      </div>
                      <div className="sa-task-actions">
                        <button
                          className="sa-btn-approve"
                          onClick={() => handleApprove(task.id)}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="sa-btn-reject"
                          onClick={() => handleReject(task.id)}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                    <div className="sa-task-meta">
                      <span className="sa-badge sa-badge-gold">
                        Admin Approved
                      </span>
                      {task.priority && (
                        <span className="sa-badge sa-badge-blue">
                          {task.priority} priority
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.2)",
                      }}
                    >
                      Assigned to: {getStaffName(task.assignedTo)}
                      {task.adminReviewedBy &&
                        ` · Admin reviewed by ${task.adminReviewedBy}`}
                    </div>
                    {task.completionNotes && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px 14px",
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.4)",
                          borderLeft: "2px solid rgba(201,169,110,0.3)",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(201,169,110,0.7)",
                            fontWeight: 500,
                          }}
                        >
                          Staff notes:{" "}
                        </span>
                        {task.completionNotes}
                      </div>
                    )}
                    {task.adminComments && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "12px 14px",
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.4)",
                          borderLeft: "2px solid rgba(96,165,250,0.3)",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(96,165,250,0.7)",
                            fontWeight: 500,
                          }}
                        >
                          Admin comments:{" "}
                        </span>
                        {task.adminComments}
                      </div>
                    )}
                  </div>
                ))
              )}
              {fullyApproved.length > 0 && (
                <>
                  <div className="sa-divider" />
                  <div
                    className="sa-section-title"
                    style={{ fontSize: "18px", color: "rgba(255,255,255,0.4)" }}
                  >
                    Previously Approved ({fullyApproved.length})
                  </div>
                  {fullyApproved.map((task) => (
                    <div
                      className="sa-task-card"
                      key={task.id}
                      style={{ opacity: 0.6 }}
                    >
                      <div
                        className="sa-task-title"
                        style={{ fontSize: "17px" }}
                      >
                        {task.title}
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span className="sa-badge sa-badge-green">
                          ✓ Fully Approved
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <>
              <div
                className="sa-page-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div className="sa-page-title">
                    Team <em>Members</em>
                  </div>
                  <div className="sa-page-sub">
                    {teamMembers.length} members across all roles
                  </div>
                </div>
              </div>

              {/* ── Export banner in Users tab ── */}
              {user?.role === "superadmin" && (
                <div className="sa-export-banner">
                  <div>
                    <div className="sa-export-banner-title">
                      📥 Export Credentials
                    </div>
                    <div className="sa-export-banner-text">
                      Download all usernames and OTP passwords as an Excel file
                    </div>
                  </div>
                  <button
                    className="sa-export-main-btn"
                    onClick={handleExportCredentials}
                    disabled={exporting}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="8" y1="13" x2="16" y2="13" />
                      <line x1="8" y1="17" x2="16" y2="17" />
                    </svg>
                    {exporting ? "Exporting…" : "Download .xlsx"}
                  </button>
                </div>
              )}

              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th className="sa-th">Name</th>
                      <th className="sa-th">Email</th>
                      <th className="sa-th">Role</th>
                      <th className="sa-th">OTP / Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...teamMembers]
                      .sort(
                        (a, b) =>
                          (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
                      )
                      .map((member) => (
                        <tr className="sa-tr" key={member.id}>
                          <td className="sa-td" style={{ color: "#f0e6d3" }}>
                            {member.name}
                          </td>
                          <td className="sa-td">{member.email}</td>
                          <td className="sa-td">
                            <span
                              className={`sa-badge ${
                                member.role === "superadmin"
                                  ? "sa-badge-gold"
                                  : member.role === "admin"
                                  ? "sa-badge-blue"
                                  : "sa-badge-green"
                              }`}
                              style={{ textTransform: "capitalize" }}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td
                            className="sa-td"
                            style={{
                              fontFamily: "monospace",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {user?.role === "superadmin"
                              ? DEFAULT_PASSWORDS[member.email.toLowerCase()] ??
                                "—"
                              : "••••••"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADD USER */}
          {activeTab === "addUser" && (
            <>
              <div className="sa-page-header">
                <div className="sa-page-title">
                  Add <em>Member</em>
                </div>
                <div className="sa-page-sub">
                  Onboard a new team member to the workspace
                </div>
              </div>
              <div className="sa-form">
                <div className="sa-field">
                  <label className="sa-field-label">Full Name</label>
                  <input
                    className="sa-field-input"
                    placeholder="e.g. Arjun Mehta"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                  />
                </div>
                <div className="sa-field">
                  <label className="sa-field-label">Email Address</label>
                  <input
                    className="sa-field-input"
                    type="email"
                    placeholder="arjun@roswalt.com"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                  />
                </div>
                <div className="sa-field">
                  <label className="sa-field-label">Password</label>
                  <input
                    className="sa-field-input"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                  />
                </div>
                <div className="sa-field">
                  <label className="sa-field-label">Access Role</label>
                  <select
                    className="sa-field-input"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value })
                    }
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button
                  className="sa-btn-submit"
                  onClick={handleAddUser}
                  disabled={
                    !newUser.name.trim() ||
                    !newUser.email.trim() ||
                    !newUser.password.trim()
                  }
                >
                  Add Member →
                </button>
              </div>
            </>
          )}

          {/* CLAUDE AI */}
          {activeTab === "ai" && (
            <>
              <div className="sa-page-header">
                <div className="sa-page-title">
                  Claude <em>AI</em>
                </div>
                <div className="sa-page-sub">
                  Your AI assistant for workspace management
                </div>
              </div>
              <div style={{ height: "calc(100vh - 220px)" }}>
                <ClaudeChat theme="amber" />
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default SADashboard;
