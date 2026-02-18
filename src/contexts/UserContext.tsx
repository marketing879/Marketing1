import React, { createContext, useContext, useState, useEffect } from "react";

// Helper: load from localStorage with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Helper: save to localStorage
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
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "approved" | "rework";
  priority: "low" | "medium" | "high";
  dueDate: string;
  assignedTo: string;
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
}

export interface Project {
  id: string;
  name: string;
}

interface UserContextType {
  user: User | null;
  teamMembers: User[];
  tasks: Task[];
  login: (email: string, password: string) => boolean;
  loginAsUser: (user: User) => void;
  logout: () => void;
  addUser: (user: Omit<User, "id"> & { password: string }) => {
    success: boolean;
    message: string;
  };
  addTask: (task: Omit<Task, "id" | "approvalStatus" | "createdAt">) => void;
  updateTaskStatus: (
    taskId: string,
    status: Task["status"],
    notes?: string
  ) => void;
  adminReviewTask: (
    taskId: string,
    approved: boolean,
    comments: string
  ) => void;
  superadminReviewTask: (
    taskId: string,
    approved: boolean,
    comments: string
  ) => void;
  getTasksForAdminReview: () => Task[];
  getTasksForSuperadminReview: () => Task[];
  getTasksForUser: (email: string) => Task[];
  getAssignedTasks: () => Task[];
  submitTaskCompletion: (taskId: string, notes: string) => void;
  getProjectById: (id: string) => Project | undefined;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface StoredUser extends User {
  password: string;
}

const defaultUsers: StoredUser[] = [
  {
    id: "1",
    name: "Pushkaraj Gore",
    email: "pushkaraj.gore@roswalt.com",
    role: "superadmin",
    password: "100001",
  },
  {
    id: "2",
    name: "Aziz Ashfaq Khan",
    email: "aziz.khan@roswalt.com",
    role: "admin",
    password: "100002",
  },
  {
    id: "3",
    name: "Vinay Dinkar Vanmali",
    email: "vinay.vanmali@roswalt.com",
    role: "admin",
    password: "100003",
  },
  {
    id: "4",
    name: "Jalal Chandmiya Shaikh",
    email: "jalal.shaikh@roswalt.com",
    role: "admin",
    password: "100004",
  },
  {
    id: "5",
    name: "Nidhi Mehta",
    email: "nidhi.mehta@roswalt.com",
    role: "admin",
    password: "100005",
  },
  {
    id: "6",
    name: "Keerti Barua",
    email: "keerti.barua@roswalt.com",
    role: "admin",
    password: "100006",
  },
  {
    id: "7",
    name: "Hetal Makwana",
    email: "hetal.makwana@roswalt.com",
    role: "admin",
    password: "100007",
  },
  {
    id: "8",
    name: "Prathamesh Vijay Chile",
    email: "prathamesh.chile@roswalt.com",
    role: "staff",
    password: "100008",
  },
  {
    id: "9",
    name: "Samruddhi C Shivgan",
    email: "samruddhi.shivgan@roswalt.com",
    role: "staff",
    password: "100009",
  },
  {
    id: "10",
    name: "Irfan S. Ansari",
    email: "irfan.ansari@roswalt.com",
    role: "staff",
    password: "100010",
  },
  {
    id: "11",
    name: "Vishal Chaudhary",
    email: "vishal.chaudhary@roswalt.com",
    role: "staff",
    password: "100011",
  },
  {
    id: "12",
    name: "Mithilesh Viinayak Menge",
    email: "mithilesh.menge@roswalt.com",
    role: "staff",
    password: "100012",
  },
  {
    id: "13",
    name: "Jai Bhojwani",
    email: "jai.bhojwani@roswalt.com",
    role: "staff",
    password: "100013",
  },
  {
    id: "14",
    name: "Vikrant Swami Pabrekar",
    email: "vikrant.pabrekar@roswalt.com",
    role: "staff",
    password: "100014",
  },
  {
    id: "15",
    name: "Gaurav Waman Chavan",
    email: "gaurav.chavan@roswalt.com",
    role: "staff",
    password: "100015",
  },
  {
    id: "16",
    name: "Harish Swami Utkam",
    email: "harish.utkam@roswalt.com",
    role: "staff",
    password: "100016",
  },
  {
    id: "17",
    name: "Siddhesh Santosh Achari",
    email: "siddhesh.achari@roswalt.com",
    role: "staff",
    password: "100017",
  },
  {
    id: "18",
    name: "Raj Sachin Vichare",
    email: "raj.vichare@roswalt.com",
    role: "staff",
    password: "100018",
  },
  {
    id: "19",
    name: "Rohan Fernandes",
    email: "rohan.fernandes@roswalt.com",
    role: "staff",
    password: "100019",
  },
  {
    id: "20",
    name: "Vaibhavi Gujjeti",
    email: "vaibhavi.gujjeti@roswalt.com",
    role: "staff",
    password: "100020",
  },
];

const defaultProjects: Project[] = [
  { id: "1", name: "General" },
  { id: "2", name: "Website Redesign" },
  { id: "3", name: "Marketing Campaign" },
  { id: "4", name: "Product Launch" },
];

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() =>
    loadFromStorage<User | null>("tf_user", null)
  );
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(() => {
    const saved = loadFromStorage<StoredUser[]>("tf_users", []);
    // Merge defaults with saved users, keeping saved if they exist
    const merged = [...defaultUsers];
    saved.forEach((savedUser) => {
      if (
        !merged.find(
          (u) => u.email.toLowerCase() === savedUser.email.toLowerCase()
        )
      ) {
        merged.push(savedUser);
      }
    });
    return merged;
  });
  const [tasks, setTasks] = useState<Task[]>(() =>
    loadFromStorage<Task[]>("tf_tasks", [])
  );

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveToStorage("tf_user", user);
  }, [user]);
  useEffect(() => {
    // Only save non-default users to avoid duplicating defaults
    const addedUsers = storedUsers.filter(
      (u) =>
        !defaultUsers.find(
          (d) => d.email.toLowerCase() === u.email.toLowerCase()
        )
    );
    saveToStorage("tf_users", addedUsers);
  }, [storedUsers]);
  useEffect(() => {
    saveToStorage("tf_tasks", tasks);
  }, [tasks]);

  const teamMembers: User[] = storedUsers.map(
    ({ password: _pw, ...rest }) => rest
  );

  const login = (email: string, password: string): boolean => {
    const found = storedUsers.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return false;
    const { password: _pw, ...publicUser } = found;
    setUser(publicUser);
    return true;
  };

  const loginAsUser = (u: User) => {
    setUser(u);
  };

  const logout = () => {
    setUser(null);
    saveToStorage("tf_user", null);
  };

  const addUser = (
    newUser: Omit<User, "id"> & { password: string }
  ): { success: boolean; message: string } => {
    const exists = storedUsers.some(
      (u) => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (exists)
      return {
        success: false,
        message: "A user with this email already exists.",
      };
    if (!newUser.password || newUser.password.length < 6)
      return {
        success: false,
        message: "Password must be at least 6 characters.",
      };
    setStoredUsers((prev) => [
      ...prev,
      { ...newUser, id: Date.now().toString() },
    ]);
    return { success: true, message: `${newUser.name} added successfully.` };
  };

  const addTask = (task: Omit<Task, "id" | "approvalStatus" | "createdAt">) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      approvalStatus: "assigned",
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const updateTaskStatus = (
    taskId: string,
    status: Task["status"],
    notes?: string
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              ...(notes !== undefined ? { completionNotes: notes } : {}),
            }
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
              status: "completed",
              completionNotes: notes,
              approvalStatus: "in-review",
            }
          : t
      )
    );
  };

  const adminReviewTask = (
    taskId: string,
    approved: boolean,
    comments: string
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              adminApproved: approved,
              adminComments: comments,
              adminReviewedBy: user?.name || "Admin",
              approvalStatus: approved ? "admin-approved" : "rejected",
              status: approved ? "approved" : "rework",
            }
          : t
      )
    );
  };

  const superadminReviewTask = (
    taskId: string,
    approved: boolean,
    comments: string
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              approvalStatus: approved ? "superadmin-approved" : "rejected",
              adminComments: comments,
              adminReviewedBy: user?.name || "Superadmin",
              status: approved ? "approved" : "rework",
            }
          : t
      )
    );
  };

  const getTasksForAdminReview = (): Task[] =>
    tasks.filter((t) => t.approvalStatus === "in-review");

  const getTasksForSuperadminReview = (): Task[] =>
    tasks.filter((t) => t.approvalStatus === "admin-approved");

  const getTasksForUser = (email: string): Task[] =>
    tasks.filter((t) => t.assignedTo.toLowerCase() === email.toLowerCase());

  const getAssignedTasks = (): Task[] => {
    if (!user) return [];
    return tasks.filter(
      (t) => t.assignedTo.toLowerCase() === user.email.toLowerCase()
    );
  };

  const getProjectById = (id: string): Project | undefined =>
    defaultProjects.find((p) => p.id === id);

  return (
    <UserContext.Provider
      value={{
        user,
        teamMembers,
        tasks,
        login,
        loginAsUser,
        logout,
        addUser,
        addTask,
        updateTaskStatus,
        adminReviewTask,
        superadminReviewTask,
        getTasksForAdminReview,
        getTasksForSuperadminReview,
        getTasksForUser,
        getAssignedTasks,
        submitTaskCompletion,
        getProjectById,
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
