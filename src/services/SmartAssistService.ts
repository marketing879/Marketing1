/**
 * SmartAssistService.ts — Smart Assist Ticket Management
 * Manages creation, reminder dispatch, resolution and state of Smart Assist tickets.
 * Drop into /src/services/SmartAssistService.ts
 */

const STORAGE_KEY = "smartAssistTickets";

export interface SmartAssistTicket {
  id: string;
  taskId: string;
  taskTitle: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy?: string;
  assignedByName?: string;
  delayDuration: string;
  originalDeadline?: string;
  timeSlot?: string;
  reminderCount: number;
  status: "open" | "awaiting-completion" | "resolved";
  lastReminderAt?: string;
  revisedDate?: string;
  revisedTimeSlot?: string;
  delayReason?: string;
  resolvedAt?: string;
  revisedAt?: string;
  createdAt?: string;
}

export interface RevisionPayload {
  revisedDate: string;
  revisedTimeSlot: string;
  delayReason: string;
}

export interface FormattedTicket extends SmartAssistTicket {
  statusLabel: string;
  isOverdue: boolean;
}

/** Load persisted tickets from localStorage */
export function loadTickets(): SmartAssistTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SmartAssistTicket[]) : [];
  } catch {
    return [];
  }
}

/** Persist tickets to localStorage */
function saveTickets(tickets: SmartAssistTicket[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    /* storage full — graceful fail */
  }
}

/** Merge new tickets into existing, avoiding duplicates by taskId */
export function mergeTickets(
  existing: SmartAssistTicket[],
  incoming: SmartAssistTicket[]
): SmartAssistTicket[] {
  const map = new Map<string, SmartAssistTicket>(existing.map((t) => [t.taskId, t]));
  for (const t of incoming) {
    const prev = map.get(t.taskId);
    if (prev) {
      map.set(t.taskId, {
        ...prev,
        ...t,
        status:
          prev.status === "resolved" ? "resolved" : t.status,
        resolvedAt: prev.resolvedAt,
        reminderCount: Math.max(prev.reminderCount ?? 0, t.reminderCount ?? 0),
      });
    } else {
      map.set(t.taskId, t);
    }
  }
  const merged = Array.from(map.values());
  saveTickets(merged);
  return merged;
}

/** Resolve a Smart Assist ticket when task is completed */
export function resolveTicket(
  tickets: SmartAssistTicket[],
  taskId: string
): SmartAssistTicket[] {
  const updated = tickets.map((t) =>
    t.taskId === taskId
      ? { ...t, status: "resolved" as const, resolvedAt: new Date().toISOString() }
      : t
  );
  saveTickets(updated);
  return updated;
}

/** Submit a revised deadline from the doer */
export function submitRevision(
  tickets: SmartAssistTicket[],
  taskId: string,
  payload: RevisionPayload
): SmartAssistTicket[] {
  const { revisedDate, revisedTimeSlot, delayReason } = payload;
  const updated = tickets.map((t) =>
    t.taskId === taskId
      ? {
          ...t,
          revisedDate,
          revisedTimeSlot,
          delayReason,
          status: "awaiting-completion" as const,
          revisedAt: new Date().toISOString(),
        }
      : t
  );
  saveTickets(updated);
  return updated;
}

/** Get open (non-resolved) tickets */
export function getOpenTickets(tickets: SmartAssistTicket[]): SmartAssistTicket[] {
  return tickets.filter((t) => t.status !== "resolved");
}

/** Get ticket for a specific task */
export function getTicketForTask(
  tickets: SmartAssistTicket[],
  taskId: string
): SmartAssistTicket | undefined {
  return tickets.find((t) => t.taskId === taskId);
}

/** Count active Smart Assist tickets */
export function countActiveTickets(tickets: SmartAssistTicket[]): number {
  return tickets.filter(
    (t) => t.status === "open" || t.status === "awaiting-completion"
  ).length;
}

/** Format a Smart Assist ticket for display */
export function formatTicketSummary(
  ticket: SmartAssistTicket | null | undefined
): FormattedTicket | null {
  if (!ticket) return null;
  const statusLabel: Record<string, string> = {
    open: "🔴 Awaiting Response",
    "awaiting-completion": "🟡 Revision Submitted",
    resolved: "✅ Resolved",
  };
  return {
    ...ticket,
    statusLabel: statusLabel[ticket.status] ?? ticket.status,
    isOverdue: ticket.status === "open",
  };
}

export default {
  loadTickets,
  mergeTickets,
  resolveTicket,
  submitRevision,
  getOpenTickets,
  getTicketForTask,
  countActiveTickets,
  formatTicketSummary,
};