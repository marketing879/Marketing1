// ─────────────────────────────────────────────────────────────────────────────
// SystemNotification.ts
// Sends programmatic DM notifications from admin → doer via the chatroom.
// Replaces WhatsApp — all notifications now route through SmartCue ChatRoom.
// ─────────────────────────────────────────────────────────────────────────────

const API = "https://adaptable-patience-production-45da.up.railway.app";

// Identical formula to ChatContext_final — both ends must produce the same id
const getDMChannelId = (idA: string, idB: string) =>
  "dm_" + [idA, idB].sort().join("__");

export type SystemNotifType =
  | "task_assigned"
  | "task_approved"
  | "task_rework"
  | "task_reassigned"
  | "task_cancelled"
  | "task_reminder"
  | "autopulse_created";

export interface SystemNotificationPayload {
  adminEmail:  string;
  adminName:   string;
  doerEmail:   string;
  taskId:      string;
  taskTitle:   string;
  message:     string;           // human-readable body shown in the notification
  notifType:   SystemNotifType;
  priority?:   string;
  dueDate?:    string;
  projectName?: string;
}

/**
 * Posts a system notification as a DM from admin → doer.
 * Stored in MongoDB, broadcast live via socket — doer sees it in ChatRoom.
 * Non-blocking: failures are logged but never throw.
 */
export async function sendSystemDM(payload: SystemNotificationPayload): Promise<void> {
  const {
    adminEmail, adminName, doerEmail,
    taskId, taskTitle, message, notifType,
    priority, dueDate, projectName,
  } = payload;

  // Post to DOER's personal notification channel so it appears in their 🔔 panel
  const channelId = `notif_${doerEmail}`;
  // Also post a copy to ADMIN's notif channel so admin can see what was sent
  const adminChannelId = `notif_${adminEmail}`;

  const chatMsg = {
    id:           `sysnotif_${taskId}_${Date.now()}`,
    channelId,   // doer's notif channel
    // Flat fields required by backend chatMessageSchema
    authorId:     adminEmail,
    authorName:   adminName,
    authorRole:   "admin",
    authorEmail:  adminEmail,
    authorAvatar: "",
    // Nested author object for ChatRoom renderer
    author: {
      id:     adminEmail,
      name:   adminName,
      role:   "admin",
      email:  adminEmail,
      avatar: "",
    },
    type:        "system_notification",
    text:        message,
    // Extra metadata — ChatRoom uses these to render rich notification cards
    notifType,
    taskId,
    taskTitle,
    priority:    priority    || "medium",
    dueDate:     dueDate     || "",
    projectName: projectName || "",
    reactions:   {},
    readBy:      [],
    createdAt:   new Date().toISOString(),
  };

  try {
    const res = await fetch(`${API}/api/chat/messages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(chatMsg),
    });
    if (!res.ok) {
      console.warn(`[SystemNotification] POST failed ${res.status} for task ${taskId}`);
    } else {
      console.log(`[SystemNotification] ✓ Notif sent to ${doerEmail} — ${notifType} · ${taskTitle}`);
    // Also post copy to admin's notif channel so admin sees sent notifications
    if (adminEmail && adminEmail !== doerEmail) {
      const adminMsg = { ...chatMsg, id: chatMsg.id + "_admin", channelId: adminChannelId };
      try {
        await fetch(`${API}/api/chat/messages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(adminMsg),
        });
      } catch {}
    }
    }
  } catch (e) {
    console.warn("[SystemNotification] Network error — notification not delivered:", e);
  }
}