import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Task } from "../contexts/UserContext";
import { Eye, Upload } from "lucide-react";
import ClaudeChat from "./ClaudeChat";

const StaffDashboard: React.FC = () => {
  const {
    getAssignedTasks,
    submitTaskCompletion,
    logout,
    user,
    getProjectById,
  } = useUser();
  const navigate = useNavigate();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "completed" | "ai">(
    "pending"
  );
  const [uploadedPhotos, setUploadedPhotos] = useState<{
    [taskId: string]: string[];
  }>({});
  const [dragOver, setDragOver] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const assignedTasks = getAssignedTasks();
  const pendingTasks = assignedTasks.filter(
    (t) =>
      t.approvalStatus !== "superadmin-approved" &&
      t.approvalStatus !== "in-review" &&
      t.approvalStatus !== "admin-approved"
  );
  const inReviewTasks = assignedTasks.filter(
    (t) =>
      t.approvalStatus === "in-review" || t.approvalStatus === "admin-approved"
  );
  const completedTasks = assignedTasks.filter(
    (t) => t.approvalStatus === "superadmin-approved"
  );
  const submittedTasks = [...inReviewTasks, ...completedTasks];

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleMarkComplete = () => {
    if (!selectedTask) return;
    if (!completionNotes.trim()) {
      showSuccess("⚠ Please add completion notes before submitting.");
      return;
    }
    submitTaskCompletion(selectedTask.id, completionNotes);
    showSuccess("Task submitted for review ✓");
    setSelectedTask(null);
    setCompletionNotes("");
    setShowCompletionForm(false);
  };

  const getProjectName = (projectId: string) => {
    try {
      return getProjectById(projectId)?.name || "—";
    } catch {
      return "—";
    }
  };

  const handlePhotoUpload = (taskId: string, files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setUploadedPhotos((prev) => ({
          ...prev,
          [taskId]: [...(prev[taskId] || []), url],
        }));
      };
      reader.readAsDataURL(file);
    });
    showSuccess("Photo uploaded ✓");
  };

  const removePhoto = (taskId: string, index: number) => {
    setUploadedPhotos((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .sd { min-height: 100vh; background: #080810; color: #e8ddd0; font-family: 'DM Sans', sans-serif; display: flex; }
        .sd-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; background: radial-gradient(ellipse 55% 45% at 5% 15%, rgba(102,126,234,0.1) 0%, transparent 60%), radial-gradient(ellipse 45% 40% at 95% 85%, rgba(118,75,162,0.1) 0%, transparent 60%), radial-gradient(ellipse 35% 35% at 50% 50%, rgba(201,169,110,0.04) 0%, transparent 60%); }
        .sd-sidebar { width: 260px; min-height: 100vh; background: rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; padding: 32px 20px; position: sticky; top: 0; height: 100vh; }
        .sd-avatar-wrap { text-align: center; margin-bottom: 36px; }
        .sd-avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, rgba(102,126,234,0.3), rgba(118,75,162,0.2)); border: 2px solid rgba(102,126,234,0.3); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 14px; position: relative; overflow: hidden; cursor: pointer; transition: all 0.25s ease; }
        .sd-avatar:hover { border-color: rgba(102,126,234,0.6); transform: scale(1.05); }
        .sd-avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; font-size: 11px; color: white; letter-spacing: 0.08em; text-transform: uppercase; }
        .sd-avatar:hover .sd-avatar-overlay { opacity: 1; }
        .sd-user-name { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 400; color: #f0e6d3; margin-bottom: 3px; }
        .sd-user-role { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(102,126,234,0.6); }
        .sd-user-email { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 3px; }
        .sd-mini-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 28px; }
        .sd-mini-stat { padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; text-align: center; }
        .sd-mini-stat-num { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; color: #f0e6d3; }
        .sd-mini-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.2); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px; }
        .sd-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .sd-nav-item { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; background: transparent; border: none; cursor: pointer; color: rgba(255,255,255,0.28); font-size: 13px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.04em; transition: all 0.2s ease; text-align: left; width: 100%; }
        .sd-nav-item:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55); }
        .sd-nav-item.active { background: rgba(102,126,234,0.1); color: #a5b4fc; border: 1px solid rgba(102,126,234,0.2); }
        .sd-nav-badge { margin-left: auto; min-width: 20px; height: 20px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 10px; font-size: 10px; color: white; display: flex; align-items: center; justify-content: center; padding: 0 6px; }
        .sd-logout { width: 100%; margin-top: 16px; padding: 11px; background: rgba(220,60,60,0.07); border: 1px solid rgba(220,60,60,0.15); border-radius: 8px; color: #e87070; font-size: 12px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .sd-logout:hover { background: rgba(220,60,60,0.13); }
        .sd-main { flex: 1; padding: 40px 48px; overflow-y: auto; opacity: 0; transition: opacity 0.6s ease; }
        .sd-main.mounted { opacity: 1; }
        .sd-page-header { margin-bottom: 36px; }
        .sd-page-title { font-family: 'Cormorant Garamond', serif; font-size: 40px; font-weight: 300; color: #f0e6d3; line-height: 1.1; margin-bottom: 6px; }
        .sd-page-title em { font-style: italic; color: #a5b4fc; }
        .sd-page-sub { font-size: 13px; color: rgba(255,255,255,0.22); }
        .sd-toast { position: fixed; top: 24px; right: 24px; z-index: 999; padding: 13px 20px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; color: #6ee7b7; font-size: 13px; transition: all 0.3s ease; pointer-events: none; }
        .sd-toast.visible { opacity: 1; transform: translateY(0); }
        .sd-toast.hidden { opacity: 0; transform: translateY(-8px); }
        .sd-task { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; margin-bottom: 16px; transition: all 0.25s ease; }
        .sd-task:hover { border-color: rgba(102,126,234,0.25); background: rgba(102,126,234,0.04); }
        .sd-task-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
        .sd-task-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 400; color: #f0e6d3; margin-bottom: 6px; }
        .sd-task-desc { font-size: 13px; color: rgba(255,255,255,0.3); line-height: 1.55; }
        .sd-task-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
        .badge-blue { background: rgba(96,165,250,0.1); color: #93c5fd; border: 1px solid rgba(96,165,250,0.2); }
        .badge-amber { background: rgba(251,191,36,0.1); color: #fcd34d; border: 1px solid rgba(251,191,36,0.2); }
        .badge-green { background: rgba(16,185,129,0.1); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
        .badge-red { background: rgba(220,60,60,0.1); color: #e87070; border: 1px solid rgba(220,60,60,0.2); }
        .badge-purple { background: rgba(167,139,250,0.1); color: #c4b5fd; border: 1px solid rgba(167,139,250,0.2); }
        .sd-task-footer { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .sd-task-dates { font-size: 12px; color: rgba(255,255,255,0.2); display: flex; gap: 20px; }
        .sd-btn-complete { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.1)); border: 1px solid rgba(102,126,234,0.3); border-radius: 8px; color: #a5b4fc; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0; }
        .sd-btn-complete:hover { background: rgba(102,126,234,0.22); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(102,126,234,0.2); }
        .sd-note { margin-top: 12px; padding: 12px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
        .sd-note-purple { background: rgba(167,139,250,0.07); border-left: 2px solid rgba(167,139,250,0.4); color: rgba(255,255,255,0.45); }
        .sd-note-cyan { background: rgba(34,211,238,0.07); border-left: 2px solid rgba(34,211,238,0.4); color: rgba(255,255,255,0.45); }
        .sd-note-red { background: rgba(220,60,60,0.07); border-left: 2px solid rgba(220,60,60,0.4); color: rgba(255,255,255,0.45); }
        .sd-note-label { font-weight: 500; margin-bottom: 4px; }
        .sd-photos { margin-top: 14px; }
        .sd-photo-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
        .sd-photo-thumb { width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); position: relative; cursor: pointer; }
        .sd-photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .sd-photo-remove { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; background: rgba(0,0,0,0.7); border: none; border-radius: 50%; color: white; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
        .sd-photo-thumb:hover .sd-photo-remove { opacity: 1; }
        .sd-drop-zone { border: 1px dashed rgba(102,126,234,0.3); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s ease; background: rgba(102,126,234,0.03); }
        .sd-drop-zone:hover, .sd-drop-zone.drag-over { border-color: rgba(102,126,234,0.6); background: rgba(102,126,234,0.07); }
        .sd-drop-icon { font-size: 20px; margin-bottom: 6px; color: rgba(102,126,234,0.5); }
        .sd-drop-text { font-size: 12px; color: rgba(255,255,255,0.25); }
        .sd-drop-text span { color: #a5b4fc; }
        .sd-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .sd-modal { background: #0e0e1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px; max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 40px 80px rgba(0,0,0,0.6); }
        .sd-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; }
        .sd-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 400; color: #f0e6d3; line-height: 1.2; }
        .sd-modal-close { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; width: 32px; height: 32px; color: rgba(255,255,255,0.4); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; transition: all 0.2s; }
        .sd-modal-close:hover { background: rgba(255,255,255,0.1); color: white; }
        .sd-modal-info { padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 20px; }
        .sd-modal-info p { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
        .sd-modal-info p:last-child { margin-bottom: 0; }
        .sd-modal-info strong { color: rgba(255,255,255,0.65); }
        .sd-field { margin-bottom: 18px; }
        .sd-field-label { display: block; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 8px; font-weight: 500; }
        .sd-textarea { width: 100%; padding: 13px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #f0e6d3; font-size: 14px; font-family: 'DM Sans', sans-serif; min-height: 110px; resize: vertical; outline: none; transition: all 0.25s ease; }
        .sd-textarea:focus { border-color: rgba(102,126,234,0.4); background: rgba(102,126,234,0.04); box-shadow: 0 0 0 3px rgba(102,126,234,0.07); }
        .sd-textarea::placeholder { color: rgba(255,255,255,0.14); }
        .sd-modal-btns { display: flex; gap: 10px; margin-top: 4px; }
        .sd-btn-submit { flex: 1; padding: 14px; background: linear-gradient(135deg, #667eea, #764ba2); border: none; border-radius: 10px; color: white; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.3s; }
        .sd-btn-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(102,126,234,0.3); }
        .sd-btn-cancel { padding: 14px 24px; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: rgba(255,255,255,0.3); font-size: 12px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .sd-btn-cancel:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }
        .sd-empty { text-align: center; padding: 64px 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; }
        .sd-empty-icon { font-size: 44px; margin-bottom: 16px; opacity: 0.3; }
        .sd-empty-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 300; color: rgba(255,255,255,0.3); margin-bottom: 8px; }
        .sd-empty-sub { font-size: 13px; color: rgba(255,255,255,0.15); }
        .sd-status-msg { font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
        @media (max-width: 768px) { .sd-sidebar { display: none; } .sd-main { padding: 24px; } }
      `}</style>

      <div className="sd-bg" />
      <div className="sd" style={{ position: "relative", zIndex: 1 }}>
        {/* SIDEBAR */}
        <aside className="sd-sidebar">
          <div className="sd-avatar-wrap">
            <div className="sd-avatar">
              {user?.name ? (
                <span style={{ fontSize: "28px" }}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                "👤"
              )}
              <div className="sd-avatar-overlay">Change</div>
            </div>
            <div className="sd-user-name">{user?.name || "Staff Member"}</div>
            <div className="sd-user-role">Staff</div>
            <div className="sd-user-email">{user?.email || ""}</div>
          </div>

          <div className="sd-mini-stats">
            <div className="sd-mini-stat">
              <div className="sd-mini-stat-num">{pendingTasks.length}</div>
              <div className="sd-mini-stat-lbl">Pending</div>
            </div>
            <div className="sd-mini-stat">
              <div className="sd-mini-stat-num">{submittedTasks.length}</div>
              <div className="sd-mini-stat-lbl">Submitted</div>
            </div>
          </div>

          <nav className="sd-nav">
            <button
              className={`sd-nav-item ${
                activeTab === "pending" ? "active" : ""
              }`}
              onClick={() => setActiveTab("pending")}
            >
              <span>◈</span> My Tasks
              {pendingTasks.length > 0 && (
                <span className="sd-nav-badge">{pendingTasks.length}</span>
              )}
            </button>
            <button
              className={`sd-nav-item ${
                activeTab === "completed" ? "active" : ""
              }`}
              onClick={() => setActiveTab("completed")}
            >
              <span>✦</span> Submitted
              {submittedTasks.length > 0 && (
                <span className="sd-nav-badge">{submittedTasks.length}</span>
              )}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <span>✦</span> Claude AI
            </button>
          </nav>

          <button className="sd-logout" onClick={handleLogout}>
            ⎋ Sign Out
          </button>
        </aside>

        {/* MAIN */}
        <main className={`sd-main ${mounted ? "mounted" : ""}`}>
          <div className={`sd-toast ${successMsg ? "visible" : "hidden"}`}>
            {successMsg}
          </div>

          <div className="sd-page-header">
            <div className="sd-page-title">
              {activeTab === "pending" ? (
                <>
                  <em>My</em> Tasks
                </>
              ) : activeTab === "completed" ? (
                <>
                  Submitted <em>Work</em>
                </>
              ) : (
                <>
                  <em>Claude</em> AI
                </>
              )}
            </div>
            <div className="sd-page-sub">
              {activeTab === "pending"
                ? `${pendingTasks.length} task${
                    pendingTasks.length !== 1 ? "s" : ""
                  } awaiting your attention`
                : activeTab === "completed"
                ? `${submittedTasks.length} task${
                    submittedTasks.length !== 1 ? "s" : ""
                  } in the review pipeline`
                : "Your AI assistant powered by Claude"}
            </div>
          </div>

          {activeTab === "pending" && (
            <>
              {pendingTasks.length === 0 ? (
                <div className="sd-empty">
                  <div className="sd-empty-icon">✨</div>
                  <div className="sd-empty-title">All caught up!</div>
                  <div className="sd-empty-sub">
                    No tasks assigned to you right now.
                  </div>
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    photos={uploadedPhotos[task.id] || []}
                    getProjectName={getProjectName}
                    onComplete={() => {
                      setSelectedTask(task);
                      setShowCompletionForm(true);
                    }}
                    onUpload={(files) => handlePhotoUpload(task.id, files)}
                    onRemovePhoto={(i) => removePhoto(task.id, i)}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                  />
                ))
              )}
            </>
          )}

          {activeTab === "completed" && (
            <>
              {submittedTasks.length === 0 ? (
                <div className="sd-empty">
                  <div className="sd-empty-icon">◈</div>
                  <div className="sd-empty-title">Nothing submitted yet</div>
                  <div className="sd-empty-sub">
                    Submit your first task to see it here.
                  </div>
                </div>
              ) : (
                submittedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    photos={uploadedPhotos[task.id] || []}
                    getProjectName={getProjectName}
                    onComplete={() => {}}
                    onUpload={(files) => handlePhotoUpload(task.id, files)}
                    onRemovePhoto={(i) => removePhoto(task.id, i)}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    isCompleted
                  />
                ))
              )}
            </>
          )}

          {activeTab === "ai" && (
            <div style={{ height: "calc(100vh - 200px)" }}>
              <ClaudeChat theme="dark" />
            </div>
          )}
        </main>
      </div>

      {/* COMPLETION MODAL */}
      {showCompletionForm && selectedTask && (
        <div
          className="sd-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCompletionForm(false);
              setSelectedTask(null);
              setCompletionNotes("");
            }
          }}
        >
          <div className="sd-modal">
            <div className="sd-modal-header">
              <div className="sd-modal-title">Submit: {selectedTask.title}</div>
              <button
                className="sd-modal-close"
                onClick={() => {
                  setShowCompletionForm(false);
                  setSelectedTask(null);
                  setCompletionNotes("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="sd-modal-info">
              <p>
                <strong>Priority:</strong>{" "}
                {selectedTask.priority?.toUpperCase()}
              </p>
              <p>
                <strong>Due:</strong>{" "}
                {new Date(selectedTask.dueDate).toLocaleDateString()}
              </p>
              <p>
                <strong>Description:</strong> {selectedTask.description}
              </p>
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Completion Notes *</label>
              <textarea
                className="sd-textarea"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Describe what you completed, any challenges, and current status…"
              />
            </div>
            <div className="sd-field">
              <label className="sd-field-label">Attach Photos (optional)</label>
              {(uploadedPhotos[selectedTask.id] || []).length > 0 && (
                <div className="sd-photo-grid" style={{ marginBottom: "10px" }}>
                  {(uploadedPhotos[selectedTask.id] || []).map((url, i) => (
                    <div className="sd-photo-thumb" key={i}>
                      <img src={url} alt={`upload-${i}`} />
                      <button
                        className="sd-photo-remove"
                        onClick={() => removePhoto(selectedTask.id, i)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="sd-drop-zone"
                onClick={() =>
                  document
                    .getElementById(`modal-upload-${selectedTask.id}`)
                    ?.click()
                }
              >
                <div className="sd-drop-icon">📎</div>
                <div className="sd-drop-text">
                  Click to upload · <span>Browse files</span>
                </div>
              </div>
              <input
                id={`modal-upload-${selectedTask.id}`}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) =>
                  handlePhotoUpload(selectedTask.id, e.target.files)
                }
              />
            </div>
            <div className="sd-modal-btns">
              <button className="sd-btn-submit" onClick={handleMarkComplete}>
                Submit for Review →
              </button>
              <button
                className="sd-btn-cancel"
                onClick={() => {
                  setShowCompletionForm(false);
                  setSelectedTask(null);
                  setCompletionNotes("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface TaskCardProps {
  task: Task;
  photos: string[];
  getProjectName: (id: string) => string;
  onComplete: () => void;
  onUpload: (files: FileList | null) => void;
  onRemovePhoto: (i: number) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  isCompleted?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  photos,
  getProjectName,
  onComplete,
  onUpload,
  onRemovePhoto,
  dragOver,
  setDragOver,
  isCompleted,
}) => {
  const approvalMap: Record<string, { label: string; cls: string }> = {
    assigned: { label: "Assigned", cls: "badge-blue" },
    "in-review": { label: "Pending Review", cls: "badge-amber" },
    "admin-approved": { label: "Admin Approved", cls: "badge-blue" },
    "superadmin-approved": { label: "Fully Approved", cls: "badge-green" },
    rejected: { label: "Rejected", cls: "badge-red" },
  };
  const approval = approvalMap[task.approvalStatus] ?? approvalMap.assigned;
  const priorityCls =
    task.priority === "high"
      ? "badge-red"
      : task.priority === "low"
      ? "badge-green"
      : "badge-amber";
  const statusMessages: Record<string, { text: string; color: string }> = {
    assigned: { text: "→ Ready to submit", color: "#a5b4fc" },
    "in-review": { text: "⏳ Waiting for admin review…", color: "#fcd34d" },
    "admin-approved": {
      text: "✓ Admin approved · awaiting superadmin…",
      color: "#93c5fd",
    },
    "superadmin-approved": { text: "✓✓ Fully Approved!", color: "#6ee7b7" },
    rejected: { text: "↩ Please resubmit with improvements", color: "#e87070" },
  };
  const statusMsg = statusMessages[task.approvalStatus];

  return (
    <div className="sd-task">
      <div className="sd-task-top">
        <div style={{ flex: 1 }}>
          <div className="sd-task-title">{task.title}</div>
          <div className="sd-task-desc">{task.description}</div>
        </div>
        {!isCompleted &&
          (task.approvalStatus === "assigned" ||
            task.approvalStatus === "rejected") && (
            <button className="sd-btn-complete" onClick={onComplete}>
              <Eye size={14} /> Submit
            </button>
          )}
      </div>
      <div className="sd-task-meta">
        <span className={`badge ${priorityCls}`}>{task.priority} priority</span>
        <span className={`badge ${approval.cls}`}>{approval.label}</span>
        {task.projectId && (
          <span className="badge badge-purple">
            {getProjectName(task.projectId)}
          </span>
        )}
      </div>
      {task.approvalStatus === "rejected" && task.adminComments && (
        <div className="sd-note sd-note-red">
          <div className="sd-note-label" style={{ color: "#e87070" }}>
            ⚠ Rejection reason
          </div>
          {task.adminComments}
        </div>
      )}
      {task.completionNotes && (
        <div className="sd-note sd-note-purple">
          <div className="sd-note-label" style={{ color: "#c4b5fd" }}>
            Your notes
          </div>
          {task.completionNotes}
        </div>
      )}
      {task.adminReviewedBy &&
        task.adminComments &&
        task.approvalStatus !== "rejected" && (
          <div className="sd-note sd-note-cyan">
            <div className="sd-note-label" style={{ color: "#67e8f9" }}>
              Admin · {task.adminReviewedBy}
            </div>
            {task.adminComments}
          </div>
        )}
      <div className="sd-photos" style={{ marginTop: "14px" }}>
        {photos.length > 0 && (
          <div className="sd-photo-grid">
            {photos.map((url, i) => (
              <div className="sd-photo-thumb" key={i}>
                <img src={url} alt={`photo-${i}`} />
                <button
                  className="sd-photo-remove"
                  onClick={() => onRemovePhoto(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          className={`sd-drop-zone ${dragOver ? "drag-over" : ""}`}
          onClick={() => document.getElementById(`upload-${task.id}`)?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onUpload(e.dataTransfer.files);
          }}
        >
          <div className="sd-drop-icon">
            <Upload size={18} />
          </div>
          <div className="sd-drop-text">
            Drop photos here · <span>browse</span>
          </div>
        </div>
        <input
          id={`upload-${task.id}`}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onUpload(e.target.files)}
        />
      </div>
      <div className="sd-task-footer">
        <div className="sd-task-dates">
          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
          {task.createdAt && (
            <span>
              Created: {new Date(task.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {statusMsg && (
          <div className="sd-status-msg" style={{ color: statusMsg.color }}>
            {statusMsg.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
