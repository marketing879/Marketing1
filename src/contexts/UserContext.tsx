import React, { createContext, useContext, useState, useEffect } from "react";

declare const process: {
  env: {
    REACT_APP_API_URL?: string;
  };
};

const API_URL =
  process.env.REACT_APP_API_URL ||
  "https://adaptable-patience-production-45da.up.railway.app";

// ── CHANGE 1: Added "supremo" to the Role type ───────────────────────────────
export type Role = "staff" | "admin" | "superadmin" | "supremo";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isDoer: boolean;
  phone?: string;
  avatar?: string;   // Cloudinary URL — updated via ChatRoom profile modal
  status?: string;   // presence text, e.g. "Available", "In a meeting"
}

export type TicketType =
  | "delete-request"
  | "small-activity"
  | "general-query"
  | "task-delegation";

export interface AssistanceTicket {
  id:           string;
  taskId:       string;
  taskTitle:    string;
  taskDueDate:  string;
  assignedTo:   string;   // person the ticket is sent TO (admin who reviews)
  assignedBy:   string;   // person who raised the ticket
  raisedBy:     string;   // display name of raiser
  raisedAt:     string;
  status:       "open" | "pending-admin" | "admin-approved" | "superadmin-pending" | "superadmin-approved" | "rejected" | "resolved";
  ticketType:   TicketType;
  reason:       string;
  staffNote:    string;
  adminComment?: string;
  approvedAt?:  string;
  approvedBy?:  string;
  rejectedAt?:  string;
  rejectedBy?:  string;
  rejectionReason?: string;
  attachments?: string[];  // base64 encoded files
  // For delete-request: superadmin must approve before task can be deleted
  targetTaskId?: string;   // task to delete (may differ from taskId)
  superadminApprovedAt?: string;
  superadminApprovedBy?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  by: string;
  to?: string;
  notes?: string;
}

export type ActivityCategory =
  | "task"
  | "ticket"
  | "project"
  | "user"
  | "auth"
  | "approval";

export interface ActivityEntry {
  id:         string;
  timestamp:  string;
  category:   ActivityCategory;
  action:     string;        // e.g. "Task Assigned", "Ticket Raised", "Task Deleted"
  actorEmail: string;
  actorName:  string;
  targetId?:  string;        // taskId / ticketId / projectId
  targetName?: string;       // task title / ticket title etc.
  meta?:      Record<string, string>; // extra key/value pairs
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "approved" | "rework";
  priority: "low" | "medium" | "high";
  dueDate: string;
  assignedTo: string;
  assignedBy: string;
  projectId: string;
  completionNotes?: string;
  adminReviewNotes?: string;
  adminApproved?: boolean;
  approvalStatus:
    | "assigned"
    | "in-review"
    | "admin-approved"
    | "superadmin-approved"
    | "rejected";
  adminComments?: string;
  adminReviewedBy?: string;
  createdAt?: string;
  timeSlot?:      string;
  exactDeadline?: string;
  history?:       HistoryEntry[];
  tatBreached?:   boolean;
  smartAssist?:   { delayDuration?: string; reminderCount?: number };
  completedAt?:   string;
  forwardedFrom?: string;
  attachments?:   string[];
  isFrozen?:      boolean;
  frozenTicketId?: string;
  scoreReportUrl?: string;  // Cloudinary URL of the auto-uploaded score PDF/HTML report
  scoreData?: {
    percentScore:  number;
    grade:         string;
    verdict:       string;
    grammarClean:  boolean;
    grammarErrors: string[];
    strengths:     string[];
    improvements:  string[];
    categories:    any[];
    submittedAt:   string;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  projectCode:        string;
  concernedDoerEmail: string;
  launchDate:         string;
  status:             "active" | "inactive";
}

export const getDoerForProject = (
  project: Project | undefined,
  teamMembers: User[]
): User | undefined => {
  if (!project?.concernedDoerEmail) return undefined;
  return teamMembers.find(
    (m) => m.email.toLowerCase() === project.concernedDoerEmail.toLowerCase()
  );
};

interface UserContextType {
  user: User | null;
  teamMembers: User[];
  tasks: Task[];
  projects: Project[];
  voiceAccessGranted: boolean;
  validateLogin: (email: string, password: string) => boolean;
  commitLogin: (email: string, password: string) => void;
  loginAsUser: (user: User) => void;
  logout: () => void;
  addUser: (user: Omit<User, "id"> & { password: string }) => {
    success: boolean;
    message: string;
  };
  updateUser: (userId: string, updates: { phone?: string; name?: string; role?: Role }) => void;
  getNextOTP: () => string;
  deleteTeamMember: (memberId: string) => void;
  addTask: (task: Omit<Task, "id" | "createdAt"> & { id?: string; createdAt?: string }) => void;
  updateTask: (taskId: string, task: Partial<Task>) => void;
  updateTaskStatus: (taskId: string, status: Task["status"], notes?: string) => void;
  adminReviewTask: (taskId: string, approved: boolean, comments: string) => void;
  superadminReviewTask: (taskId: string, approved: boolean, comments: string) => void;
  getTasksForAdminReview: () => Task[];
  getTasksForSuperadminReview: () => Task[];
  getTasksForUser: (email: string) => Task[];
  getAssignedTasks: () => Task[];
  submitTaskCompletion: (taskId: string, notes: string) => void;
  getProjectById: (id: string) => Project | undefined;
  getTaskById: (id: string) => Task | undefined;
  deleteTask: (id: string) => void;
  deleteAllTasks: () => void;
  addProject: (project: Omit<Project, "id">) => void;
  assistanceTickets: AssistanceTicket[];
  raiseAssistanceTicket: (ticket: Omit<AssistanceTicket, "id" | "raisedAt" | "status">) => void;
  updateAssistanceTicket: (ticketId: string, updates: Partial<AssistanceTicket>) => void;
  submitTicketToAdmin: (ticketId: string) => void;
  approveAssistanceTicket: (ticketId: string, adminComment: string) => void;
  rejectAssistanceTicket: (ticketId: string, reason: string) => void;
  superadminApproveTicket: (ticketId: string, approve: boolean, comment: string) => void;
  activityLog: ActivityEntry[];
  logActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface StoredUser extends User {
  password: string;
}

// ── CHANGE 2: Added Supremo user ─────────────────────────────────────────────
const defaultUsers: StoredUser[] = [
  { id: "0",  name: "Supremo",                      email: "supremo@roswalt.com",             role: "supremo",    isDoer: false, password: "000000" },
  { id: "1",  name: "Madhav Sawant",               email: "madhav.sawant@roswalt.com",      role: "superadmin", isDoer: false, password: "400002" },
  { id: "2",  name: "Aziz Ashfaq Khan",             email: "aziz.khan@roswalt.com",           role: "admin",      isDoer: false, password: "100002" },
  { id: "3",  name: "Vinay Dinkar Vanmali",         email: "vinay.vanmali@roswalt.com",       role: "admin",      isDoer: false, password: "300003" },
  { id: "4",  name: "Jalal Chandmiya Shaikh",       email: "jalal.shaikh@roswalt.com",        role: "admin",      isDoer: false, password: "100004" },
  { id: "5",  name: "Nidhi Mehta",                  email: "nidhi.mehta@roswalt.com",         role: "admin",      isDoer: false, password: "100005" },
  { id: "6",  name: "Keerti Barua",                 email: "keerti.barua@roswalt.com",        role: "admin",      isDoer: false, password: "100006", phone: "+919167388013" },
  { id: "7",  name: "Hetal Makwana",                email: "hetal.makwana@roswalt.com",       role: "admin",      isDoer: false, password: "100007" },
  { id: "8",  name: "Prathamesh Vijay Chile",       email: "prathamesh.chile@roswalt.com",    role: "staff",      isDoer: true,  password: "100008", phone: "+91XXXXXXXXXX" },
  { id: "9",  name: "Samruddhi C Shivgan",          email: "samruddhi.shivgan@roswalt.com",   role: "staff",      isDoer: true,  password: "100009", phone: "+91XXXXXXXXXX" },
  { id: "10", name: "Irfan S. Ansari",              email: "irfan.ansari@roswalt.com",        role: "staff",      isDoer: true,  password: "100010", phone: "+91XXXXXXXXXX" },
  { id: "11", name: "Vishal Chaudhary",             email: "vishal.chaudhary@roswalt.com",    role: "staff",      isDoer: true,  password: "100011", phone: "+91XXXXXXXXXX" },
  { id: "12", name: "Mithilesh Viinayak Menge",     email: "mithilesh.menge@roswalt.com",     role: "staff",      isDoer: true,  password: "100012", phone: "+91XXXXXXXXXX" },
  { id: "13", name: "Jai Bhojwani",                 email: "jai.bhojwani@roswalt.com",        role: "staff",      isDoer: true,  password: "100013", phone: "+91XXXXXXXXXX" },
  { id: "14", name: "Vikrant Swami Pabrekar",       email: "vikrant.pabrekar@roswalt.com",    role: "staff",      isDoer: true,  password: "100014", phone: "+91XXXXXXXXXX" },
  { id: "15", name: "Gaurav Waman Chavan",          email: "gaurav.chavan@roswalt.com",       role: "staff",      isDoer: true,  password: "100015", phone: "+91XXXXXXXXXX" },
  { id: "16", name: "Harish Swami Utkam",           email: "harish.utkam@roswalt.com",        role: "staff",      isDoer: true,  password: "100016", phone: "+91XXXXXXXXXX" },
  { id: "17", name: "Siddhesh Santosh Achari",      email: "siddhesh.achari@roswalt.com",     role: "staff",      isDoer: true,  password: "100017", phone: "+91XXXXXXXXXX" },
  { id: "18", name: "Raj Sachin Vichare",           email: "raj.vichare@roswalt.com",         role: "staff",      isDoer: true,  password: "100018", phone: "+919321181236" },
  { id: "19", name: "Rohan Fernandes",              email: "rohan.fernandes@roswalt.com",     role: "staff",      isDoer: true,  password: "100019", phone: "+91XXXXXXXXXX" },
  { id: "20", name: "Vaibhavi Gujjeti",             email: "vaibhavi.gujjeti@roswalt.com",    role: "staff",      isDoer: true,  password: "100020", phone: "+919870826798" },
  { id: "21", name: "Isha Sawant",                  email: "isha.sawant@roswalt.com",          role: "staff",      isDoer: true,  password: "100021", phone: "+91XXXXXXXXXX" },
  { id: "22", name: "Sahil Jain",                   email: "sahil.jain@roswalt.com",           role: "admin",      isDoer: false, password: "100022" },
  { id: "23", name: "Rohit Singh",                  email: "rohit.singh@roswalt.com",          role: "admin",      isDoer: false, password: "100023" },
  { id: "24", name: "Veena Shetye",                 email: "veena.shetye@roswalt.com",         role: "admin",      isDoer: false, password: "100024" },
  { id: "25", name: "Rahul Shinde",                 email: "rahul.shinde@roswalt.com",         role: "staff",      isDoer: true,  password: "100025", phone: "+91XXXXXXXXXX" },
  { id: "26", name: "Savli Patil",                  email: "savli.patil97@gmail.com",          role: "staff",      isDoer: true,  password: "100026", phone: "+91XXXXXXXXXX" },
  { id: "27", name: "Harshil Tater",                email: "harshil.tater@roswalt.com",        role: "staff",      isDoer: true,  password: "100027", phone: "+91XXXXXXXXXX" },
  { id: "28", name: "Sanober Shaikh",               email: "sanober.shaikh@roswalt.com",       role: "staff",      isDoer: true,  password: "100028", phone: "+91XXXXXXXXXX" },
  { id: "29", name: "Arena Moitra",                 email: "arena.moitra@roswalt.com",         role: "staff",      isDoer: true,  password: "100029", phone: "+91XXXXXXXXXX" },
  { id: "30", name: "Dhairya Mehta",                email: "dhairya.mehta@roswalt.com",        role: "staff",      isDoer: true,  password: "100030", phone: "+91XXXXXXXXXX" },
  { id: "31", name: "Mahira khatri",                 email: "mahira.khatri@roswalt.com",       role: "staff",      isDoer: true,  password: "100031", phone: "+91XXXXXXXXXX" },
  { id: "32", name: "Zarana Rathod",                 email: "zarana.rathod@roswalt.com",       role: "staff",      isDoer: true,  password: "100032", phone: "+91XXXXXXXXXX" } 
  
];



// ── Helper: normalize a raw backend task so `id` is always the UUID field ────
function normalizeTask(raw: any): Task {
  return { ...raw, id: raw.id || String(raw._id) };
}

// ── Helper: normalize a raw backend project ──────────────────────────────────
function normalizeProject(raw: any): Project {
  return { ...raw, id: raw.id || String(raw._id) };
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── All state is pure in-memory — zero localStorage ───────────────────────
  const [user, setUser] = useState<User | null>(() => {
    try { const s = sessionStorage.getItem("sc_user"); return s ? JSON.parse(s) as User : null; } catch { return null; }
  });
  const [storedUsers,      setStoredUsers]      = useState<StoredUser[]>(defaultUsers);
  const [tasks,            setTasks]            = useState<Task[]>([]);
  const [projects,         setProjects]         = useState<Project[]>([]);
  const [assistanceTickets,setAssistanceTickets]= useState<AssistanceTicket[]>([]);
  const [activityLog,      setActivityLog]      = useState<ActivityEntry[]>([]);
  const [voiceAccessGranted, setVoiceAccessGranted] = useState<boolean>(false);

  // ── logActivity: append entry + persist to backend ───────────────────────
  const logActivity = (entry: Omit<ActivityEntry, "id" | "timestamp">): void => {
    const full: ActivityEntry = {
      ...entry,
      id:        "ACT-" + Date.now().toString(36).toUpperCase(),
      timestamp: new Date().toISOString(),
    };
    setActivityLog(prev => [full, ...prev].slice(0, 500));
    fetch(`${API_URL}/api/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    }).catch(() => {});
  };

  const teamMembers: User[] = storedUsers.map(({ password: _p, ...u }) => u);

  // ── Bootstrap: load tasks, projects & tickets from backend on mount ───────
  useEffect(() => {
    const u = user as any; const q = u ? `?email=${encodeURIComponent(u.email||"")}&role=${encodeURIComponent(u.role||"")}` : ""; fetch(`${API_URL}/api/tasks${q}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: any[]) => setTasks(data.map(normalizeTask)))
      .catch((err) => console.error("[UserContext] Failed to load tasks:", err));

    fetch(`${API_URL}/api/projects`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: any[]) => setProjects(data.map(normalizeProject)))
      .catch((err) => console.error("[UserContext] Failed to load projects:", err));

    // Merge backend phones into storedUsers on load
    fetch(`${API_URL}/api/users`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((backendUsers: any[]) => {
        setStoredUsers((prev) => prev.map((u) => {
          const match = backendUsers.find((b: any) => b.email === u.email);
          return match?.phone ? { ...u, phone: match.phone } : u;
        }));
      })
      .catch(() => {});

    if (u) {
      fetch(`${API_URL}/api/tickets?email=${encodeURIComponent(u.email||"")}&role=${encodeURIComponent(u.role||"")}`)
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: any[]) => setAssistanceTickets(data.map((t: any) => ({ ...t, id: t.id || String(t._id) }))))
        .catch((err) => console.error("[UserContext] Failed to load tickets:", err));

      // Load activity log — only for privileged roles; silently skip if route returns 404
      if (u.role === "superadmin" || u.role === "supremo") {
        fetch(`${API_URL}/api/activity?email=${encodeURIComponent(u.email||"")}&role=${encodeURIComponent(u.role||"")}`)
          .then((r) => {
            if (r.status === 404) return [] as any[]; // route not yet deployed — ignore
            return r.ok ? r.json() : Promise.reject(r.status);
          })
          .then((data: any[]) => setActivityLog(data))
          .catch((err) => console.warn("[UserContext] activity log unavailable:", err));
      }
    }
  }, [user?.email]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const validateLogin = (email: string, password: string): boolean =>
    !!storedUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

  const commitLogin = (email: string, password: string): void => {
    const found = storedUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (found) {
      const { password: _p, ...userWithoutPassword } = found;
      setUser(userWithoutPassword);
      setVoiceAccessGranted(true);
      try { sessionStorage.setItem("sc_user", JSON.stringify(userWithoutPassword)); } catch {}
      logActivity({ category: "auth", action: "Login", actorEmail: found.email, actorName: found.name });
    }
  };

  const loginAsUser = (u: User): void => {
    setUser(u);
    setVoiceAccessGranted(true);
  };

  const logout = (): void => {
    setUser(null);
    setVoiceAccessGranted(false);
    try { sessionStorage.removeItem("sc_user"); } catch {}
  };

  const addUser = (
    newUser: Omit<User, "id"> & { password: string }
  ): { success: boolean; message: string } => {
    const exists = storedUsers.find(
      (u) => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (exists) return { success: false, message: "Email already exists." };
    // FIX Bug 2: set isDoer based on role so newly added users have the correct field
    const newMember: StoredUser = {
      ...newUser,
      id:     Date.now().toString(),
      isDoer: newUser.role === "staff",
    };
    setStoredUsers((prev) => [...prev, newMember]);
    // FIX Bug 3: persist to backend so user survives page refresh
    fetch(`${API_URL}/api/users`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newMember),
    }).catch((err) => console.warn("[addUser] Backend persist failed:", err));
    logActivity({ category: "user", action: "User Added", actorEmail: user?.email || "", actorName: user?.name || "", targetName: newUser.name, meta: { role: newUser.role, email: newUser.email } });
    return { success: true, message: "User created successfully." };
  };

  const updateUser = (
    userId: string,
    updates: { phone?: string; name?: string; role?: Role }
  ): void => {
    setStoredUsers((prev) =>
      prev.map((u) => (u.id === userId || u.email === userId ? { ...u, ...updates } : u))
    );
  };

  const getNextOTP = (): string => {
    const otpCodes = storedUsers
      .map((u) => parseInt(u.password))
      .filter((n) => n >= 100001 && n <= 199999);
    const max = otpCodes.length > 0 ? Math.max(...otpCodes) : 100000;
    return String(max + 1);
  };

  const deleteTeamMember = (memberId: string): void =>
    setStoredUsers((prev) => prev.filter((u) => u.id !== memberId));

  // ── Tasks — every mutation hits the backend, then updates local state ─────

  const addTask = (
    task: Omit<Task, "id" | "createdAt"> & { id?: string; createdAt?: string }
  ): void => {
    const payload = {
      ...task,
      id:        task.id        ?? crypto.randomUUID(),
      createdAt: task.createdAt ?? new Date().toISOString(),
    };
    fetch(`${API_URL}/api/tasks`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((saved: any) => {
        console.log("[UserContext] addTask saved to DB:", saved.id || saved._id);
        logActivity({ category: "task", action: "Task Assigned", actorEmail: saved.assignedBy || "", actorName: saved.assignedBy || "", targetId: saved.id || String(saved._id), targetName: saved.title, meta: { assignedTo: saved.assignedTo || "", priority: saved.priority || "", dueDate: saved.dueDate || "" } });
        fetch(`${API_URL}/api/tasks`)
          .then((r) => r.ok ? r.json() : Promise.reject(r.status))
          .then((data: any[]) => setTasks(data.map(normalizeTask)))
          .catch(() => setTasks((prev) => [...prev, normalizeTask(saved)]));
      })
      .catch((err) => console.error("[UserContext] addTask failed:", err));
  };

  const updateTask = (taskId: string, updates: Partial<Task>): void => {
    // Optimistic update so the UI feels instant
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    fetch(`${API_URL}/api/tasks/${taskId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updates),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((saved: any) => {
        console.log("[UserContext] updateTask saved:", taskId, Object.keys(updates));
        setTasks((prev) => prev.map((t) => (t.id === taskId ? normalizeTask(saved) : t)));
      })
      .catch((err) => console.error("[UserContext] updateTask failed:", err));
  };

  const updateTaskStatus = (taskId: string, status: Task["status"], notes?: string): void => {
    const updates: Partial<Task> = { status, ...(notes !== undefined ? { completionNotes: notes } : {}) };
    updateTask(taskId, updates);
  };

  const submitTaskCompletion = (taskId: string, notes: string): void => {
    updateTask(taskId, {
      status:          "completed",
      completionNotes: notes,
      approvalStatus:  "in-review",
      completedAt:     new Date().toISOString(),
    });
  };

  const adminReviewTask = (taskId: string, approved: boolean, comments: string): void => {
    const task = tasks.find(t => t.id === taskId);
    updateTask(taskId, {
      adminApproved:   approved,
      adminComments:   comments,
      adminReviewedBy: user?.name || "Admin",
      approvalStatus:  approved ? "admin-approved" : "rejected",
      status:          approved ? "approved" : "rework",
    });
    logActivity({ category: "approval", action: approved ? "Task Admin-Approved" : "Task Sent for Rework", actorEmail: user?.email || "", actorName: user?.name || "Admin", targetId: taskId, targetName: task?.title || taskId, meta: { comments } });
  };

  const superadminReviewTask = (taskId: string, approved: boolean, comments: string): void => {
    const task = tasks.find(t => t.id === taskId);
    updateTask(taskId, {
      approvalStatus:  approved ? "superadmin-approved" : "rejected",
      adminComments:   comments,
      adminReviewedBy: user?.name || "Superadmin",
      status:          approved ? "approved" : "rework",
    });
    logActivity({ category: "approval", action: approved ? "Task Superadmin-Approved" : "Task Rejected by Superadmin", actorEmail: user?.email || "", actorName: user?.name || "Superadmin", targetId: taskId, targetName: task?.title || taskId, meta: { comments } });
  };

  const deleteTask = (id: string): void => {
    const task = tasks.find(t => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    logActivity({ category: "task", action: "Task Deleted", actorEmail: user?.email || "", actorName: user?.name || "", targetId: id, targetName: task?.title || id });
    fetch(`${API_URL}/api/tasks/${id}`, { method: "DELETE" })
      .catch((err) => console.error("[UserContext] deleteTask failed:", err));
  };

  const deleteAllTasks = (): void => {
    setTasks([]);
    fetch(`${API_URL}/api/tasks/all`, { method: "DELETE" })
      .catch((err) => console.error("[UserContext] deleteAllTasks failed:", err));
  };

  // ── Task queries ──────────────────────────────────────────────────────────
  const getTasksForAdminReview = (): Task[] =>
    tasks.filter(
      (t) =>
        t.approvalStatus === "in-review" &&
        (t.assignedBy ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
    );

  const getTasksForSuperadminReview = (): Task[] =>
    tasks.filter((t) => t.approvalStatus === "admin-approved");

  const getTasksForUser = (email: string): Task[] =>
    tasks.filter((t) => t.assignedTo.toLowerCase() === email.toLowerCase());

  const getAssignedTasks = (): Task[] => {
    if (!user) return [];
    return tasks.filter((t) => (t.assignedTo ?? "").toLowerCase() === user.email.toLowerCase());
  };

  const getProjectById = (id: string): Project | undefined =>
    projects.find((p) => p.id === id);

  const getTaskById = (id: string): Task | undefined =>
    tasks.find((t) => t.id === id);

  // ── Projects ──────────────────────────────────────────────────────────────
  const addProject = (project: Omit<Project, "id">): void => {
    const payload = {
      ...project,
      callerRole: user?.role ?? "superadmin", // required by requireRole middleware
    };
    fetch(`${API_URL}/api/projects`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    })
      .then((r) => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
      .then((saved: any) => {
        setProjects((prev) => [normalizeProject(saved), ...prev]);
        logActivity({ category: "project", action: "Project Created", actorEmail: user?.email || "", actorName: user?.name || "", targetId: saved.id || String(saved._id), targetName: saved.name });
      })
      .catch((err) => console.error("[UserContext] addProject failed:", JSON.stringify(err)));
  };

  // ── Assistance Tickets (in-memory only — no backend endpoint yet) ─────────
  const raiseAssistanceTicket = (
    ticket: Omit<AssistanceTicket, "id" | "raisedAt" | "status">
  ): void => {
    // For non-delete tickets: deduplicate by taskId
    if (ticket.ticketType !== "delete-request") {
      const existing = assistanceTickets.find(
        (t) => t.taskId === ticket.taskId && t.status !== "resolved" && t.status !== "rejected"
      );
      if (existing) return;
    }
    const newTicket: AssistanceTicket = {
      ...ticket,
      id:       "TKT-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase(),
      raisedAt: new Date().toISOString(),
      status:   ticket.ticketType === "delete-request" ? "superadmin-pending" : "open",
    };
    setAssistanceTickets((prev) => [...prev, newTicket]);
    logActivity({ category: "ticket", action: `Ticket Raised: ${newTicket.ticketType}`, actorEmail: newTicket.assignedBy, actorName: newTicket.raisedBy, targetId: newTicket.id, targetName: newTicket.taskTitle, meta: { assignedTo: newTicket.assignedTo, type: newTicket.ticketType } });
    fetch(`${API_URL}/api/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTicket),
    }).catch((err) => console.error("[UserContext] raiseAssistanceTicket persist failed:", err));
  };

  const updateAssistanceTicket = (ticketId: string, updates: Partial<AssistanceTicket>): void => {
    setAssistanceTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, ...updates } : t))
    );
    fetch(`${API_URL}/api/tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch((err) => console.error("[UserContext] updateAssistanceTicket persist failed:", err));
  };

  const submitTicketToAdmin = (ticketId: string): void => {
    const updates = { status: "pending-admin" as const };
    setAssistanceTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, ...updates } : t))
    );
    const ticket = assistanceTickets.find((t) => t.id === ticketId);
    if (ticket) {
      updateTask(ticket.taskId, { isFrozen: true, frozenTicketId: ticketId });
    }
    fetch(`${API_URL}/api/tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch((err) => console.error("[UserContext] submitTicketToAdmin persist failed:", err));
  };

  const approveAssistanceTicket = (ticketId: string, adminComment: string): void => {
    const ticket = assistanceTickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    setAssistanceTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status:     "admin-approved",
              adminComment,
              approvedAt: new Date().toISOString(),
              approvedBy: user?.name ?? "Admin",
            }
          : t
      )
    );
    updateTask(ticket.taskId, { isFrozen: false, frozenTicketId: undefined });
    logActivity({ category: "ticket", action: "Ticket Approved", actorEmail: user?.email || "", actorName: user?.name || "Admin", targetId: ticketId, targetName: ticket.taskTitle, meta: { comment: adminComment } });
    fetch(`${API_URL}/api/tickets/${ticketId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "admin-approved", adminComment, approvedAt: new Date().toISOString(), approvedBy: user?.name ?? "Admin" }),
    }).catch(() => {});
  };

  const rejectAssistanceTicket = (ticketId: string, reason: string): void => {
    const ticket = assistanceTickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const updates = { status: "rejected" as const, rejectionReason: reason, rejectedAt: new Date().toISOString(), rejectedBy: user?.name ?? "Admin" };
    setAssistanceTickets((prev) =>
      prev.map((t) => t.id === ticketId ? { ...t, ...updates } : t)
    );
    updateTask(ticket.taskId, { isFrozen: false, frozenTicketId: undefined });
    fetch(`${API_URL}/api/tickets/${ticketId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(() => {});
  };

  // Superadmin approves/rejects delete-request tickets
  const superadminApproveTicket = (ticketId: string, approve: boolean, comment: string): void => {
    const ticket = assistanceTickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    if (approve) {
      const updates = { status: "superadmin-approved" as const, adminComment: comment, superadminApprovedAt: new Date().toISOString(), superadminApprovedBy: user?.name ?? "Superadmin" };
      setAssistanceTickets((prev) =>
        prev.map((t) => t.id === ticketId ? { ...t, ...updates } : t)
      );
      if (ticket.ticketType === "delete-request") {
        const taskToDelete = ticket.targetTaskId || ticket.taskId;
        if (taskToDelete) deleteTask(taskToDelete);
      } else {
        // Non-delete tickets: unfreeze the task when superadmin approves
        updateTask(ticket.taskId, { isFrozen: false, frozenTicketId: undefined });
      }
      fetch(`${API_URL}/api/tickets/${ticketId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {});
    } else {
      const updates = { status: "rejected" as const, rejectionReason: comment, rejectedAt: new Date().toISOString(), rejectedBy: user?.name ?? "Superadmin" };
      setAssistanceTickets((prev) =>
        prev.map((t) => t.id === ticketId ? { ...t, ...updates } : t)
      );
      // Always unfreeze task when superadmin rejects the ticket
      updateTask(ticket.taskId, { isFrozen: false, frozenTicketId: undefined });
      fetch(`${API_URL}/api/tickets/${ticketId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {});
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        teamMembers,
        tasks,
        projects,
        voiceAccessGranted,
        validateLogin,
        commitLogin,
        loginAsUser,
        logout,
        addUser,
        updateUser,
        getNextOTP,
        deleteTeamMember,
        addTask,
        updateTask,
        updateTaskStatus,
        adminReviewTask,
        superadminReviewTask,
        getTasksForAdminReview,
        getTasksForSuperadminReview,
        getTasksForUser,
        getAssignedTasks,
        submitTaskCompletion,
        getProjectById,
        getTaskById,
        deleteTask,
        deleteAllTasks,
        addProject,
        assistanceTickets,
        raiseAssistanceTicket,
        updateAssistanceTicket,
        submitTicketToAdmin,
        approveAssistanceTicket,
        rejectAssistanceTicket,
        superadminApproveTicket,
        activityLog,
        logActivity,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be inside UserProvider");
  return context;
};