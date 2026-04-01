/**
 * SystemNotification.ts
 * Posts system notifications to the doer's personal notification channel.
 * Detection in ChatContext uses authorId === "system" + channelId starts with "notif_"
 * since the backend strips unknown fields like isSystemNotif/notifType.
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
  role:   "staff" as any,
  avatar: "",
};

async function postMessage(channelId: string, payload: SystemDMPayload): Promise<void> {
  // Encode notifType into the text so it survives backend field stripping
  // Format: "[NOTIF:task_assigned] actual message text"
  const textWithMeta = `[NOTIF:${payload.notifType}|${payload.taskId}|${payload.taskTitle}] ${payload.message}`;

  const body = {
    channelId,
    text:         textWithMeta,
    author:       SYSTEM_AUTHOR,
    authorId:     SYSTEM_AUTHOR.id,      // "system" — this persists and is used for detection
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

  // Channel 1 — personal notification channel
  await postMessage(`notif_${payload.doerEmail}`, payload);

  // Channel 2 — DM channel between admin and doer
  if (payload.adminEmail && payload.adminEmail !== payload.doerEmail) {
    const ids = [payload.adminEmail, payload.doerEmail].sort();
    await postMessage(`dm_${ids[0]}__${ids[1]}`, payload);
  }
}

/**
 * Parse a system notification message back into structured data.
 * Extracts notifType, taskId, taskTitle from the encoded text prefix.
 */
export function parseSystemNotif(text: string): {
  notifType: string;
  taskId: string;
  taskTitle: string;
  message: string;
} {
  const match = text.match(/^\[NOTIF:([^|]+)\|([^|]+)\|([^\]]+)\] (.+)$/s);
  if (match) {
    return {
      notifType: match[1],
      taskId:    match[2],
      taskTitle: match[3],
      message:   match[4],
    };
  }
  return { notifType: "task_assigned", taskId: "", taskTitle: "", message: text };
}