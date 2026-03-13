// ── src/services/WhatsAppService.ts ──────────────────────────────────────────
// Twilio has been moved to the Express backend (server.js).
// This file only uses fetch() — no Node.js polyfill issues.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppTaskPayload {
  recipientPhone: string;  // e.g. "+919321181236"
  taskTitle: string;
  taskDescription: string;
  priority: "high" | "medium" | "low";
  dueDate: string;         // "2025-06-15"
  timeSlot: string;        // "AM" | "Noon" | "PM" | "HH:MM"
  assignedByName: string;
  projectName: string;
  taskId: string;
}

export type WhatsAppResult =
  | { ok: true;  method: "twilio" | "api" | "link"; sid?: string; url?: string }
  | { ok: false; error: string };

// ── Config ────────────────────────────────────────────────────────────────────

// Which method to use — set ONE of these to "true" in your .env
const USE_TWILIO    = process.env.REACT_APP_USE_TWILIO    === "true";
const USE_CLOUD_API = process.env.REACT_APP_USE_CLOUD_API === "true";

// Backend URL (server.js running on port 5000)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://roswalt-backend-production.up.railway.app";

// WhatsApp Cloud API credentials (only used if USE_CLOUD_API=true)n

const WA_CLOUD_API_TOKEN = process.env.REACT_APP_WA_CLOUD_API_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.REACT_APP_WA_PHONE_NUMBER_ID || "";

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
 * Builds the freeform message body.
 * Used by Cloud API and wa.me fallback.
 */
function buildMessage(p: WhatsAppTaskPayload): string {
  const stars   = "✦".repeat(3);
  const priLine = `${priorityEmoji(p.priority)} *Priority:* ${p.priority.toUpperCase()}`;
  const due     = formatDeadline(p.dueDate, p.timeSlot);

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

// ── Method 1: Backend (Twilio via Express server.js) ─────────────────────────

/**
 * Calls the Express backend which runs Twilio server-side.
 * Backend endpoint: POST /api/send-whatsapp
 */
async function sendViaBackend(
  payload: WhatsAppTaskPayload,
): Promise<WhatsAppResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientPhone: payload.recipientPhone,
        templateVars: {
          "1": payload.dueDate,    // maps to {1} in your Twilio template
          "2": payload.timeSlot,   // maps to {2} in your Twilio template
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    console.log("[WhatsApp] Backend Twilio sent. SID:", data.sid);
    return { ok: true, method: "twilio", sid: data.sid };

  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[WhatsApp] Backend call failed:", errMsg);
    return { ok: false, error: errMsg };
  }
}

// ── Method 2: WhatsApp Cloud API (direct from frontend) ──────────────────────

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
        Authorization:  `Bearer ${WA_CLOUD_API_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:   phone,
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

// ── Method 3: wa.me deep-link fallback ───────────────────────────────────────

function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main function — call this from AdminDashboard when assigning tasks.
 *
 * Priority order:
 *   1. Backend Twilio (REACT_APP_USE_TWILIO=true)   → server.js handles it
 *   2. Cloud API      (REACT_APP_USE_CLOUD_API=true) → direct Meta API call
 *   3. wa.me fallback (always works)                → opens WhatsApp manually
 */
export async function sendTaskWhatsApp(
  payload: WhatsAppTaskPayload,
): Promise<WhatsAppResult> {

  // Method 1: Backend (Twilio via server.js)
  if (USE_TWILIO) {
    return sendViaBackend(payload);
  }

  // Method 2: WhatsApp Cloud API
  if (USE_CLOUD_API) {
    const message = buildMessage(payload);
    return sendViaCloudAPI(payload.recipientPhone, message);
  }

  // Method 3: wa.me fallback
  const message = buildMessage(payload);
  const link    = buildWaLink(payload.recipientPhone, message);
  window.open(link, "_blank", "noopener,noreferrer");
  return { ok: true, method: "link", url: link };
}

/**
 * Utility — get just the wa.me link without sending.
 * Useful for a "Send via WhatsApp" button.
 */
export function getWhatsAppLink(payload: WhatsAppTaskPayload): string {
  return buildWaLink(payload.recipientPhone, buildMessage(payload));
}
