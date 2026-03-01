// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppTaskPayload {
  recipientPhone: string;  // Phone number of the recipient
  taskTitle: string;
  taskDescription: string;
  priority: "high" | "medium" | "low";
  dueDate: string;  // ISO date string: "2025-06-15"
  timeSlot: string;  // Time Slot: "AM", "Noon", "PM" or HH:MM
  assignedByName: string;
  projectName: string;
  taskId: string;
}

export type WhatsAppResult =
  | { ok: true; method: "api" | "link"; url?: string }
  | { ok: false; error: string };

// ── Config — Loading from .env ────────────────────────────────────────────

// Fetch credentials from environment variables (use REACT_APP_ prefix in .env)
const USE_CLOUD_API = process.env.REACT_APP_USE_CLOUD_API === "true"; // Convert string to boolean
const WA_CLOUD_API_TOKEN = process.env.REACT_APP_WA_CLOUD_API_TOKEN || "";  // Use temporary token from .env
const WA_PHONE_NUMBER_ID = process.env.REACT_APP_WA_PHONE_NUMBER_ID || "";  // Use phone number ID from .env

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityEmoji(p: string): string {
  return p === "high" ? "🔴" : p === "low" ? "🟢" : "🟡";
}

function formatDeadline(dueDate: string, timeSlot: string): string {
  try {
    const d = new Date(dueDate + "T00:00:00");
    const dateStr = d.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    return `${dateStr} · ${timeSlot}`;
  } catch {
    return `${dueDate} · ${timeSlot}`;
  }
}

/**
 * Builds the WhatsApp message body.
 * Keeps it tight — fits within WhatsApp's 1 024-char preview.
 */
function buildMessage(p: WhatsAppTaskPayload): string {
  const stars = "✦".repeat(3);
  const priLine = `${priorityEmoji(p.priority)} *Priority:* ${p.priority.toUpperCase()}`;
  const due = formatDeadline(p.dueDate, p.timeSlot);

  return [
    `${stars} *NEW TASK ASSIGNED* ${stars}`,
    ``,
    `👋 Hi! You have a new task from *${p.assignedByName}*.`,
    ``,
    `📋 *Task:* ${p.taskTitle}`,
    priLine,
    `📁 *Project:* ${p.projectName}`,
    `⏰ *Deadline:* ${due}`,
    ``,
    `📝 *Details:*`,
    p.taskDescription,
    ``,
    `🆔 Task ID: \`${p.taskId}\``,
    ``,
    `_Please log in to the dashboard to review and begin work._`,
    ``,
    `— Roswalt Realty · Task Management`,
  ].join("\n");
}

// ── Cloud API sender ──────────────────────────────────────────────────────────

async function sendViaCloudAPI(
  phone: string,
  message: string,
): Promise<WhatsAppResult> {
  const url = `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WA_CLOUD_API_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: JSON.stringify(err) };
    }
    return { ok: true, method: "api" };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
}

// ── wa.me deep-link sender ────────────────────────────────────────────────────

function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendTaskWhatsApp(
  payload: WhatsAppTaskPayload,
): Promise<WhatsAppResult> {
  const message = buildMessage(payload);

  if (USE_CLOUD_API) {
    return sendViaCloudAPI(payload.recipientPhone, message);
  }

  // Fallback: open wa.me link (opens WhatsApp on admin's device to send manually)
  const link = buildWaLink(payload.recipientPhone, message);
  window.open(link, "_blank", "noopener,noreferrer");
  return { ok: true, method: "link", url: link };
}

export function getWhatsAppLink(payload: WhatsAppTaskPayload): string {
  return buildWaLink(payload.recipientPhone, buildMessage(payload));
}