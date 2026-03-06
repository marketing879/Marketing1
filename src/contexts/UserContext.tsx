import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { announceVoice } from "../services/VoiceModule";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export type Role = "staff" | "admin" | "superadmin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isDoer: boolean;
  phone?: string;
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
  // Step 1 — validate only, sets NO state (no redirect triggered)
  validateLogin: (email: string, password: string) => boolean;
  // Step 2 — called by Login.tsx AFTER voice finishes, sets user + opens gate
  commitLogin: (email: string, password: string) => void;
  loginAsUser: (user: User) => void;
  logout: () => void;
  addUser: (user: Omit<User, "id"> & { password: string }) => {
    success: boolean;
    message: string;
  };
  deleteTeamMember: (memberId: string) => void;
  addTask: (task: Omit<Task, "id" | "createdAt">) => void;
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
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface StoredUser extends User {
  password: string;
}

const defaultUsers: StoredUser[] = [
  { id: "1",  name: "Pushkaraj Gore",            email: "pushkaraj.gore@roswalt.com",      role: "superadmin", isDoer: false, password: "100001" },
  { id: "2",  name: "Aziz Ashfaq Khan",           email: "aziz.khan@roswalt.com",           role: "admin",      isDoer: false, password: "100002" },
  { id: "3",  name: "Vinay Dinkar Vanmali",        email: "vinay.vanmali@roswalt.com",       role: "admin",      isDoer: false, password: "100003" },
  { id: "4",  name: "Jalal Chandmiya Shaikh",      email: "jalal.shaikh@roswalt.com",        role: "admin",      isDoer: false, password: "100004" },
  { id: "5",  name: "Nidhi Mehta",                 email: "nidhi.mehta@roswalt.com",         role: "admin",      isDoer: false, password: "100005" },
  { id: "6",  name: "Keerti Barua",                email: "keerti.barua@roswalt.com",        role: "admin",      isDoer: false, password: "100006" },
  { id: "7",  name: "Hetal Makwana",               email: "hetal.makwana@roswalt.com",       role: "admin",      isDoer: false, password: "100007" },
  { id: "8",  name: "Prathamesh Vijay Chile",      email: "prathamesh.chile@roswalt.com",    role: "staff",      isDoer: true,  password: "100008", phone: "+91XXXXXXXXXX" },
  { id: "9",  name: "Samruddhi C Shivgan",         email: "samruddhi.shivgan@roswalt.com",   role: "staff",      isDoer: true,  password: "100009", phone: "+91XXXXXXXXXX" },
  { id: "10", name: "Irfan S. Ansari",             email: "irfan.ansari@roswalt.com",        role: "staff",      isDoer: true,  password: "100010", phone: "+91XXXXXXXXXX" },
  { id: "11", name: "Vishal Chaudhary",            email: "vishal.chaudhary@roswalt.com",    role: "staff",      isDoer: true,  password: "100011", phone: "+91XXXXXXXXXX" },
  { id: "12", name: "Mithilesh Viinayak Menge",    email: "mithilesh.menge@roswalt.com",     role: "staff",      isDoer: true,  password: "100012", phone: "+91XXXXXXXXXX" },
  { id: "13", name: "Jai Bhojwani",                email: "jai.bhojwani@roswalt.com",        role: "staff",      isDoer: true,  password: "100013", phone: "+91XXXXXXXXXX" },
  { id: "14", name: "Vikrant Swami Pabrekar",      email: "vikrant.pabrekar@roswalt.com",    role: "staff",      isDoer: true,  password: "100014", phone: "+91XXXXXXXXXX" },
  { id: "15", name: "Gaurav Waman Chavan",         email: "gaurav.chavan@roswalt.com",       role: "staff",      isDoer: true,  password: "100015", phone: "+91XXXXXXXXXX" },
  { id: "16", name: "Harish Swami Utkam",          email: "harish.utkam@roswalt.com",        role: "staff",      isDoer: true,  password: "100016", phone: "+91XXXXXXXXXX" },
  { id: "17", name: "Siddhesh Santosh Achari",     email: "siddhesh.achari@roswalt.com",     role: "staff",      isDoer: true,  password: "100017", phone: "+91XXXXXXXXXX" },
  { id: "18", name: "Raj Sachin Vichare",          email: "raj.vichare@roswalt.com",         role: "staff",      isDoer: true,  password: "100018", phone: "+919321181236" },
  { id: "19", name: "Rohan Fernandes",             email: "rohan.fernandes@roswalt.com",     role: "staff",      isDoer: true,  password: "100019", phone: "+91XXXXXXXXXX" },
  { id: "20", name: "Vaibhavi Gujjeti",            email: "vaibhavi.gujjeti@roswalt.com",    role: "staff",      isDoer: true,  password: "100020", phone: "+91XXXXXXXXXX" },
];

const defaultProjects: Project[] = [
  { id: "1", name: "General",            color: "#6366F1", projectCode: "GEN-001", concernedDoerEmail: "", launchDate: "", status: "active" },
  { id: "2", name: "Website Redesign",   color: "#3B82F6", projectCode: "WEB-001", concernedDoerEmail: "", launchDate: "", status: "active" },
  { id: "3", name: "Marketing Campaign", color: "#EC4899", projectCode: "MKT-001", concernedDoerEmail: "", launchDate: "", status: "active" },
  { id: "4", name: "Product Launch",     color: "#10B981", projectCode: "PRD-001", concernedDoerEmail: "", launchDate: "", status: "active" },
];

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() =>
    loadFromStorage<User | null>("tf_user", null)
  );
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(() => {
    const saved = loadFromStorage<StoredUser[]>("tf_users", []);
    const merged = [...defaultUsers];
    saved.forEach((savedUser) => {
      if (!merged.find((u) => u.email.toLowerCase() === savedUser.email.toLowerCase())) {
        merged.push(savedUser);
      }
    });
    return merged;
  });
  const [tasks, setTasks] = useState<Task[]>(() =>
    loadFromStorage<Task[]>("tf_tasks", [])
  );
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = loadFromStorage<Project[]>("tf_projects", defaultProjects);
    return saved.map((p) => ({
      ...p,
      projectCode:        p.projectCode        ?? "",
      concernedDoerEmail: p.concernedDoerEmail ?? "",
      launchDate:         p.launchDate         ?? "",
      status:             (p.status            ?? "active") as "active" | "inactive",
    }));
  });

  const [voiceAccessGranted, setVoiceAccessGranted] = useState<boolean>(false);
  const welcomeSpoken = useRef(false);

  useEffect(() => { saveToStorage("tf_user",     user);     }, [user]);
  useEffect(() => {
    const addedUsers = storedUsers.filter(
      (u) => !defaultUsers.find((d) => d.email.toLowerCase() === u.email.toLowerCase())
    );
    saveToStorage("tf_users", addedUsers);
  }, [storedUsers]);
  useEffect(() => { saveToStorage("tf_tasks",    tasks);    }, [tasks]);
  useEffect(() => { saveToStorage("tf_projects", projects); }, [projects]);
  useEffect(() => {
    if (welcomeSpoken.current) return;
    welcomeSpoken.current = true;
    announceVoice("Welcome_Login");
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/api/projects")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: any[]) => {
        const normalised: Project[] = data.map((p) => ({
          id:                 p._id ?? p.id,
          name:               p.name,
          description:        p.description ?? "",
          color:              p.color ?? "#c9a96e",
          projectCode:        p.projectCode ?? "",
          concernedDoerEmail: p.concernedDoerEmail ?? "",
          launchDate:         p.launchDate ?? "",
          status:             p.status ?? "active",
        }));
        if (normalised.length > 0) setProjects(normalised);
      })
      .catch(() => {});
  }, []);

  const teamMembers: User[] = storedUsers.map(({ password: _pw, ...rest }) => rest);

  // ── STEP 1: validate only — no state changes, no redirect triggered ─────
  const validateLogin = (email: string, password: string): boolean => {
    return !!storedUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
  };

  // ── STEP 2: called by Login.tsx AFTER "Access Granted" voice finishes ────
  // Only now does user state get set, which triggers route guards.
  const commitLogin = (email: string, password: string): void => {
    const found = storedUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return;
    const { password: _pw, ...publicUser } = found;
    setVoiceAccessGranted(true);
    setUser(publicUser);
  };

  const loginAsUser = (u: User) => {
    setUser(u);
  };

  const logout = () => {
    setUser(null);
    setVoiceAccessGranted(false);
    saveToStorage("tf_user", null);
  };

  const addUser = (
    newUser: Omit<User, "id"> & { password: string }
  ): { success: boolean; message: string } => {
    const exists = storedUsers.some(
      (u) => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (exists) return { success: false, message: "A user with this email already exists." };
    if (!newUser.password || newUser.password.length < 6)
      return { success: false, message: "Password must be at least 6 characters." };
    setStoredUsers((prev) => [...prev, { ...newUser, id: Date.now().toString() }]);
    return { success: true, message: `${newUser.name} added successfully.` };
  };

  const deleteTeamMember = (memberId: string) => {
    setStoredUsers((prev) => prev.filter((u) => u.id !== memberId));
    setTasks((prev) => {
      const member = storedUsers.find((u) => u.id === memberId);
      if (!member) return prev;
      return prev.map((task) =>
        task.assignedTo === member.email ? { ...task, assignedTo: "" } : task
      );
    });
  };

  const addTask = (task: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = {
      ...task,
      id:        Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const updateTask = (taskId: string, updatedTaskData: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updatedTaskData } : task
      )
    );
  };

  const updateTaskStatus = (taskId: string, status: Task["status"], notes?: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status, ...(notes !== undefined ? { completionNotes: notes } : {}) }
          : t
      )
    );
  };

  const submitTaskCompletion = (taskId: string, notes: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status:          "completed",
              completionNotes: notes,
              approvalStatus:  "in-review",
              completedAt:     new Date().toISOString(),
            }
          : t
      )
    );
  };

  const adminReviewTask = (taskId: string, approved: boolean, comments: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              adminApproved:   approved,
              adminComments:   comments,
              adminReviewedBy: user?.name || "Admin",
              approvalStatus:  approved ? "admin-approved" : "rejected",
              status:          approved ? "approved" : "rework",
            }
          : t
      )
    );
  };

  const superadminReviewTask = (taskId: string, approved: boolean, comments: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              approvalStatus:  approved ? "superadmin-approved" : "rejected",
              adminComments:   comments,
              adminReviewedBy: user?.name || "Superadmin",
              status:          approved ? "approved" : "rework",
            }
          : t
      )
    );
  };

  const getTasksForAdminReview = (): Task[] =>
    tasks.filter((t) =>
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

  const deleteTask = (id: string): void => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const deleteAllTasks = (): void => {
    setTasks([]);
  };

  const addProject = (project: Omit<Project, "id">) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: project.name,
      description: project.description ?? "",
      color: project.color ?? "#c9a96e",
      projectCode: project.projectCode ?? "",
      concernedDoerEmail: project.concernedDoerEmail ?? "",
      launchDate: project.launchDate ?? "",
      status: project.status ?? "active",
    };
    setProjects((prev) => [...prev, newProject]);
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