import React, { createContext, useContext, useState, useEffect } from "react";

const API_URL = process.env.REACT_APP_API_URL || "https://roswalt-backend-production.up.railway.app";

// ── CHANGE 1: Added "supremo" to the Role type ───────────────────────────────
export type Role = "staff" | "admin" | "superadmin" | "supremo";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isDoer: boolean;
  phone?: string;
}

export interface AssistanceTicket {
  id:           string;
  taskId:       string;
  taskTitle:    string;
  taskDueDate:  string;
  assignedTo:   string;
  assignedBy:   string;
  raisedAt:     string;
  status:       "open" | "pending-admin" | "admin-approved" | "resolved";
  reason:       string;
  staffNote:    string;
  adminComment?: string;
  approvedAt?:  string;
  approvedBy?:  string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  by: string;
  to?: string;
  notes?: string;
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
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface StoredUser extends User {
  password: string;
}

// ── CHANGE 2: Added Supremo user ─────────────────────────────────────────────
const defaultUsers: StoredUser[] = [
  { id: "0",  name: "Supremo",                      email: "supremo@roswalt.com",             role: "supremo",    isDoer: false, password: "000000" },
  { id: "1",  name: "Pushkaraj Gore",               email: "pushkaraj.gore@roswalt.com",      role: "superadmin", isDoer: false, password: "100001" },
  { id: "2",  name: "Aziz Ashfaq Khan",             email: "aziz.khan@roswalt.com",           role: "admin",      isDoer: false, password: "100002" },
  { id: "3",  name: "Vinay Dinkar Vanmali",         email: "vinay.vanmali@roswalt.com",       role: "admin",      isDoer: false, password: "100003" },
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
  const [user,             setUser]             = useState<User | null>(null);
  const [storedUsers,      setStoredUsers]      = useState<StoredUser[]>(defaultUsers);
  const [tasks,            setTasks]            = useState<Task[]>([]);
  const [projects,         setProjects]         = useState<Project[]>([]);
  const [assistanceTickets,setAssistanceTickets]= useState<AssistanceTicket[]>([]);
  const [voiceAccessGranted, setVoiceAccessGranted] = useState<boolean>(false);

  const teamMembers: User[] = storedUsers.map(({ password: _p, ...u }) => u);

  // ── Bootstrap: load tasks & projects from backend on mount ───────────────
  useEffect(() => {
    fetch(`${API_URL}/api/tasks`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: any[]) => setTasks(data.map(normalizeTask)))
      .catch((err) => console.error("[UserContext] Failed to load tasks:", err));

    fetch(`${API_URL}/api/projects`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: any[]) => setProjects(data.map(normalizeProject)))
      .catch((err) => console.error("[UserContext] Failed to load projects:", err));
  }, []);

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
    }
  };

  const loginAsUser = (u: User): void => {
    setUser(u);
    setVoiceAccessGranted(true);
  };

  const logout = (): void => {
    setUser(null);
    setVoiceAccessGranted(false);
  };

  const addUser = (
    newUser: Omit<User, "id"> & { password: string }
  ): { success: boolean; message: string } => {
    const exists = storedUsers.find(
      (u) => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (exists) return { success: false, message: "Email already exists." };
    setStoredUsers((prev) => [...prev, { ...newUser, id: Date.now().toString() }]);
    return { success: true, message: "User created successfully." };
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
      .then((saved: any) => setTasks((prev) => [...prev, normalizeTask(saved)]))
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
      .then((saved: any) =>
        setTasks((prev) => prev.map((t) => (t.id === taskId ? normalizeTask(saved) : t)))
      )
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
    updateTask(taskId, {
      adminApproved:   approved,
      adminComments:   comments,
      adminReviewedBy: user?.name || "Admin",
      approvalStatus:  approved ? "admin-approved" : "rejected",
      status:          approved ? "approved" : "rework",
    });
  };

  const superadminReviewTask = (taskId: string, approved: boolean, comments: string): void => {
    updateTask(taskId, {
      approvalStatus:  approved ? "superadmin-approved" : "rejected",
      adminComments:   comments,
      adminReviewedBy: user?.name || "Superadmin",
      status:          approved ? "approved" : "rework",
    });
  };

  const deleteTask = (id: string): void => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
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
      .then((saved: any) => setProjects((prev) => [normalizeProject(saved), ...prev]))
      .catch((err) => console.error("[UserContext] addProject failed:", JSON.stringify(err)));
  };

  // ── Assistance Tickets (in-memory only — no backend endpoint yet) ─────────
  const raiseAssistanceTicket = (
    ticket: Omit<AssistanceTicket, "id" | "raisedAt" | "status">
  ): void => {
    const existing = assistanceTickets.find(
      (t) => t.taskId === ticket.taskId && t.status !== "resolved"
    );
    if (existing) return;
    const newTicket: AssistanceTicket = {
      ...ticket,
      id:       "TKT-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase(),
      raisedAt: new Date().toISOString(),
      status:   "open",
    };
    setAssistanceTickets((prev) => [...prev, newTicket]);
  };

  const updateAssistanceTicket = (ticketId: string, updates: Partial<AssistanceTicket>): void =>
    setAssistanceTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, ...updates } : t))
    );

  const submitTicketToAdmin = (ticketId: string): void => {
    setAssistanceTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: "pending-admin" } : t))
    );
    const ticket = assistanceTickets.find((t) => t.id === ticketId);
    if (ticket) {
      updateTask(ticket.taskId, { isFrozen: true, frozenTicketId: ticketId });
    }
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



