// ── SmartCue Notification Service ────────────────────────────────────────────
// Handles:
//   1. Browser Notification API permission request
//   2. Service Worker registration (for background push)
//   3. Web Push subscription (sent to backend)
//   4. Real-time socket.io task_notification events (for online users)
//   5. Showing notifications for all roles based on the event type

const API = "https://api.roswaltsmartcue.com";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TaskNotificationEvent {
  type:        "task_assigned" | "task_status_changed";
  taskId:      string;
  taskTitle:   string;
  assignedTo?: string;
  assignedBy?: string;
  newStatus?:  string;
  priority?:   string;
  dueDate?:    string;
  projectId?:  string;
}

interface CurrentUser {
  email: string;
  role:  "superadmin" | "supremo" | "admin" | "staff";
  name?: string;
}

// ── Convert VAPID base64 to Uint8Array ────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
return Uint8Array.from(Array.from(raw).map((char: string) => char.charCodeAt(0)));
}


// ── Register service worker ───────────────────────────────────────────────────
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("[Notifications] Service Worker not supported in this browser.");
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[Notifications] Service Worker registered:", reg.scope);

    // Listen for messages from the SW (e.g. notification clicked)
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "NOTIFICATION_CLICKED") {
        // Optionally navigate to the task
        const taskId = event.data.taskId;
        if (taskId) {
          console.log("[Notifications] SW click → task:", taskId);
          // You can fire a custom event or navigate here if needed
          window.dispatchEvent(new CustomEvent("smartcue_notif_click", { detail: { taskId } }));
        }
      }
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        // Re-register the new subscription
        const user = getCurrentUser();
        if (user && event.data.subscription) {
          saveSubscriptionToServer(user.email, event.data.subscription);
        }
      }
    });

    return reg;
  } catch (err) {
    console.error("[Notifications] SW registration failed:", err);
    return null;
  }
}

// ── Request notification permission ──────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// ── Save push subscription to backend ────────────────────────────────────────
async function saveSubscriptionToServer(email: string, subscription: PushSubscription): Promise<void> {
  try {
    await fetch(`${API}/api/push/subscribe`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, subscription }),
    });
    console.log("[Notifications] Push subscription saved for", email);
  } catch (err) {
    console.error("[Notifications] Failed to save push subscription:", err);
  }
}

// ── Subscribe to Web Push ─────────────────────────────────────────────────────
async function subscribeToPush(reg: ServiceWorkerRegistration, email: string): Promise<void> {
  try {
    // Fetch VAPID public key from backend
    const res = await fetch(`${API}/api/push/vapid-public-key`);
    if (!res.ok) {
      console.warn("[Notifications] Push not configured on server — skipping push subscription.");
      return;
    }
    const { publicKey } = await res.json();
    if (!publicKey) return;

    // Check if already subscribed
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log("[Notifications] New push subscription created");
    }

    await saveSubscriptionToServer(email, sub);
  } catch (err) {
    console.error("[Notifications] Push subscription error:", err);
  }
}

// ── Store current user so the SW message handler can access it ───────────────
let _currentUser: CurrentUser | null = null;

function getCurrentUser(): CurrentUser | null {
  return _currentUser;
}

// ── Show a desktop notification ───────────────────────────────────────────────
function showDesktopNotification(title: string, body: string, tag: string, taskId?: string): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon:  "/favicon.png",
    badge: "/favicon.png",
    tag,
    requireInteraction: true,
  });
  n.onclick = () => {
    window.focus();
    n.close();
    if (taskId) {
      window.dispatchEvent(new CustomEvent("smartcue_notif_click", { detail: { taskId } }));
    }
  };
}

// ── Determine if THIS user should see a notification ─────────────────────────
function shouldNotify(event: TaskNotificationEvent, user: CurrentUser): boolean {
  const role  = user.role;
  const email = user.email.toLowerCase();
  const type  = event.type;
  const status = event.newStatus;

  if (type === "task_assigned") {
    // Doer: always notified when a task is assigned to them
    if (email === event.assignedTo?.toLowerCase()) return true;
    // Superadmin / supremo: always see all new tasks
    if (role === "superadmin" || role === "supremo") return true;
    return false;
  }

  if (type === "task_status_changed") {
    switch (status) {
      case "in-review":
        // Admin who assigned the task + superadmin/supremo
        if (email === event.assignedBy?.toLowerCase()) return true;
        if (role === "superadmin" || role === "supremo") return true;
        return false;

      case "admin-approved":
        // Doer (task was approved) + superadmin/supremo (needs final review)
        if (email === event.assignedTo?.toLowerCase()) return true;
        if (role === "superadmin" || role === "supremo") return true;
        return false;

      case "superadmin-approved":
        // Doer + admin who assigned
        if (email === event.assignedTo?.toLowerCase()) return true;
        if (email === event.assignedBy?.toLowerCase()) return true;
        if (role === "superadmin" || role === "supremo") return true;
        return false;

      case "rejected":
        // Doer only
        if (email === event.assignedTo?.toLowerCase()) return true;
        return false;

      default:
        return false;
    }
  }

  return false;
}

// ── Build notification text per role/status ───────────────────────────────────
function buildNotificationText(event: TaskNotificationEvent, user: CurrentUser): { title: string; body: string } {
  const title = event.taskTitle;
  const role  = user.role;
  const email = user.email.toLowerCase();

  if (event.type === "task_assigned") {
    if (email === event.assignedTo?.toLowerCase()) {
      const due = event.dueDate
        ? new Date(event.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : "No due date";
      return {
        title: "📋 New Task Assigned",
        body:  `${title} · Priority: ${(event.priority || "medium").toUpperCase()} · Due: ${due}`,
      };
    }
    if (role === "superadmin" || role === "supremo") {
      return { title: "📋 Task Assigned", body: `${title} has been assigned to a team member.` };
    }
  }

  if (event.type === "task_status_changed") {
    switch (event.newStatus) {
      case "in-review":
        if (role === "superadmin" || role === "supremo" || email === event.assignedBy?.toLowerCase()) {
          return { title: "👁 Task Submitted for Review", body: `${title} needs your review.` };
        }
        break;
      case "admin-approved":
        if (email === event.assignedTo?.toLowerCase()) {
          return { title: "✅ Task Approved by Admin", body: `${title} has been approved. Awaiting final sign-off.` };
        }
        if (role === "superadmin" || role === "supremo") {
          return { title: "📋 Ready for Final Approval", body: `${title} has been admin-approved and needs your final review.` };
        }
        break;
      case "superadmin-approved":
        if (email === event.assignedTo?.toLowerCase()) {
          return { title: "🏆 Task Fully Approved!", body: `${title} received full approval. Great work!` };
        }
        return { title: "✅ Task Fully Approved", body: `${title} has been fully signed off.` };
      case "rejected":
        return { title: "↩ Task Needs Rework", body: `${title} was sent back. Check admin comments.` };
    }
  }

  return { title: "SmartCue Update", body: title };
}

// ── Handle incoming socket task_notification event ────────────────────────────
export function handleTaskNotification(event: TaskNotificationEvent, user: CurrentUser): void {
  if (!shouldNotify(event, user)) return;
  const { title, body } = buildNotificationText(event, user);
  const tag = `${event.type}-${event.taskId}`;
  showDesktopNotification(title, body, tag, event.taskId);
}

// ── Main init: call once after login ─────────────────────────────────────────
export async function initNotifications(user: CurrentUser): Promise<void> {
  _currentUser = user;

  // 1. Request permission
  const granted = await requestNotificationPermission();
  if (!granted) {
    console.warn("[Notifications] Permission denied — desktop notifications disabled.");
    return;
  }

  // 2. Register service worker
  const reg = await registerServiceWorker();
  if (!reg) return;

  // 3. Subscribe to web push (for background/offline notifications)
  await subscribeToPush(reg, user.email);

  console.log(`[Notifications] Initialised for ${user.email} (${user.role})`);
}

// ── Unsubscribe (on logout) ───────────────────────────────────────────────────
export async function unsubscribeNotifications(email: string): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(`${API}/api/push/unsubscribe`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email, endpoint: sub.endpoint }),
        });
      }
    }
    _currentUser = null;
    console.log("[Notifications] Unsubscribed for", email);
  } catch (err) {
    console.error("[Notifications] Unsubscribe error:", err);
  }
}
