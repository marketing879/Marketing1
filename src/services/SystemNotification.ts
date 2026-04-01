/**
 * SystemNotification.ts
 * Posts system notifications to the doer's personal notification channel.
 * Uses notifType field (not type) to avoid backend enum validation errors.
 */

const API = "https://adaptable-patience-production-45da.up.railway.app";

export interface SystemDMPayload {
  adminEmail:   string;
  adminName:    string;
  doerEmail:    string;
  taskId:       string;
  taskTitle:    string;
  message:      string;
  notifType:    "task_assigned" | "task_approved" | "task_reassigned" | "task_cancelled" | "task_reminder";
  priority?:    string;
  dueDate?:     string;
  projectName?: string;
}

const SYSTEM_AUTHOR = {
  id:     "system",
  name:   "SmartCue",
  email:  "system@smartcue.ai",
  role:   "staff" as any,   // use a valid role enum value
  avatar: "",
};

async function postMessage(channelId: string, payload: SystemDMPayload): Promise<void> {
  const body = {
    channelId,
    text:         payload.message,
    // DO NOT send "type" — backend enum rejects "system_notification"
    // Store notification metadata in extra fields instead
    notifType:    payload.notifType,          // custom field — backend ignores unknown fields
    isSystemNotif: true,                      // flag for ChatRoom to detect
    taskId:       payload.taskId,
    taskTitle:    payload.taskTitle,
    priority:     payload.priority   || "medium",
    dueDate:      payload.dueDate    || "",
    projectName:  payload.projectName || "",
    adminEmail:   payload.adminEmail,
    adminName:    payload.adminName,
    doerEmail:    payload.doerEmail,
    author:       SYSTEM_AUTHOR,
    authorId:     SYSTEM_AUTHOR.id,
    authorName:   SYSTEM_AUTHOR.name,
    authorRole:   SYSTEM_AUTHOR.role,
    authorEmail:  SYSTEM_AUTHOR.email,
    authorAvatar: SYSTEM_AUTHOR.avatar,
    reactions:    {},
    createdAt:    new Date().toISOString(),
  };

  try {
    const res = await fetch(`${API}/api/chat/messages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[SystemNotif] POST to ${channelId} failed:`, res.status, await res.text());
    } else {
      console.log(`[SystemNotif] Posted to ${channelId}:`, payload.notifType);
    }
  } catch (e) {
    console.error(`[SystemNotif] Network error posting to ${channelId}:`, e);
  }
}

/**
 * Send a system notification to the doer.
 * Posts to TWO channels:
 *  1. notif_<doerEmail>  — personal notification channel (shows in bell panel)
 *  2. DM channel         — also appears in their DM thread with the admin
 */
export async function sendSystemDM(payload: SystemDMPayload): Promise<void> {
  if (!payload.doerEmail) return;

  // Channel 1 — personal notification channel keyed by doer email
  const notifChannel = `notif_${payload.doerEmail}`;
  await postMessage(notifChannel, payload);

  // Channel 2 — DM channel between admin and doer
  if (payload.adminEmail && payload.adminEmail !== payload.doerEmail) {
    const ids = [payload.adminEmail, payload.doerEmail].sort();
    const dmChannel = `dm_${ids[0]}__${ids[1]}`;
    await postMessage(dmChannel, payload);
  }
}