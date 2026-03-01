import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { useUser, Task } from "../contexts/UserContext";
import ClaudeChat from "./ClaudeChat";
import roswaltLogo from "../assets/ROSWALT-LOGO-GOLDEN-8K.png";
import elegantBg from "../assets/elegant-background-perfect-canva.jpg";
import {
  Plus, Upload, LogOut, CheckCircle, RotateCw, Eye, X,
  Zap, User, ChevronRight, Calendar, Flag,
  FileText, ArrowUpRight, MessageSquare, Shield, Sparkles, Loader,
  FolderPlus, Briefcase, Users, Settings, MapPin, Building2, Target, DollarSign,
} from "lucide-react";

type Tab = "overview" | "approvals" | "users" | "addUser" | "projects" | "ai";

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
  "Residential",
  "Commercial",
  "Mixed-Use",
  "Luxury Villa",
  "Apartment Complex",
  "Office Space",
  "Retail",
  "Industrial",
];

interface ReviewResult {
  results: Array<{ image: number; status: "CLEAN" | "MINOR" | "ERROR"; issues: string[]; recommendations: string }>;
  hasErrors: boolean;
  timestamp: string;
}

const SADashboard: React.FC = () => {
  const {
    tasks = [], teamMembers = [], addUser, superadminReviewTask, logout, user,
    addTask, projects = [], addProject, updateTask,
  } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [mounted, setMounted] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "staff", password: "" });
  const [successMsg, setSuccessMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  // Task creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "", priority: "medium" as "low" | "medium" | "high",
    dueDate: "", assignedTo: "", projectId: "",
  });

  // Project creation modal with enhanced fields
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    projectCode: "",
    color: PROJECT_COLORS[0],
    launchDate: "",
    sqft: "",
    location: "",
    address: "",
    usp: "",
    inventory: "",
    priceRange: "",
    projectType: "Residential",
    targetAudience: "",
  });

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reviewComments, setReviewComments] = useState("");

  // AI Review state
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewResults, setAiReviewResults] = useState<ReviewResult | null>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Close lightbox on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
      if (e.key === "ArrowRight") setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhotos.length]);

  const pendingApprovals = tasks.filter((t) => t.approvalStatus === "admin-approved");
  const fullyApproved = tasks.filter((t) => t.approvalStatus === "superadmin-approved");
  const inReview = tasks.filter((t) => t.approvalStatus === "in-review");
  const activeProjects = projects.filter((p) => !(p as any).status || (p as any).status === "active");

  const assignableAdmins = teamMembers.filter((m) => m.role === "admin");
  const assignableStaff = teamMembers.filter((m) => m.role === "staff");
  const selectedMember = teamMembers.find((m) => m.email === newTask.assignedTo);
  const selectedProject = activeProjects.find((p) => p.id === newTask.projectId);

  const handleApprove = (taskId: string) => {
    superadminReviewTask(taskId, true, reviewComments || "Approved by Superadmin");
    setShowReviewModal(false);
    setSelectedTask(null);
    setReviewComments("");
    setAiReviewResults(null);
    showSuccess("Task fully approved ✓");
  };

  const handleReject = (taskId: string) => {
    if (!reviewComments.trim()) {
      showSuccess("⚠ Please add a reason for rejection.");
      return;
    }
    superadminReviewTask(taskId, false, reviewComments || "Rejected by Superadmin");
    setShowReviewModal(false);
    setSelectedTask(null);
    setReviewComments("");
    setAiReviewResults(null);
    showSuccess("Task sent back for rework");
  };

  const handleAddUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) return;
    const result = addUser(newUser as any);
    if (result.success) {
      setNewUser({ name: "", email: "", role: "staff", password: "" });
      showSuccess("User added successfully ✓");
    } else {
      showSuccess(`⚠ ${result.message}`);
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.description || !newTask.assignedTo || !newTask.dueDate) {
      showSuccess("⚠ Please fill in all required fields.");
      return;
    }
    if (!newTask.projectId) {
      showSuccess("⚠ Please select a project.");
      return;
    }
    const member = teamMembers.find((m) => m.email === newTask.assignedTo);
    if (!member) {
      showSuccess("⚠ Selected member not found.");
      return;
    }
   addTask({
  title: newTask.title,
  description: newTask.description,
  status: "pending",
  priority: newTask.priority,
  dueDate: newTask.dueDate,
  assignedTo: newTask.assignedTo,
  projectId: newTask.projectId,
  assignedBy: user?.email || "",
  approvalStatus: "assigned",
});
    showSuccess(`✓ Task assigned to ${member.name}`);
    setNewTask({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "", projectId: "" });
    setShowCreateModal(false);
  };

  const handleCreateProject = () => {
    if (!newProject.name.trim()) {
      showSuccess("⚠ Project name is required.");
      return;
    }
    if (addProject) {
      addProject({
        name: newProject.name,
        description: newProject.description,
        projectCode: newProject.projectCode || newProject.name.substring(0, 3).toUpperCase(),
        color: newProject.color,
        status: "active",
        launchDate: newProject.launchDate,
        sqft: newProject.sqft,
        location: newProject.location,
        address: newProject.address,
        usp: newProject.usp,
        inventory: newProject.inventory,
        priceRange: newProject.priceRange,
        projectType: newProject.projectType,
        targetAudience: newProject.targetAudience,
      } as any);
      showSuccess(`✓ Project "${newProject.name}" created`);
      setNewProject({
        name: "",
        description: "",
        projectCode: "",
        color: PROJECT_COLORS[0],
        launchDate: "",
        sqft: "",
        location: "",
        address: "",
        usp: "",
        inventory: "",
        priceRange: "",
        projectType: "Residential",
        targetAudience: "",
      });
      setShowProjectModal(false);
    }
  };

  // AI: review attachments
  const handleAIReview = async (photos: string[]) => {
    if (photos.length === 0) {
      showSuccess("⚠ No attachments to review.");
      return;
    }
    setAiReviewing(true);
    setAiReviewResults(null);
    try {
      const contentArray: any[] = [{
        type: "text",
        text: `Review each image for grammar, clarity and professionalism. Return ONLY a JSON array:
[{"image":1,"status":"CLEAN|MINOR|ERROR","issues":[],"recommendations":"..."}]`,
      }];
      for (const photo of photos) {
        let base64 = photo, mime = "image/jpeg";
        if (photo.startsWith("data:")) {
          const m = photo.match(/data:([^;]+);base64,(.+)/);
          if (m) { mime = m[1]; base64 = m[2]; }
        }
        contentArray.push({ type: "image", source: { type: "base64", media_type: mime, data: base64 } });
      }
      const res = await fetch("http://localhost:5000/api/review-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask?.id, contentArray }),
      });
      if (!res.ok) {
        showSuccess(`✕ ${(await res.json()).message}`);
        return;
      }
      const data = await res.json();
      setAiReviewResults({
        results: data.results || [],
        hasErrors: data.hasErrors || false,
        timestamp: new Date().toISOString(),
      });
      setReviewPanelOpen(true);
      showSuccess(data.hasErrors ? "⚠ Issues found in attachments." : "✓ All attachments clear!");
    } catch {
      showSuccess("✕ Backend not running. Run: npm start");
    } finally {
      setAiReviewing(false);
    }
  };

  const openLightbox = (photos: string[], index = 0) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const openReviewModal = (task: Task) => {
    setSelectedTask(task);
    setReviewComments("");
    setAiReviewResults(null);
    setReviewPanelOpen(false);
    setShowReviewModal(true);
  };

  const handleLogout = () => { logout(); navigate("/login"); };
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3000); };
  const getStaffName = (email: string) => { const m = teamMembers.find((t) => t.email === email); return m ? m.name : email; };
  const isAdminEmail = (email: string) => teamMembers.find((m) => m.email === email)?.role === "admin";

  const handleExportCredentials = async () => {
  setExporting(true);
  try {
    const sorted = [...teamMembers].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
    const rows = sorted.map((member, idx) => ({
      "#": String(idx + 1), "Full Name": member.name, Email: member.email,
      Role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
      "OTP / Password": DEFAULT_PASSWORDS[member.email.toLowerCase()] ?? "—",
    }));
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("User Credentials");
    
    ws.columns = [
      { header: "#", key: "#", width: 5 },
      { header: "Full Name", key: "Full Name", width: 30 },
      { header: "Email", key: "Email", width: 36 },
      { header: "Role", key: "Role", width: 14 },
      { header: "OTP / Password", key: "OTP / Password", width: 18 },
    ];
    
    rows.forEach((row) => {
      ws.addRow(row);
    });
    
    await wb.xlsx.writeFile(`Roswalt_Credentials_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showSuccess("Credentials exported ✓");
  } catch (error) {
    console.error("Export error:", error);
    showSuccess("✕ Export failed");
  } finally {
    setExporting(false);
  }
};

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <Zap size={18} /> },
    { id: "approvals", label: "Approvals", icon: <CheckCircle size={18} />, count: pendingApprovals.length },
    { id: "projects", label: "Projects", icon: <Briefcase size={18} />, count: projects.length },
    { id: "users", label: "Users", icon: <Users size={18} />, count: teamMembers.length },
    { id: "addUser", label: "Add User", icon: <Plus size={18} /> },
    { id: "ai", label: "Claude AI", icon: <Sparkles size={18} /> },
  ];

  const priClass = (p: string) =>
    p === "high" ? "badge badge-danger" : p === "low" ? "badge badge-success" : "badge badge-warning";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --primary: #d4af37;
          --primary-light: #e5c158;
          --primary-dark: #b8941f;
          --secondary: #9d6e28;
          --accent: #c9a96e;
          --success: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --bg-dark: #0a0805;
          --bg-light: #1a1410;
          --bg-lighter: #2a1f1a;
          --text: #f5ead8;
          --text-secondary: #d4c5b0;
          --text-muted: #8b7355;
          --border: #3a2f25;
          --border-light: #4a3f35;
        }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-in { animation: fadeIn 0.35s ease both; }
        .scale-in { animation: scaleIn 0.3s ease both; }
        .spin { animation: spin 1s linear infinite; }

        body {
          background: var(--bg-dark);
          color: var(--text);
          font-family: 'Inter', sans-serif;
        }

        .app {
          min-height: 100vh;
          display: flex;
          background: var(--bg-dark);
          position: relative;
        }

        .app::before {
          content: '';
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse 100% 100% at 50% 50%, rgba(212, 175, 55, 0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* SIDEBAR */
        .sidebar {
          width: 280px;
          min-height: 100vh;
          background: linear-gradient(180deg, rgba(26, 20, 16, 0.95) 0%, rgba(10, 8, 5, 0.98) 100%);
          border-right: 1px solid var(--border);
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          position: sticky;
          top: 0;
          z-index: 20;
          height: 100vh;
          overflow-y: auto;
          box-shadow: inset -1px 0 0 rgba(212, 175, 55, 0.1);
        }

        .logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .logo-img {
          width: 60px;
          height: 60px;
          object-fit: contain;
          filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.4));
        }

        .logo-name {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .logo-role {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .nav-item:hover {
          background: rgba(212, 175, 55, 0.08);
          color: var(--text-secondary);
          border-color: var(--border-light);
        }

        .nav-item.active {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(201, 169, 110, 0.08));
          color: var(--primary);
          border-color: rgba(212, 175, 55, 0.3);
          font-weight: 500;
          box-shadow: inset 0 1px 0 rgba(212, 175, 55, 0.1);
        }

        .nav-badge {
          margin-left: auto;
          background: linear-gradient(135deg, var(--danger), #c92a2a);
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        .user-card {
          padding: 16px;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(201, 169, 110, 0.04));
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 12px;
          margin-top: auto;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 4px;
        }

        .user-email {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .btn {
          padding: 10px 16px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Inter', sans-serif;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: #000;
          font-weight: 600;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: rgba(212, 175, 55, 0.1);
          color: var(--primary);
          border: 1px solid rgba(212, 175, 55, 0.2);
        }

        .btn-secondary:hover {
          background: rgba(212, 175, 55, 0.15);
          border-color: rgba(212, 175, 55, 0.3);
        }

        .btn-danger {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid var(--danger);
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .btn-success {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success);
          border: 1px solid var(--success);
        }

        .btn-success:hover {
          background: rgba(16, 185, 129, 0.2);
        }

        .btn-icon {
          width: 40px;
          height: 40px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-logout {
          width: 100%;
          margin-top: 12px;
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid var(--danger);
        }

        .btn-logout:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        /* MAIN */
        .main {
          flex: 1;
          padding: 40px 48px;
          overflow-y: auto;
          position: relative;
          z-index: 1;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          gap: 24px;
        }

        .page-title {
          font-size: 36px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        .page-title em {
          font-style: italic;
          background: linear-gradient(135deg, var(--primary-light), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .page-subtitle {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 400;
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .stat-card {
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.1) 0%, rgba(26, 20, 16, 0.6) 100%);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.3), transparent);
        }

        .stat-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.15) 0%, rgba(26, 20, 16, 0.7) 100%);
          box-shadow: 0 12px 40px rgba(212, 175, 55, 0.15);
        }

        .stat-icon {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .stat-number {
          font-size: 32px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 4px;
          background: linear-gradient(135deg, var(--text), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .badge-primary {
          background: rgba(212, 175, 55, 0.2);
          color: var(--primary);
          border: 1px solid rgba(212, 175, 55, 0.3);
        }

        .badge-success {
          background: rgba(16, 185, 129, 0.2);
          color: var(--success);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .badge-warning {
          background: rgba(245, 158, 11, 0.2);
          color: var(--warning);
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .badge-danger {
          background: rgba(239, 68, 68, 0.2);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .badge-secondary {
          background: rgba(157, 110, 40, 0.2);
          color: var(--secondary);
          border: 1px solid rgba(157, 110, 40, 0.3);
        }

        /* Table */
        .table-wrapper {
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.08) 0%, rgba(26, 20, 16, 0.7) 100%);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 12px;
          overflow: hidden;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th {
          padding: 16px 20px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          background: rgba(212, 175, 55, 0.05);
          border-bottom: 1px solid rgba(212, 175, 55, 0.15);
        }

        .table td {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.08);
          color: var(--text-secondary);
        }

        .table tr:last-child td {
          border-bottom: none;
        }

        .table tr:hover td {
          background: rgba(212, 175, 55, 0.05);
        }

        /* Form */
        .form {
          max-width: 600px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .form-input,
        .form-textarea,
        .form-select {
          width: 100%;
          padding: 12px 16px;
          background: rgba(26, 20, 16, 0.5);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 8px;
          color: var(--text);
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: var(--text-muted);
        }

        .form-input:focus,
        .form-textarea:focus,
        .form-select:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(212, 175, 55, 0.05);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }

        /* Task Card */
        .task-card {
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.08) 0%, rgba(26, 20, 16, 0.65) 100%);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 16px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .task-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.2), transparent);
        }

        .task-card:hover {
          border-color: var(--primary);
          transform: translateY(-2px);
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.12) 0%, rgba(26, 20, 16, 0.75) 100%);
          box-shadow: 0 10px 40px rgba(212, 175, 55, 0.1);
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          gap: 16px;
        }

        .task-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
        }

        .task-description {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .task-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        /* Project Card */
        .project-card {
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.08) 0%, rgba(26, 20, 16, 0.65) 100%);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .project-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
          background: linear-gradient(145deg, rgba(212, 175, 55, 0.12) 0%, rgba(26, 20, 16, 0.75) 100%);
          box-shadow: 0 12px 40px rgba(212, 175, 55, 0.15);
        }

        .project-color-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.3);
        }

        .project-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
        }

        .project-code {
          font-size: 11px;
          color: var(--text-muted);
          font-family: 'Space Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .project-detail {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        /* Modal */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(6px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease;
        }

        .modal {
          background: linear-gradient(160deg, rgba(10, 8, 5, 0.98) 0%, rgba(26, 20, 16, 0.98) 100%);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 16px;
          width: 100%;
          max-width: 650px;
          max-height: 90vh;
          overflow-y: auto;
          animation: scaleIn 0.3s ease;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(212, 175, 55, 0.15);
        }

        .modal-header {
          padding: 28px;
          border-bottom: 1px solid rgba(212, 175, 55, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }

        .modal-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 8px;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .modal-close:hover {
          background: var(--primary);
          color: #000;
          border-color: var(--primary);
        }

        .modal-body {
          padding: 28px;
        }

        /* Toast */
        .toast {
          position: fixed;
          top: 28px;
          right: 28px;
          z-index: 999;
          padding: 16px 24px;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.1));
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          color: var(--primary);
          font-size: 14px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 40px rgba(212, 175, 55, 0.2);
        }

        .toast.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .toast.hidden {
          opacity: 0;
          transform: translateY(-20px);
          pointer-events: none;
        }

        /* Lightbox */
        .lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .lightbox-img {
          max-width: 90vw;
          max-height: 85vh;
          object-fit: contain;
          border-radius: 8px;
        }

        .lightbox-close,
        .lightbox-nav {
          position: absolute;
          background: rgba(212, 175, 55, 0.15);
          border: 1px solid rgba(212, 175, 55, 0.3);
          color: white;
          border-radius: 8px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .lightbox-close:hover,
        .lightbox-nav:hover {
          background: rgba(212, 175, 55, 0.3);
        }

        .lightbox-close {
          top: 20px;
          right: 24px;
        }

        .lightbox-nav.prev {
          left: 20px;
          top: 50%;
          transform: translateY(-50%);
        }

        .lightbox-nav.next {
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
        }

        .lightbox-counter {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: rgba(212, 175, 55, 0.5);
          font-family: 'Space Mono', monospace;
        }

        /* Empty State */
        .empty {
          text-align: center;
          padding: 60px 20px;
          background: rgba(26, 20, 16, 0.5);
          border: 1px dashed rgba(212, 175, 55, 0.2);
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 48px;
          opacity: 0.3;
          margin-bottom: 16px;
        }

        .empty-text {
          font-size: 18px;
          color: var(--text-muted);
        }

        /* Utilities */
        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 24px;
          margin-top: 40px;
          background: linear-gradient(135deg, var(--text), var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .grid-full {
          grid-column: 1 / -1;
        }

        .mb-16 { margin-bottom: 16px; }
        .mb-24 { margin-bottom: 24px; }
        .mt-24 { margin-top: 24px; }
        .gap-12 { gap: 12px; }
      `}</style>

      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo">
            <img src={roswaltLogo} alt="Roswalt" className="logo-img" />
            <div className="logo-name">SmartCue</div>
            <div className="logo-role">Superadmin</div>
          </div>

          <nav className="nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span style={{ flex: 1, textAlign: "left" }}>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="nav-badge">{tab.count}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="user-card">
            <div className="user-name">{user?.name || "Superadmin"}</div>
            <div className="user-email">{user?.email || ""}</div>
            {user?.role === "superadmin" && (
              <button
                className="btn btn-success"
                onClick={handleExportCredentials}
                disabled={exporting}
                style={{ width: "100%", marginBottom: "12px" }}
              >
                <FileText size={14} />
                {exporting ? "Exporting…" : "Export"}
              </button>
            )}
            <button className="btn btn-logout" onClick={handleLogout}>
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main" style={{ opacity: mounted ? 1 : 0 }}>
          <div className={`toast ${successMsg ? "visible" : "hidden"}`}>{successMsg}</div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    Command <em>Centre</em>
                  </h1>
                  <p className="page-subtitle">
                    Full visibility across tasks, approvals and team members
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={16} /> Assign Task
                </button>
              </div>

              <div className="stats-grid">
                {[
                  { icon: "⏳", num: pendingApprovals.length, label: "Pending Approval" },
                  { icon: "✓", num: fullyApproved.length, label: "Fully Approved" },
                  { icon: "◈", num: inReview.length, label: "Under Review" },
                  { icon: "👥", num: teamMembers.length, label: "Team Members" },
                ].map((s, i) => (
                  <div className="stat-card fade-up" key={i} style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="stat-icon">{s.icon}</div>
                    <div className="stat-number">{s.num}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <h2 className="section-title">All Tasks ({tasks.length})</h2>
              {tasks.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📋</div>
                  <div className="empty-text">No tasks yet</div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Assigned To</th>
                        <th>Status</th>
                        <th>Approval</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id}>
                          <td style={{ color: "var(--text)" }}>{task.title}</td>
                          <td>{getStaffName(task.assignedTo)}</td>
                          <td>{task.status}</td>
                          <td>
                            <span className={`badge badge-${task.approvalStatus === "superadmin-approved" ? "success" : task.approvalStatus === "admin-approved" ? "primary" : task.approvalStatus === "rejected" ? "danger" : "warning"}`}>
                              {task.approvalStatus}
                            </span>
                          </td>
                          <td>{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "—"}</td>
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
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    Final <em>Approvals</em>
                  </h1>
                  <p className="page-subtitle">Tasks approved by admin — awaiting your sign-off</p>
                </div>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">✓</div>
                  <div className="empty-text">All tasks reviewed — nothing pending</div>
                </div>
              ) : (
                pendingApprovals.map((task, idx) => (
                  <div className="task-card fade-up" key={task.id} style={{ animationDelay: `${idx * 55}ms` }}>
                    <div className="task-header">
                      <div style={{ flex: 1 }}>
                        <div className="task-title">{task.title}</div>
                        <div className="task-description">{task.description}</div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => openReviewModal(task)}
                      >
                        <Eye size={14} /> Review
                      </button>
                    </div>
                    <div className="task-meta">
                      <span className="badge badge-primary">Admin Approved</span>
                      {task.priority && <span className={priClass(task.priority)}><Flag size={10} /> {task.priority}</span>}
                      {(task as any).attachments?.length > 0 && (
                        <span className="badge badge-secondary">📎 {(task as any).attachments.length}</span>
                      )}
                    </div>
                  </div>
                ))
              )}

              {fullyApproved.length > 0 && (
                <>
                  <h2 className="section-title">Previously Approved ({fullyApproved.length})</h2>
                  {fullyApproved.map((task) => (
                    <div className="task-card" key={task.id} style={{ opacity: 0.6 }}>
                      <div className="task-title">{task.title}</div>
                      <div style={{ marginTop: "12px" }}>
                        <span className="badge badge-success">✓ Fully Approved</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/* PROJECTS */}
          {activeTab === "projects" && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    Project <em>Management</em>
                  </h1>
                  <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? "s" : ""} in the system</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowProjectModal(true)}>
                  <FolderPlus size={16} /> New Project
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📁</div>
                  <div className="empty-text">No projects yet</div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: "20px" }}
                    onClick={() => setShowProjectModal(true)}
                  >
                    <FolderPlus size={14} /> Create First Project
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                  {projects.map((project, idx) => (
                    <div className="project-card fade-up" key={project.id} style={{ animationDelay: `${idx * 55}ms` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div className="project-color-dot" style={{ background: (project as any).color || "#d4af37" }} />
                        <div style={{ flex: 1 }}>
                          <div className="project-name">{project.name}</div>
                          {(project as any).projectCode && (
                            <div className="project-code">{(project as any).projectCode}</div>
                          )}
                        </div>
                        <span className={`badge badge-${(project as any).status === "active" ? "success" : "primary"}`}>
                          {(project as any).status || "active"}
                        </span>
                      </div>
                      {(project as any).description && (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                          {(project as any).description}
                        </p>
                      )}
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(212, 175, 55, 0.1)" }}>
                        {(project as any).projectType && (
                          <div className="project-detail">
                            <Building2 size={14} />
                            {(project as any).projectType}
                          </div>
                        )}
                        {(project as any).location && (
                          <div className="project-detail">
                            <MapPin size={14} />
                            {(project as any).location}
                          </div>
                        )}
                        {(project as any).sqft && (
                          <div className="project-detail">
                            📐 {(project as any).sqft} sq.ft
                          </div>
                        )}
                        {(project as any).priceRange && (
                          <div className="project-detail">
                            <DollarSign size={14} />
                            {(project as any).priceRange}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
                        {tasks.filter(t => t.projectId === project.id).length} tasks
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    Team <em>Members</em>
                  </h1>
                  <p className="page-subtitle">{teamMembers.length} members across all roles</p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>OTP / Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...teamMembers]
                      .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))
                      .map((member) => (
                        <tr key={member.id}>
                          <td style={{ color: "var(--text)", fontWeight: 500 }}>{member.name}</td>
                          <td>{member.email}</td>
                          <td>
                            <span
                              className={`badge badge-${member.role === "superadmin" ? "primary" : member.role === "admin" ? "secondary" : "success"}`}
                              style={{ textTransform: "capitalize" }}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: "0.05em" }}>
                            {user?.role === "superadmin"
                              ? DEFAULT_PASSWORDS[member.email.toLowerCase()] ?? "—"
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
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    Add <em>Member</em>
                  </h1>
                  <p className="page-subtitle">Onboard a new team member to the workspace</p>
                </div>
              </div>

              <div className="form">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g., Arjun Mehta"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="arjun@roswalt.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Access Role</label>
                  <select
                    className="form-select"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleAddUser}
                  disabled={!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()}
                >
                  <Plus size={14} /> Add Member
                </button>
              </div>
            </>
          )}

          {/* CLAUDE AI */}
          {activeTab === "ai" && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">
                    Claude <em>AI</em>
                  </h1>
                  <p className="page-subtitle">Your AI assistant for workspace management</p>
                </div>
              </div>
              <div style={{ height: "calc(100vh - 240px)", background: "var(--bg-light)", borderRadius: "12px", border: "1px solid rgba(212, 175, 55, 0.15)", overflow: "hidden" }}>
                <ClaudeChat theme="amber" />
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODAL: CREATE TASK */}
      {showCreateModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-subtitle">Assign New Task</div>
                <div className="modal-title">Create & Assign Task</div>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Task Title *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="e.g., Redesign onboarding flow"
                    />
                  </div>
                </div>
                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Assign to *</label>
                    <select
                      className="form-select"
                      value={newTask.assignedTo}
                      onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    >
                      <option value="">Select a person...</option>
                      {assignableAdmins.length > 0 && (
                        <optgroup label="── ADMINS ──">
                          {assignableAdmins.map((m) => (
                            <option key={m.id} value={m.email}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {assignableStaff.length > 0 && (
                        <optgroup label="── STAFF ──">
                          {assignableStaff.map((m) => (
                            <option key={m.id} value={m.email}>
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="form-group">
                    <label className="form-label">Due Date *</label>
                    <input
                      className="form-input"
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Project *</label>
                    {activeProjects.length === 0 ? (
                      <div style={{ padding: "12px 16px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid var(--warning)", borderRadius: 8, color: "var(--warning)", fontSize: 13 }}>
                        ⚠ No active projects. Create one first.
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={newTask.projectId}
                        onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                      >
                        <option value="">— Select a project —</option>
                        {activeProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {(p as any).projectCode ? ` · ${(p as any).projectCode}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea
                      className="form-textarea"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Detailed description of the task…"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn btn-primary" onClick={handleCreateTask} style={{ flex: 1 }}>
                  <CheckCircle size={14} /> Assign Task
                </button>
                <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PROJECT */}
      {showProjectModal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowProjectModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-subtitle">New Project</div>
                <div className="modal-title">Create Project</div>
              </div>
              <button className="modal-close" onClick={() => setShowProjectModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Project Name *</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="e.g., Skyline Residences"
                    />
                  </div>
                </div>

                <div>
                  <div className="form-group">
                    <label className="form-label">Project Code</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.projectCode}
                      onChange={(e) => setNewProject({ ...newProject, projectCode: e.target.value.toUpperCase() })}
                      placeholder="e.g., SKY-001"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={newProject.projectType}
                      onChange={(e) => setNewProject({ ...newProject, projectType: e.target.value })}
                    >
                      {PROJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.location}
                      onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                      placeholder="e.g., Bandra West, Mumbai"
                    />
                  </div>
                </div>

                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Full Address</label>
                    <textarea
                      className="form-textarea"
                      value={newProject.address}
                      onChange={(e) => setNewProject({ ...newProject, address: e.target.value })}
                      placeholder="Complete address"
                    />
                  </div>
                </div>

                <div>
                  <div className="form-group">
                    <label className="form-label">Total Sq.ft</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.sqft}
                      onChange={(e) => setNewProject({ ...newProject, sqft: e.target.value })}
                      placeholder="e.g., 150,000"
                    />
                  </div>
                </div>

                <div>
                  <div className="form-group">
                    <label className="form-label">Launch Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={newProject.launchDate}
                      onChange={(e) => setNewProject({ ...newProject, launchDate: e.target.value })}
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="form-group">
                    <label className="form-label">Price Range</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.priceRange}
                      onChange={(e) => setNewProject({ ...newProject, priceRange: e.target.value })}
                      placeholder="e.g., ₹2.5Cr - ₹5Cr"
                    />
                  </div>
                </div>

                <div>
                  <div className="form-group">
                    <label className="form-label">Inventory</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.inventory}
                      onChange={(e) => setNewProject({ ...newProject, inventory: e.target.value })}
                      placeholder="e.g., 120 units"
                    />
                  </div>
                </div>

                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">USP</label>
                    <textarea
                      className="form-textarea"
                      value={newProject.usp}
                      onChange={(e) => setNewProject({ ...newProject, usp: e.target.value })}
                      placeholder="Unique selling points..."
                    />
                  </div>
                </div>

                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Target Audience</label>
                    <input
                      className="form-input"
                      type="text"
                      value={newProject.targetAudience}
                      onChange={(e) => setNewProject({ ...newProject, targetAudience: e.target.value })}
                      placeholder="e.g., Young professionals, Luxury buyers"
                    />
                  </div>
                </div>

                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="Brief project description…"
                    />
                  </div>
                </div>

                <div className="grid-full">
                  <div className="form-group">
                    <label className="form-label">Project Color</label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {PROJECT_COLORS.map((color) => (
                        <button
                          key={color}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: color,
                            border: newProject.color === color ? "3px solid var(--text)" : "2px solid transparent",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            boxShadow: newProject.color === color ? `0 0 12px ${color}` : "none",
                          }}
                          onClick={() => setNewProject({ ...newProject, color })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim()}
                  style={{ flex: 1 }}
                >
                  <FolderPlus size={14} /> Create Project
                </button>
                <button className="btn btn-secondary" onClick={() => setShowProjectModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVIEW TASK */}
      {showReviewModal && selectedTask && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReviewModal(false);
              setSelectedTask(null);
              setReviewComments("");
              setAiReviewResults(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <div className="modal-subtitle">Task Review</div>
                <div className="modal-title">{selectedTask.title}</div>
              </div>
              <button
                className="modal-close"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedTask(null);
                  setReviewComments("");
                  setAiReviewResults(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
                <span className={`badge badge-${selectedTask.priority === "high" ? "danger" : selectedTask.priority === "low" ? "success" : "warning"}`}>
                  <Flag size={12} /> {selectedTask.priority}
                </span>
                <span className="badge badge-primary">
                  <User size={12} /> {getStaffName(selectedTask.assignedTo)}
                </span>
                <span className="badge badge-secondary">
                  <Calendar size={12} /> Due {new Date(selectedTask.dueDate).toLocaleDateString()}
                </span>
              </div>

              <div style={{ padding: 16, background: "rgba(10, 8, 5, 0.8)", border: "1px solid rgba(212, 175, 55, 0.15)", borderRadius: 8, marginBottom: 24, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {selectedTask.description}
              </div>

              {(selectedTask as any).attachments?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <label className="form-label">Attachments ({(selectedTask as any).attachments.length})</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {(selectedTask as any).attachments.map((url: string, i: number) => (
                      <div
                        key={i}
                        onClick={() => openLightbox((selectedTask as any).attachments, i)}
                        style={{
                          width: 100,
                          height: 100,
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid rgba(212, 175, 55, 0.2)",
                          cursor: "pointer",
                          position: "relative",
                          background: "rgba(10, 8, 5, 0.8)",
                        }}
                      >
                        <img src={url} alt={`att-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Your Review Notes</label>
                <textarea
                  className="form-textarea"
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="Feedback or reason for rejection…"
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-success" onClick={() => handleApprove(selectedTask.id)} style={{ flex: 1 }}>
                  <CheckCircle size={14} /> Approve
                </button>
                <button className="btn btn-danger" onClick={() => handleReject(selectedTask.id)} style={{ flex: 1 }}>
                  <RotateCw size={14} /> Send Back
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedTask(null);
                    setReviewComments("");
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {showLightbox && lightboxPhotos.length > 0 && (
        <div className="lightbox" onClick={() => setShowLightbox(false)}>
          <button className="lightbox-close" onClick={() => setShowLightbox(false)}>
            ✕
          </button>
          <button
            className="lightbox-nav prev"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => Math.max(i - 1, 0));
            }}
            disabled={lightboxIndex === 0}
          >
            ‹
          </button>
          <img
            src={lightboxPhotos[lightboxIndex]}
            alt={`attachment-${lightboxIndex + 1}`}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="lightbox-nav next"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1));
            }}
            disabled={lightboxIndex === lightboxPhotos.length - 1}
          >
            ›
          </button>
          {lightboxPhotos.length > 1 && (
            <div className="lightbox-counter">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SADashboard;