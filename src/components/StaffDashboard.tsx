import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Task } from "../contexts/UserContext";
import { Eye, Upload, CheckCircle, AlertCircle, Loader, Shield, User, X, Camera } from "lucide-react";
import ClaudeChat from "./ClaudeChat";

// ── Role badge helpers ───────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  supremo:    "Supremo",
  admin:      "Admin",
  staff:      "Staff",
};

const ROLE_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  superadmin: { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
  supremo:    { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
  admin:      { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
  staff:      { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
};

const StaffDashboard: React.FC = () => {
  const {
    getAssignedTasks,
    submitTaskCompletion,
    logout,
    user,
    getProjectById,
    teamMembers,
    updateTask,
  } = useUser();
  const navigate = useNavigate();

  const [selectedTask,        setSelectedTask]        = useState<Task | null>(null);
  const [completionNotes,     setCompletionNotes]     = useState("");
  const [showCompletionForm,  setShowCompletionForm]  = useState(false);
  const [mounted,             setMounted]             = useState(false);
  const [activeTab,           setActiveTab]           = useState<"pending" | "history" | "ai">("pending");
  const [activeFilter,        setActiveFilter]        = useState<string | null>(null);
  const [uploadedPhotos,      setUploadedPhotos]      = useState<{ [taskId: string]: string[] }>({});
  const [dragOver,            setDragOver]            = useState(false);
  const [successMsg,          setSuccessMsg]          = useState("");
  const [reviewingTask,       setReviewingTask]       = useState<string | null>(null);
  const [reviewResults,       setReviewResults]       = useState<{ [taskId: string]: ReviewResult }>({});
  const [expandedReviewPanel, setExpandedReviewPanel] = useState<string | null>(null);
  const [draftingTask,        setDraftingTask]        = useState<string | null>(null);
  const [draftedNotes,        setDraftedNotes]        = useState<{ [taskId: string]: string }>({});

  // Profile pic
  const [profilePic, setProfilePic] = useState<string | null>(() => {
    try { return localStorage.getItem("sd_profile_pic"); } catch { return null; }
  });
  const profileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [showLightbox,   setShowLightbox]   = useState(false);

  const assignedTasks  = getAssignedTasks();
  const pendingTasks   = assignedTasks.filter(
    (t) =>
      t.approvalStatus !== "superadmin-approved" &&
      t.approvalStatus !== "in-review" &&
      t.approvalStatus !== "admin-approved"
  );
  const inReviewTasks  = assignedTasks.filter(
    (t) => t.approvalStatus === "in-review" || t.approvalStatus === "admin-approved"
  );
  const completedTasks  = assignedTasks.filter((t) => t.approvalStatus === "superadmin-approved");
  const submittedTasks  = [...inReviewTasks, ...completedTasks];

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
      if (e.key === "ArrowRight") setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1));
      if (e.key === "ArrowLeft")  setLightboxIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhotos.length]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProfilePic(url);
      try { localStorage.setItem("sd_profile_pic", url); } catch {}
      showSuccess("Profile photo updated ✓");
    };
    reader.readAsDataURL(file);
  };

  const getAssignerInfo = (assignedBy?: string) => {
    if (!assignedBy) return null;
    const member = teamMembers?.find((m) => m.email === assignedBy);
    return member ?? { name: assignedBy, role: "admin", email: assignedBy };
  };

  const openLightbox = (photos: string[], index = 0) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const draftCompletionNotes = async (taskId: string) => {
    if (!completionNotes.trim()) {
      showSuccess("⚠ Please write some notes first to draft from");
      return;
    }
    setDraftingTask(taskId);
    try {
      const response = await fetch("http://localhost:5000/api/draft-notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ taskId, notes: completionNotes }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        showSuccess(`✕ Error: ${errorData.message || "Unknown error"}`);
        return;
      }
      const data = await response.json();
      const improvedNotes = data.improvedNotes || completionNotes;
      setDraftedNotes((prev) => ({ ...prev, [taskId]: improvedNotes }));
      setCompletionNotes(improvedNotes);
      showSuccess("✓ Notes improved by AI!");
    } catch (error) {
      showSuccess("✕ Error improving notes. Please try again.");
    } finally {
      setDraftingTask(null);
    }
  };

  const reviewAttachments = async (taskId: string) => {
    const photos = uploadedPhotos[taskId] || [];
    if (photos.length === 0) { showSuccess("⚠ No attachments to review"); return; }
    setReviewingTask(taskId);
    try {
      const contentArray: any[] = [
        {
          type: "text",
          text: `You are a professional document reviewer and grammar expert. Analyze the following images for ANY text content and check for: 1. Grammatical errors (spelling, punctuation, syntax) 2. Clarity and readability issues 3. Professional presentation 4. Format consistency  For EACH image analyzed, provide: - Image status: "CLEAN" (no errors), "MINOR" (minor issues that don't block submission), or "ERROR" (critical issues preventing submission) - Found issues (list all errors, if any) - Recommendations  Return your response ONLY as a valid JSON array: [   {"image": 1, "status": "CLEAN|MINOR|ERROR", "issues": ["issue1"], "recommendations": "text"},   {"image": 2, "status": "CLEAN|MINOR|ERROR", "issues": [], "recommendations": "text"} ]`,
        },
      ];

      for (const photo of photos) {
        let base64Data = photo, mediaType = "image/jpeg";
        if (photo.startsWith("data:")) {
          const matches = photo.match(/data:([^;]+);base64,(.+)/);
          if (matches) { mediaType = matches[1]; base64Data = matches[2]; }
        }
        contentArray.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
      }

      const response = await fetch("http://localhost:5000/api/review-attachments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ taskId, contentArray }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        showSuccess(`✕ Error: ${errorData.message || "Unknown error"}`);
        return;
      }
      const data = await response.json();
      setReviewResults((prev) => ({
        ...prev,
        [taskId]: { results: data.results || [], hasErrors: data.hasErrors || false, timestamp: new Date().toISOString() },
      }));
      showSuccess(data.hasErrors ? "⚠ Review complete: Critical errors found." : "✓ Review complete: All attachments clear!");
    } catch (error) {
      showSuccess("✕ Error reviewing attachments. Please try again.");
    } finally {
      setReviewingTask(null);
    }
  };

  const handleMarkComplete = () => {
    if (!selectedTask) return;
    const review = reviewResults[selectedTask.id];
    if (review && review.hasErrors) { showSuccess("⚠ Cannot submit: Fix the critical errors in attachments."); return; }
    if (!completionNotes.trim())    { showSuccess("⚠ Please add completion notes before submitting.");        return; }

    updateTask?.(selectedTask.id, {
      title:           selectedTask.title,
      description:     selectedTask.description,
      status:          selectedTask.status,
      priority:        selectedTask.priority,
      dueDate:         selectedTask.dueDate,
      assignedTo:      selectedTask.assignedTo,
      projectId:       selectedTask.projectId,
      completionNotes: completionNotes,
      attachments:     uploadedPhotos[selectedTask.id] || [],
    } as any);

    submitTaskCompletion(selectedTask.id, completionNotes);
    showSuccess("Task submitted for review ✓");
    setSelectedTask(null);
    setCompletionNotes("");
    setShowCompletionForm(false);
  };

  const getProjectName = (projectId: string) => {
    try { return getProjectById(projectId)?.name || "—"; }
    catch { return "—"; }
  };

  const handlePhotoUpload = (taskId: string, files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setUploadedPhotos((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), url] }));
      };
      reader.readAsDataURL(file);
    });
    showSuccess("Photo uploaded ✓");
  };

  const removePhoto = (taskId: string, index: number) => {
    setUploadedPhotos((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((_, i) => i !== index) }));
    setReviewResults((prev) => { const u = { ...prev }; delete u[taskId]; return u; });
  };

  const getDisplayedTasks = () => {
    if (activeTab === "history") return submittedTasks;
    if (activeFilter === "all") return assignedTasks;
    if (activeFilter === "active") return pendingTasks;
    if (activeFilter === "inreview") return inReviewTasks;
    if (activeFilter === "approved") return completedTasks;
    return pendingTasks;
  };

  const displayedTasks = getDisplayedTasks();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --c:  #00d4ff;
          --c2: #7b2fff;
          --c3: #ff6b35;
          --cy: #f5c518;
          --cg: #00ff88;
          --cr: #ff3366;
          --cp: #b06af3;
          --bg:  #06070d;
          --bg1: #0b0d16;
          --bg2: #0f1120;
          --bg3: #141728;
          --border: rgba(255,255,255,0.055);
          --border2: rgba(255,255,255,0.1);
          --t1: #eef0ff;
          --t2: #7e84a3;
          --t3: #434763;
        }

        body { background: var(--bg); font-family: 'Inter', sans-serif; }

        /* ══ SCROLLBAR STYLING ══ */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(15,17,32,0.5);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(126,132,163,0.4);
          border-radius: 10px;
          transition: background 0.2s;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(126,132,163,0.7);
        }

        /* Firefox scrollbar */
        * {
          scrollbar-color: rgba(126,132,163,0.5) rgba(15,17,32,0.3);
          scrollbar-width: thin;
        }

        /* ══ ROOT — column layout so navbar is on top ══ */
        .sd-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
          color: var(--t1);
          background: var(--bg);
        }

        /* ══ TOP NAVBAR ══ */
        .sd-sidebar {
          width: 100%;
          height: 60px;
          min-height: 60px;
          background: var(--bg1);
          border-bottom: 1px solid var(--border2);
          display: flex;
          align-items: center;
          padding: 0 22px;
          gap: 0;
          position: sticky;
          top: 0;
          z-index: 50;
          flex-direction: row;
          overflow: visible;
        }

        /* Logo */
        .sd-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-right: 32px;
          flex-shrink: 0;
        }
        .sd-logo-mark {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--c2), var(--c));
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 900; color: white; letter-spacing: -0.5px;
          box-shadow: 0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(123,47,255,0.2);
          flex-shrink: 0;
        }
        .sd-logo-text {
          font-size: 13px; font-weight: 700; color: var(--t1);
          font-family: 'Space Grotesk', sans-serif; white-space: nowrap;
          letter-spacing: -0.2px;
        }

        /* Nav tabs */
        .sd-nav { display: flex; align-items: center; gap: 2px; }
        .sd-nav-section { display: none; }
        .sd-nav-item {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 15px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          color: var(--t2);
          font-size: 12px; font-weight: 500;
          transition: all 0.15s;
          font-family: 'Inter', sans-serif;
          white-space: nowrap; position: relative;
        }
        .sd-nav-item:hover { color: var(--t1); background: rgba(255,255,255,0.04); }
        .sd-nav-item.active {
          color: var(--c);
          background: rgba(0,212,255,0.07);
          border-color: rgba(0,212,255,0.18);
        }
        .sd-nav-icon { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sd-nav-badge {
          min-width: 17px; height: 17px;
          background: linear-gradient(135deg, var(--cr), #ff6b35);
          border-radius: 9px; font-size: 9px; color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; padding: 0 4px;
          box-shadow: 0 0 10px rgba(255,51,102,0.5);
          animation: badgePulse 2.5s ease-in-out infinite;
        }
        @keyframes badgePulse { 0%,100%{box-shadow:0 0 8px rgba(255,51,102,0.5)} 50%{box-shadow:0 0 16px rgba(255,51,102,0.9)} }

        /* Right side of navbar — user info */
        .sd-avatar-wrap { margin-left: auto; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .sd-avatar-row { display: flex; align-items: center; gap: 9px; }
        .sd-avatar-ring { position: relative; width: 34px; height: 34px; cursor: pointer; flex-shrink: 0; }
        .sd-avatar {
          width: 100%; height: 100%; border-radius: 50%;
          background: linear-gradient(135deg, var(--c2), var(--c));
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; border: 2px solid rgba(0,212,255,0.4);
          box-shadow: 0 0 12px rgba(0,212,255,0.25);
        }
        .sd-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .sd-avatar-camera {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .sd-avatar-ring:hover .sd-avatar-camera { opacity: 1; }
        .sd-user-info { display: flex; flex-direction: column; }
        .sd-user-name { font-size: 12px; font-weight: 600; color: var(--t1); line-height: 1.2; }
        .sd-user-email { font-size: 10px; color: var(--t3); }
        .sd-role-pill {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 1px 6px; border-radius: 3px;
          background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.22);
          font-size: 8px; font-weight: 800; color: var(--c);
          text-transform: uppercase; letter-spacing: 0.6px;
          margin-top: 2px; width: fit-content;
        }

        .sd-divider { display: none; }
        .sd-mini-stats { display: none; }

        .sd-logout {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          background: transparent;
          border: 1px solid var(--border2);
          border-radius: 8px; color: var(--t3);
          cursor: pointer; transition: all 0.15s;
          font-family: 'Inter', sans-serif; flex-shrink: 0;
        }
        .sd-logout > span { display: none; }
        .sd-logout:hover { background: rgba(255,51,102,0.1); border-color: rgba(255,51,102,0.3); color: var(--cr); }

        /* ══ MAIN CONTENT ══ */
        .sd-main {
          flex: 1;
          padding: 28px 28px 48px;
          overflow-y: auto;
          background: var(--bg);
          min-height: calc(100vh - 60px);
        }

        /* Page header */
        .sd-page-header { margin-bottom: 24px; }
        .sd-page-eyebrow { display: none; }
        .sd-page-title {
          font-size: 30px; font-weight: 800; letter-spacing: -1px;
          font-family: 'Space Grotesk', sans-serif;
          color: var(--t1); margin-bottom: 4px; line-height: 1.1;
        }
        .sd-page-title em { color: var(--c); font-style: italic; }
        .sd-page-sub {
          font-size: 10px; color: var(--t3); text-transform: uppercase;
          letter-spacing: 1.8px; font-weight: 600;
        }

        /* ══ NEON STAT CARDS ══ */
        .sd-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 14px;
          margin-bottom: 28px;
        }
        .sd-stat-card {
          background: var(--bg2);
          border-radius: 14px;
          padding: 20px 22px 18px;
          border: 1px solid var(--border);
          position: relative;
          overflow: hidden;
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s, background 0.18s;
          cursor: pointer;
        }
        .sd-stat-card::after {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 100px; height: 100px;
          border-radius: 50%;
          background: var(--glow, rgba(0,212,255,0.12));
          filter: blur(25px);
          pointer-events: none;
        }
        .sd-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.5); border-color: rgba(0,212,255,0.3); }
        .sd-stat-card.active {
          border-color: rgba(0,212,255,0.5);
          box-shadow: 0 0 30px rgba(0,212,255,0.2);
          background: rgba(0,212,255,0.04);
        }
        .sd-stat-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .sd-stat-label {
          font-size: 9px; font-weight: 700; color: var(--t3);
          text-transform: uppercase; letter-spacing: 1.2px;
        }
        .sd-stat-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--dot, var(--c));
          box-shadow: 0 0 10px var(--dot, var(--c)), 0 0 20px var(--dot, var(--c));
          animation: dotGlow 2s ease-in-out infinite;
        }
        @keyframes dotGlow { 0%,100%{opacity:0.7} 50%{opacity:1} }
        .sd-stat-value {
          font-size: 44px; font-weight: 900;
          color: var(--val, var(--c));
          line-height: 1; letter-spacing: -2px;
          font-family: 'Space Grotesk', sans-serif;
          margin-bottom: 8px;
          text-shadow: 0 0 30px var(--val, rgba(0,212,255,0.4));
        }
        .sd-stat-sub { font-size: 11px; color: var(--t3); font-weight: 500; }
        .sd-stat-bar {
          margin-top: 14px; height: 2px;
          background: rgba(255,255,255,0.05);
          border-radius: 2px; overflow: hidden;
        }
        .sd-stat-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--val, var(--c)), var(--c2));
          border-radius: 2px;
          box-shadow: 0 0 8px var(--val, var(--c));
          transition: width 1s ease;
        }

        /* ══ TOAST ══ */
        .sd-toast {
          position: fixed; top: 70px; right: 20px; z-index: 999;
          padding: 10px 16px;
          background: var(--bg2);
          border: 1px solid rgba(0,212,255,0.3);
          border-radius: 8px; color: var(--c);
          font-size: 12px; font-weight: 600;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,212,255,0.1);
          transition: all 0.22s ease; pointer-events: none;
        }
        .sd-toast.visible { opacity: 1; transform: translateY(0); }
        .sd-toast.hidden  { opacity: 0; transform: translateY(-10px); }

        /* ══ TASK GRID ══ */
        .sd-task-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        /* ══ TASK CARDS ══ */
        .sd-task {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 12px;
          transition: border-color 0.18s, box-shadow 0.18s;
          position: relative;
          overflow: hidden;
          max-height: 360px;
          overflow-y: auto;
        }
        .sd-task::before {
          content: '';
          position: absolute;
          left: 0; top: 18px; bottom: 18px;
          width: 3px; background: transparent;
          border-radius: 0 2px 2px 0;
          transition: all 0.22s;
        }
        .sd-task:hover {
          border-color: rgba(0,212,255,0.18);
          box-shadow: 0 0 0 1px rgba(0,212,255,0.05), 0 8px 32px rgba(0,0,0,0.4);
        }
        .sd-task:hover::before {
          background: linear-gradient(180deg, var(--c), var(--c2));
          box-shadow: 0 0 14px var(--c);
        }

        .sd-task-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 12px; min-height: auto; }
        .sd-task-title { font-size: 14px; font-weight: 600; color: var(--t1); margin-bottom: 5px; letter-spacing: -0.1px; word-break: break-word; }
        .sd-task-desc { font-size: 12px; color: var(--t2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-wrap: break-word; }
        .sd-task-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

        /* Badges */
        .badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase; border: 1px solid; letter-spacing: 0.3px; }
        .badge-blue   { background: rgba(0,212,255,0.08);  color: var(--c);  border-color: rgba(0,212,255,0.22); }
        .badge-amber  { background: rgba(245,197,24,0.08); color: var(--cy); border-color: rgba(245,197,24,0.22); }
        .badge-green  { background: rgba(0,255,136,0.08);  color: var(--cg); border-color: rgba(0,255,136,0.22); }
        .badge-red    { background: rgba(255,51,102,0.08); color: var(--cr); border-color: rgba(255,51,102,0.22); }
        .badge-purple { background: rgba(176,106,243,0.08);color: var(--cp); border-color: rgba(176,106,243,0.22); }

        .sd-assigner-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 500; margin-bottom: 8px; border: 1px solid; word-wrap: break-word; }

        .sd-task-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .sd-task-dates { font-size: 10px; color: var(--t3); display: flex; gap: 10px; font-variant-numeric: tabular-nums; }
        .sd-status-msg { font-size: 10px; font-weight: 700; }

        /* Submit button */
        .sd-btn-complete {
          display: flex; align-items: center; gap: 6px; padding: 8px 16px;
          background: linear-gradient(135deg, var(--c2), var(--c));
          border: none; border-radius: 8px; color: white;
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          cursor: pointer; transition: all 0.18s; letter-spacing: 0.5px;
          font-family: 'Inter', sans-serif; flex-shrink: 0;
          box-shadow: 0 0 20px rgba(0,212,255,0.22), 0 0 40px rgba(123,47,255,0.15);
        }
        .sd-btn-complete:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 24px rgba(0,212,255,0.4); }

        /* Notes */
        .sd-note { margin-top: 10px; padding: 11px 13px; border-radius: 8px; font-size: 12px; line-height: 1.4; border-left: 3px solid; word-wrap: break-word; word-break: break-word; max-height: 80px; overflow-y: auto; }
        .sd-note-purple { background: rgba(0,212,255,0.06); border-left-color: var(--c);  color: var(--t2); }
        .sd-note-cyan   { background: rgba(0,255,136,0.06); border-left-color: var(--cg); color: var(--t2); }
        .sd-note-red    { background: rgba(255,51,102,0.06);border-left-color: var(--cr); color: var(--t2); }
        .sd-note-label { font-weight: 700; margin-bottom: 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; }

        /* Photos */
        .sd-photos { margin-top: 10px; }
        .sd-photo-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .sd-photo-thumb {
          width: 64px; height: 64px; border-radius: 9px; overflow: hidden;
          border: 1px solid var(--border); position: relative; cursor: pointer;
          transition: all 0.18s; background: var(--bg3);
        }
        .sd-photo-thumb:hover { border-color: rgba(0,212,255,0.4); transform: scale(1.04); box-shadow: 0 0 14px rgba(0,212,255,0.25); }
        .sd-photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .sd-photo-remove {
          position: absolute; top: 4px; right: 4px; width: 16px; height: 16px;
          background: var(--cr); border: none; border-radius: 4px; color: white;
          font-size: 8px; cursor: pointer; opacity: 0; transition: opacity 0.18s;
          display: flex; align-items: center; justify-content: center; font-weight: 700;
        }
        .sd-photo-thumb:hover .sd-photo-remove { opacity: 1; }
        .sd-photo-expand {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.18s; font-size: 16px;
        }
        .sd-photo-thumb:hover .sd-photo-expand { opacity: 1; }

        /* Attachments */
        .sd-att-strip { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
        .sd-att-thumb { width: 54px; height: 54px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); cursor: pointer; transition: all 0.18s; }
        .sd-att-thumb:hover { border-color: rgba(0,212,255,0.35); transform: scale(1.06); }
        .sd-att-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .sd-att-label { font-size: 10px; color: var(--t3); text-transform: uppercase; margin-bottom: 6px; font-weight: 700; letter-spacing: 0.5px; }

        /* Drop zone */
        .sd-drop-zone {
          border: 1px dashed rgba(0,212,255,0.2); border-radius: 9px;
          padding: 14px 16px; text-align: center; cursor: pointer;
          transition: all 0.18s; background: rgba(0,212,255,0.02);
        }
        .sd-drop-zone:hover { border-color: rgba(0,212,255,0.45); background: rgba(0,212,255,0.06); }
        .sd-drop-icon { font-size: 14px; margin-bottom: 5px; }
        .sd-drop-text { font-size: 11px; color: var(--t3); }
        .sd-drop-text span { color: var(--c); font-weight: 700; }

        /* ══ MODAL ══ */
        .sd-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.87);
          z-index: 100; display: flex; align-items: center; justify-content: center;
          padding: 20px; backdrop-filter: blur(12px);
        }
        .sd-modal {
          background: var(--bg2); border: 1px solid rgba(0,212,255,0.15);
          border-radius: 16px; padding: 24px; max-width: 560px; width: 100%;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.06);
        }
        .sd-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 14px; }
        .sd-modal-title { font-size: 17px; font-weight: 700; color: var(--t1); letter-spacing: -0.3px; font-family: 'Space Grotesk', sans-serif; }
        .sd-modal-close {
          background: var(--bg3); border: 1px solid var(--border2); border-radius: 7px;
          width: 28px; height: 28px; color: var(--t3); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.18s; flex-shrink: 0; font-size: 11px;
        }
        .sd-modal-close:hover { background: rgba(255,51,102,0.1); color: var(--cr); border-color: rgba(255,51,102,0.3); }

        .sd-modal-info {
          padding: 12px 14px; background: var(--bg3); border: 1px solid var(--border);
          border-radius: 9px; margin-bottom: 16px; font-size: 12px; color: var(--t2);
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
        }
        .sd-modal-info p { display: flex; align-items: baseline; gap: 4px; }
        .sd-modal-info strong { color: var(--t1); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

        .sd-field { margin-bottom: 16px; }
        .sd-field-label { display: block; font-size: 10px; text-transform: uppercase; color: var(--t3); margin-bottom: 7px; font-weight: 700; letter-spacing: 0.8px; }
        .sd-textarea {
          width: 100%; padding: 11px 13px; background: var(--bg3); border: 1px solid var(--border);
          border-radius: 8px; color: var(--t1); font-size: 13px; font-family: 'Inter', sans-serif;
          min-height: 110px; resize: vertical; outline: none; transition: all 0.18s; line-height: 1.6;
        }
        .sd-textarea:focus { border-color: rgba(0,212,255,0.35); background: rgba(0,212,255,0.03); box-shadow: 0 0 0 3px rgba(0,212,255,0.07); }
        .sd-textarea::placeholder { color: var(--t3); }

        .sd-modal-btns { display: flex; gap: 8px; margin-top: 16px; }
        .sd-btn-submit {
          flex: 1; padding: 11px;
          background: linear-gradient(135deg, var(--c2), var(--c));
          border: none; border-radius: 8px; color: white; font-size: 12px; font-weight: 700;
          text-transform: uppercase; cursor: pointer; transition: all 0.18s; letter-spacing: 0.5px;
          font-family: 'Inter', sans-serif; box-shadow: 0 0 20px rgba(0,212,255,0.2);
        }
        .sd-btn-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 24px rgba(0,212,255,0.35); }
        .sd-btn-submit:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }

        .sd-btn-cancel {
          padding: 11px 16px; background: transparent; border: 1px solid var(--border2);
          border-radius: 8px; color: var(--t2); font-size: 12px; text-transform: uppercase;
          cursor: pointer; transition: all 0.18s; font-weight: 600; letter-spacing: 0.5px;
          font-family: 'Inter', sans-serif;
        }
        .sd-btn-cancel:hover { border-color: rgba(255,255,255,0.18); color: var(--t1); }

        /* AI buttons */
        .sd-btn-review {
          display: flex; align-items: center; gap: 5px; padding: 7px 12px;
          background: rgba(0,212,255,0.07); border: 1px solid rgba(0,212,255,0.2);
          border-radius: 7px; color: var(--c); font-size: 10px; font-weight: 700;
          text-transform: uppercase; cursor: pointer; transition: all 0.18s;
          letter-spacing: 0.4px; font-family: 'Inter', sans-serif;
        }
        .sd-btn-review:hover:not(:disabled) { background: rgba(0,212,255,0.14); }
        .sd-btn-review:disabled { opacity: 0.5; cursor: not-allowed; }

        .sd-btn-draft {
          display: flex; align-items: center; gap: 5px; padding: 7px 12px;
          background: rgba(176,106,243,0.07); border: 1px solid rgba(176,106,243,0.2);
          border-radius: 7px; color: var(--cp); font-size: 10px; font-weight: 700;
          text-transform: uppercase; cursor: pointer; transition: all 0.18s;
          letter-spacing: 0.4px; font-family: 'Inter', sans-serif;
        }
        .sd-btn-draft:hover:not(:disabled) { background: rgba(176,106,243,0.14); }
        .sd-btn-draft:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Review progress */
        .sd-review-progress { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.18); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .sd-progress-title { font-size: 10px; font-weight: 700; color: var(--c); margin-bottom: 7px; letter-spacing: 0.4px; }
        .sd-progress-bar { width: 100%; height: 2px; background: rgba(0,212,255,0.1); border-radius: 2px; overflow: hidden; }
        .sd-progress-fill { height: 100%; background: linear-gradient(90deg, var(--c2), var(--c)); animation: sdProgress 2s ease-in-out infinite; box-shadow: 0 0 8px var(--c); }
        @keyframes sdProgress { 0%,100%{width:0%} 50%{width:100%} }

        /* Error panel */
        .sd-error-panel-header {
          display: flex; align-items: center; justify-content: space-between; cursor: pointer;
          padding: 10px 12px; background: rgba(255,51,102,0.08); border: 1px solid rgba(255,51,102,0.2);
          border-radius: 8px; margin-top: 8px; transition: all 0.18s;
        }
        .sd-error-panel-header:hover { background: rgba(255,51,102,0.14); }
        .sd-error-panel-header.expanded { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .sd-error-count { color: var(--cr); font-weight: 700; font-size: 11px; }
        .sd-error-toggle { color: var(--cr); transition: transform 0.2s; font-size: 10px; }
        .sd-error-toggle.expanded { transform: rotate(180deg); }
        .sd-error-content { background: rgba(255,51,102,0.04); border: 1px solid rgba(255,51,102,0.2); border-top: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 12px; }
        .sd-error-item { padding: 5px 0; font-size: 11px; color: var(--t2); display: flex; gap: 8px; }
        .sd-error-item:before { content: "✕"; color: var(--cr); font-weight: 700; flex-shrink: 0; }

        .sd-success-panel { background: rgba(0,255,136,0.07); border: 1px solid rgba(0,255,136,0.2); border-radius: 8px; padding: 10px 12px; margin-top: 8px; color: var(--cg); font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 7px; }
        .sd-warning-panel { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.18); border-radius: 7px; padding: 10px 12px; margin-top: 8px; display: flex; gap: 8px; font-size: 11px; color: var(--t2); }

        .sd-status-indicator { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
        .sd-status-processing { background: rgba(245,197,24,0.1); color: var(--cy); border: 1px solid rgba(245,197,24,0.25); }
        .sd-status-complete   { background: rgba(0,255,136,0.1); color: var(--cg); border: 1px solid rgba(0,255,136,0.25); }

        .sd-spinner { animation: sdSpin 0.9s linear infinite; display: inline-block; }
        @keyframes sdSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* Empty state */
        .sd-empty { text-align: center; padding: 64px 24px; background: var(--bg2); border: 1px dashed rgba(0,212,255,0.1); border-radius: 16px; }
        .sd-empty-icon { font-size: 36px; margin-bottom: 14px; opacity: 0.2; }
        .sd-empty-title { font-size: 15px; font-weight: 700; color: var(--t2); margin-bottom: 5px; font-family: 'Space Grotesk', sans-serif; }
        .sd-empty-sub { font-size: 12px; color: var(--t3); }

        /* Lightbox */
        .sd-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(14px); }
        .sd-lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 10px; object-fit: contain; box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.08); }
        .sd-lightbox-close { position: absolute; top: 20px; right: 20px; width: 34px; height: 34px; background: var(--bg2); border: 1px solid var(--border2); border-radius: 7px; color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.18s; font-size: 13px; z-index: 10; }
        .sd-lightbox-close:hover { border-color: rgba(0,212,255,0.35); color: var(--c); }

        @media (max-width: 900px) {
          .sd-sidebar { overflow-x: auto; padding: 0 12px; }
          .sd-main { padding: 16px; }
          .sd-page-title { font-size: 22px; }
          .sd-stat-grid { grid-template-columns: repeat(2, 1fr); }
          .sd-task-grid { grid-template-columns: 1fr; }
          .sd-user-info { display: none; }
        }
      `}</style>

      <div className="sd-root">
        {/* ── TOP NAVBAR ── */}
        <aside className="sd-sidebar">
          <div className="sd-logo">
            <div className="sd-logo-mark">S</div>
            <div className="sd-logo-text">Staff Portal</div>
          </div>

          <nav className="sd-nav">
            <button
              className={`sd-nav-item ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => { setActiveTab("pending"); setActiveFilter(null); }}
            >
              <span className="sd-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </span>
              My Tasks
              {pendingTasks.length > 0 && <span className="sd-nav-badge">{pendingTasks.length}</span>}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => { setActiveTab("history"); setActiveFilter(null); }}
            >
              <span className="sd-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              </span>
              History
              {submittedTasks.length > 0 && <span className="sd-nav-badge">{submittedTasks.length}</span>}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <span className="sd-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              </span>
              Claude AI
            </button>
          </nav>

          {/* Right: user info + logout */}
          <div className="sd-avatar-wrap">
            <div className="sd-avatar-row">
              <div
                className="sd-avatar-ring"
                onClick={() => profileInputRef.current?.click()}
                title="Update profile photo"
              >
                <div className="sd-avatar">
                  {profilePic
                    ? <img src={profilePic} alt="profile" />
                    : user?.name
                    ? <span style={{ fontSize: "13px", color: "#fff", fontWeight: 800 }}>{user.name.charAt(0).toUpperCase()}</span>
                    : <User size={14} color="#fff" />}
                </div>
                <div className="sd-avatar-camera"><Camera size={10} color="#fff" /></div>
              </div>
              <div className="sd-user-info">
                <div className="sd-user-name">{user?.name || "Staff Member"}</div>
                <div className="sd-user-email">{user?.email || ""}</div>
                <div className="sd-role-pill">
                  <Shield size={7} /> Staff
                </div>
              </div>
            </div>
            <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfilePicChange} />
            <button className="sd-logout" onClick={handleLogout} title="Sign Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </aside>

        <main className="sd-main">
          <div className={`sd-toast ${successMsg ? "visible" : "hidden"}`}>{successMsg}</div>

          {/* ── PAGE HEADER ── */}
          <div className="sd-page-header">
            <div className="sd-page-title">
              {activeTab === "pending"   ? <>Task <em>Analytics</em></>
               : activeTab === "history" ? <>Work <em>History</em></>
               : <><em>Claude</em> AI</>}
            </div>
            <div className="sd-page-sub">
              {activeTab === "pending"
                ? "Click any stat card to filter tasks by status"
                : activeTab === "history"
                ? `${submittedTasks.length} task${submittedTasks.length !== 1 ? "s" : ""} in your history`
                : "Your AI assistant powered by Claude"}
            </div>
          </div>

          {/* ── NEON STAT CARDS (pending tab only) ── */}
          {activeTab === "pending" && (
            <div className="sd-stat-grid">
              <div className={`sd-stat-card ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "all" ? null : "all")} style={{ "--glow": "rgba(0,212,255,0.14)" } as any}>
                <div className="sd-stat-card-top">
                  <div className="sd-stat-label">■ All Tasks</div>
                  <div className="sd-stat-dot" style={{ "--dot": "var(--c)" } as any} />
                </div>
                <div className="sd-stat-value" style={{ "--val": "var(--c)" } as any}>{assignedTasks.length}</div>
                <div className="sd-stat-sub">Total assigned</div>
                <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: "100%", "--val": "var(--c)" } as any} /></div>
              </div>
              <div className={`sd-stat-card ${activeFilter === "active" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "active" ? null : "active")} style={{ "--glow": "rgba(245,197,24,0.12)" } as any}>
                <div className="sd-stat-card-top">
                  <div className="sd-stat-label">⚡ Active</div>
                  <div className="sd-stat-dot" style={{ "--dot": "var(--cy)" } as any} />
                </div>
                <div className="sd-stat-value" style={{ "--val": "var(--cy)" } as any}>{pendingTasks.length}</div>
                <div className="sd-stat-sub">In progress</div>
                <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: `${assignedTasks.length > 0 ? (pendingTasks.length / assignedTasks.length) * 100 : 0}%`, "--val": "var(--cy)" } as any} /></div>
              </div>
              <div className={`sd-stat-card ${activeFilter === "inreview" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "inreview" ? null : "inreview")} style={{ "--glow": "rgba(176,106,243,0.12)" } as any}>
                <div className="sd-stat-card-top">
                  <div className="sd-stat-label">⏳ Pending</div>
                  <div className="sd-stat-dot" style={{ "--dot": "var(--cp)" } as any} />
                </div>
                <div className="sd-stat-value" style={{ "--val": "var(--cp)" } as any}>{inReviewTasks.length}</div>
                <div className="sd-stat-sub">Awaiting approval</div>
                <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: `${assignedTasks.length > 0 ? (inReviewTasks.length / assignedTasks.length) * 100 : 0}%`, "--val": "var(--cp)" } as any} /></div>
              </div>
              <div className={`sd-stat-card ${activeFilter === "approved" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "approved" ? null : "approved")} style={{ "--glow": "rgba(0,255,136,0.1)" } as any}>
                <div className="sd-stat-card-top">
                  <div className="sd-stat-label">✓ Completed</div>
                  <div className="sd-stat-dot" style={{ "--dot": "var(--cg)" } as any} />
                </div>
                <div className="sd-stat-value" style={{ "--val": "var(--cg)" } as any}>{completedTasks.length}</div>
                <div className="sd-stat-sub">Approved</div>
                <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: `${assignedTasks.length > 0 ? (completedTasks.length / assignedTasks.length) * 100 : 0}%`, "--val": "var(--cg)" } as any} /></div>
              </div>
            </div>
          )}

          {/* ── TASK GRID ── */}
          {activeTab === "pending" && (
            displayedTasks.length === 0 ? (
              <div className="sd-empty">
                <div className="sd-empty-icon">◈</div>
                <div className="sd-empty-title">{activeFilter ? "No tasks found" : "All caught up!"}</div>
                <div className="sd-empty-sub">{activeFilter ? "Try a different filter" : "No tasks assigned to you right now."}</div>
              </div>
            ) : (
              <div className="sd-task-grid">
                {displayedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    photos={uploadedPhotos[task.id] || []}
                    getProjectName={getProjectName}
                    getAssignerInfo={getAssignerInfo}
                    onComplete={() => { setSelectedTask(task); setShowCompletionForm(true); }}
                    onUpload={(files) => handlePhotoUpload(task.id, files)}
                    onRemovePhoto={(i) => removePhoto(task.id, i)}
                    onOpenLightbox={(photos, idx) => openLightbox(photos, idx)}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                  />
                ))}
              </div>
            )
          )}

          {activeTab === "history" && (
            submittedTasks.length === 0 ? (
              <div className="sd-empty">
                <div className="sd-empty-icon">○</div>
                <div className="sd-empty-title">Nothing submitted yet</div>
                <div className="sd-empty-sub">Submit your first task to see it here.</div>
              </div>
            ) : (
              <div className="sd-task-grid">
                {submittedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    photos={uploadedPhotos[task.id] || []}
                    getProjectName={getProjectName}
                    getAssignerInfo={getAssignerInfo}
                    onComplete={() => {}}
                    onUpload={(files) => handlePhotoUpload(task.id, files)}
                    onRemovePhoto={(i) => removePhoto(task.id, i)}
                    onOpenLightbox={(photos, idx) => openLightbox(photos, idx)}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    isCompleted
                  />
                ))}
              </div>
            )
          )}

          {activeTab === "ai" && (
            <div style={{ height: "calc(100vh - 200px)" }}>
              <ClaudeChat theme="dark" />
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {showLightbox && lightboxPhotos.length > 0 && (
        <div className="sd-lightbox" onClick={() => setShowLightbox(false)}>
          <button className="sd-lightbox-close" onClick={() => setShowLightbox(false)}>✕</button>
          <img
            src={lightboxPhotos[lightboxIndex]}
            alt={`attachment-${lightboxIndex + 1}`}
            className="sd-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Completion Modal — unchanged functionally */}
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
              <div>
                {selectedTask.assignedBy && (() => {
                  const assigner = getAssignerInfo(selectedTask.assignedBy);
                  const role     = assigner?.role ?? "admin";
                  const rc       = ROLE_COLOR[role] ?? ROLE_COLOR.admin;
                  return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 9px", borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, marginBottom: 10, fontFamily: "inherit", fontSize: 11, color: rc.text, fontWeight: 600 }}>
                      <Shield size={10} />
                      Assigned by <strong style={{ marginLeft: 3 }}>{assigner?.name ?? selectedTask.assignedBy}</strong>
                      <span style={{ opacity: 0.6 }}>· {ROLE_LABEL[role] ?? role}</span>
                    </div>
                  );
                })()}
                <div className="sd-modal-title">Submit: {selectedTask.title}</div>
              </div>
              <button
                className="sd-modal-close"
                onClick={() => { setShowCompletionForm(false); setSelectedTask(null); setCompletionNotes(""); }}
              >✕</button>
            </div>

            <div className="sd-modal-info">
              <p><strong>Priority:</strong> {selectedTask.priority?.toUpperCase()}</p>
              <p><strong>Due:</strong> {new Date(selectedTask.dueDate).toLocaleDateString()}</p>
              <p style={{ gridColumn: "1 / -1" }}><strong>Description:</strong> {selectedTask.description}</p>
            </div>

            {/* Completion Notes */}
            <div className="sd-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                <label className="sd-field-label" style={{ marginBottom: 0 }}>Completion Notes *</label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {draftedNotes[selectedTask.id] && (
                    <span className="sd-status-indicator sd-status-complete">✓ Drafted</span>
                  )}
                  {draftingTask === selectedTask.id && (
                    <span className="sd-status-indicator sd-status-processing">
                      <span className="sd-spinner">⟳</span> Processing…
                    </span>
                  )}
                  <button
                    className="sd-btn-draft"
                    onClick={() => draftCompletionNotes(selectedTask.id)}
                    disabled={draftingTask === selectedTask.id || !completionNotes.trim()}
                  >
                    {draftingTask === selectedTask.id
                      ? <><Loader size={10} className="sd-spinner" /> Drafting…</>
                      : <>✨ Improve with AI</>}
                  </button>
                </div>
              </div>
              <textarea
                className="sd-textarea"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Describe what you completed, any challenges, and current status…"
              />
            </div>

            {/* Attachments */}
            <div className="sd-field">
              <label className="sd-field-label">Attach Photos (optional)</label>
              {(uploadedPhotos[selectedTask.id] || []).length > 0 && (
                <>
                  <div className="sd-photo-grid" style={{ marginBottom: "8px" }}>
                    {(uploadedPhotos[selectedTask.id] || []).map((url, i) => (
                      <div className="sd-photo-thumb" key={i} onClick={() => openLightbox(uploadedPhotos[selectedTask.id], i)}>
                        <img src={url} alt={`upload-${i}`} />
                        <div className="sd-photo-expand">🔍</div>
                        <button
                          className="sd-photo-remove"
                          onClick={(e) => { e.stopPropagation(); removePhoto(selectedTask.id, i); }}
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  {reviewingTask === selectedTask.id && (
                    <div className="sd-review-progress">
                      <div className="sd-progress-title">⟳ &nbsp;Reviewing attachments…</div>
                      <div className="sd-progress-bar"><div className="sd-progress-fill" /></div>
                    </div>
                  )}

                  <button
                    className="sd-btn-review"
                    onClick={() => reviewAttachments(selectedTask.id)}
                    disabled={reviewingTask === selectedTask.id}
                    style={{ marginBottom: 6, width: "100%" }}
                  >
                    {reviewingTask === selectedTask.id
                      ? <><Loader size={10} className="sd-spinner" /> Reviewing…</>
                      : reviewResults[selectedTask.id]
                      ? <><Eye size={10} /> Review Again</>
                      : <><Eye size={10} /> Review Attachments</>}
                  </button>

                  {reviewResults[selectedTask.id] && (
                    reviewResults[selectedTask.id].hasErrors ? (
                      <>
                        <div
                          className={`sd-error-panel-header ${expandedReviewPanel === selectedTask.id ? "expanded" : ""}`}
                          onClick={() => setExpandedReviewPanel(expandedReviewPanel === selectedTask.id ? null : selectedTask.id)}
                        >
                          <span className="sd-error-count">
                            ⚠ {reviewResults[selectedTask.id].results.filter((r: any) => r.status === "ERROR").length} Critical Error
                            {reviewResults[selectedTask.id].results.filter((r: any) => r.status === "ERROR").length !== 1 ? "s" : ""} Found
                          </span>
                          <span className={`sd-error-toggle ${expandedReviewPanel === selectedTask.id ? "expanded" : ""}`}>▼</span>
                        </div>
                        {expandedReviewPanel === selectedTask.id && (
                          <div className="sd-error-content">
                            {reviewResults[selectedTask.id].results.map((result: any, idx: number) => {
                              if (result.status !== "ERROR") return null;
                              return (
                                <div key={idx} style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    📄 Image {result.image} — {result.status}
                                  </div>
                                  {result.issues?.length > 0 && (
                                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                                      {result.issues.map((issue: string, i: number) => (
                                        <li className="sd-error-item" key={i}>{issue}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {result.recommendations && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "var(--c)" }}>
                                      <strong>💡 Fix:</strong> {result.recommendations}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className="sd-warning-panel">
                              <span style={{ color: "var(--c)", fontSize: 14, flexShrink: 0 }}>ℹ</span>
                              <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.5 }}>
                                Please fix the errors above and re-upload corrected images.
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="sd-success-panel">
                        <span style={{ fontSize: 14 }}>✓</span>
                        All attachments reviewed — No errors found. Ready to submit!
                      </div>
                    )
                  )}
                </>
              )}

              <div
                className="sd-drop-zone"
                onClick={() => document.getElementById(`modal-upload-${selectedTask.id}`)?.click()}
              >
                <div className="sd-drop-icon">📎</div>
                <div className="sd-drop-text">Click to upload · <span>Browse files</span></div>
              </div>
              <input
                id={`modal-upload-${selectedTask.id}`}
                type="file" accept="image/*" multiple
                style={{ display: "none" }}
                onChange={(e) => handlePhotoUpload(selectedTask.id, e.target.files)}
              />
            </div>

            <div className="sd-modal-btns">
              <button
                className="sd-btn-submit"
                onClick={handleMarkComplete}
                disabled={!!(reviewResults[selectedTask.id] && reviewResults[selectedTask.id].hasErrors)}
                title={
                  reviewResults[selectedTask.id]?.hasErrors
                    ? "Fix attachment errors before submitting"
                    : completionNotes.trim() ? "Ready to submit" : "Add completion notes first"
                }
              >
                {completionNotes.trim() ? "Submit for Review →" : "⚠ Add Notes First"}
              </button>
              <button
                className="sd-btn-cancel"
                onClick={() => { setShowCompletionForm(false); setSelectedTask(null); setCompletionNotes(""); }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Types ───────────────────────────────────────────────────────────────────
interface ReviewResult {
  results: Array<{ image: number; status: "CLEAN" | "MINOR" | "ERROR"; issues: string[]; recommendations: string }>;
  hasErrors: boolean;
  timestamp: string;
}

interface AssignerInfo {
  name: string;
  role: string;
  email: string;
}

interface TaskCardProps {
  task:              Task;
  photos:            string[];
  getProjectName:    (id: string) => string;
  getAssignerInfo:   (email?: string) => AssignerInfo | null;
  onComplete:        () => void;
  onUpload:          (files: FileList | null) => void;
  onRemovePhoto:     (i: number) => void;
  onOpenLightbox:    (photos: string[], index: number) => void;
  dragOver:          boolean;
  setDragOver:       (v: boolean) => void;
  isCompleted?:      boolean;
}

// ── TaskCard ────────────────────────────────────────────────────────────────
const TaskCard: React.FC<TaskCardProps> = ({
  task, photos, getProjectName, getAssignerInfo,
  onComplete, onUpload, onRemovePhoto, onOpenLightbox,
  dragOver, setDragOver, isCompleted,
}) => {
  const approvalMap: Record<string, { label: string; cls: string }> = {
    assigned:              { label: "Assigned",       cls: "badge-blue"   },
    "in-review":           { label: "Pending Review", cls: "badge-amber"  },
    "admin-approved":      { label: "Admin Approved", cls: "badge-blue"   },
    "superadmin-approved": { label: "Fully Approved", cls: "badge-green"  },
    rejected:              { label: "Rejected",       cls: "badge-red"    },
  };
  const approval    = approvalMap[task.approvalStatus] ?? approvalMap.assigned;
  const priorityCls = task.priority === "high" ? "badge-red" : task.priority === "low" ? "badge-green" : "badge-amber";

  const statusMessages: Record<string, { text: string; color: string }> = {
    assigned:              { text: "Ready to submit",                          color: "var(--accent-light)"  },
    "in-review":           { text: "Waiting for admin review…",               color: "var(--amber)"          },
    "admin-approved":      { text: "Admin approved · awaiting superadmin…",   color: "var(--blue)"           },
    "superadmin-approved": { text: "✓ Fully Approved",                         color: "var(--green)"          },
    rejected:              { text: "Please resubmit with improvements",        color: "var(--red)"            },
  };
  const statusMsg = statusMessages[task.approvalStatus];

  const assigner = getAssignerInfo((task as any).assignedBy);
  const role     = assigner?.role ?? "admin";
  const rc       = ROLE_COLOR[role] ?? ROLE_COLOR.admin;
  const taskAttachments: string[] = (task as any).attachments ?? [];

  return (
    <div className="sd-task">
      <div className="sd-task-top">
        <div style={{ flex: 1 }}>
          <div className="sd-task-title">{task.title}</div>
          <div className="sd-task-desc">{task.description}</div>
        </div>
        {!isCompleted && (task.approvalStatus === "assigned" || task.approvalStatus === "rejected") && (
          <button className="sd-btn-complete" onClick={onComplete}>
            <Eye size={11} /> Submit
          </button>
        )}
      </div>

      {assigner && (
        <div
          className="sd-assigner-chip"
          style={{ background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text }}
        >
          {role === "superadmin" || role === "supremo"
            ? <Shield size={9} />
            : <User size={9} />}
          Assigned by <strong style={{ marginLeft: 3 }}>{assigner.name}</strong>
          <span style={{ opacity: 0.55, marginLeft: 3 }}>· {ROLE_LABEL[role] ?? role}</span>
        </div>
      )}

      <div className="sd-task-meta">
        <span className={`badge ${priorityCls}`}>{task.priority} priority</span>
        <span className={`badge ${approval.cls}`}>{approval.label}</span>
        {task.projectId && (
          <span className="badge badge-purple">{getProjectName(task.projectId)}</span>
        )}
      </div>

      {task.approvalStatus === "rejected" && task.adminComments && (
        <div className="sd-note sd-note-red">
          <div className="sd-note-label" style={{ color: "var(--cr)" }}>⚠ Rejection reason</div>
          {task.adminComments}
        </div>
      )}

      {task.completionNotes && (
        <div className="sd-note sd-note-purple">
          <div className="sd-note-label" style={{ color: "var(--c)" }}>Your notes</div>
          {task.completionNotes}
        </div>
      )}

      {task.adminReviewedBy && task.adminComments && task.approvalStatus !== "rejected" && (
        <div className="sd-note sd-note-cyan">
          <div className="sd-note-label" style={{ color: "var(--cg)" }}>Admin · {task.adminReviewedBy}</div>
          {task.adminComments}
        </div>
      )}

      {taskAttachments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="sd-att-label">
            📎 {taskAttachments.length} Attachment{taskAttachments.length !== 1 ? "s" : ""} submitted
          </div>
          <div className="sd-att-strip">
            {taskAttachments.map((url, i) => (
              <div
                key={i}
                className="sd-att-thumb"
                title={`Open attachment ${i + 1}`}
                onClick={() => onOpenLightbox(taskAttachments, i)}
              >
                <img src={url} alt={`att-${i}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isCompleted && (task.approvalStatus === "assigned" || task.approvalStatus === "rejected") && (
        <div className="sd-photos" style={{ marginTop: "8px" }}>
          {photos.length > 0 && (
            <div className="sd-photo-grid">
              {photos.map((url, i) => (
                <div
                  className="sd-photo-thumb"
                  key={i}
                  onClick={() => onOpenLightbox(photos, i)}
                >
                  <img src={url} alt={`photo-${i}`} />
                  <div className="sd-photo-expand">🔍</div>
                  <button
                    className="sd-photo-remove"
                    onClick={(e) => { e.stopPropagation(); onRemovePhoto(i); }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          <div
            className={`sd-drop-zone ${dragOver ? "drag-over" : ""}`}
            onClick={() => document.getElementById(`upload-${task.id}`)?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files); }}
          >
            <div className="sd-drop-icon"><Upload size={14} /></div>
            <div className="sd-drop-text">Drop photos here · <span>browse</span></div>
          </div>
          <input
            id={`upload-${task.id}`}
            type="file" accept="image/*" multiple
            style={{ display: "none" }}
            onChange={(e) => onUpload(e.target.files)}
          />
        </div>
      )}

      <div className="sd-task-footer">
        <div className="sd-task-dates">
          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
          {task.createdAt && <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>}
        </div>
        {statusMsg && (
          <div className="sd-status-msg" style={{ color: statusMsg.color }}>{statusMsg.text}</div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;