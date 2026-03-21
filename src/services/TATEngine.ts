import type { SmartAssistTicket } from "./SmartAssistService";

// ── Lightweight Task shape needed by the engine ───────────────────────────────
export interface TATTask {
  id: string;
  title: string;
  dueDate: string;
  assignedTo: string;
  assignedBy?: string;
  approvalStatus: string;
  timeSlot?: string;
  exactDeadline?: string;
  tatBreached?: boolean;
  tatBreachAt?: string;
  smartAssist?: {
    lastReminderAt?: string;
    reminderCount?: number;
    delayDuration?: string;
    revisedDate?: string;
    revisedTimeSlot?: string;
    delayReason?: string;
    status?: string;
    resolvedAt?: string;
  } | null;
  tatHistory?: Array<{ timestamp: string; overdueHuman: string; reminderCount: number }>;
}

export interface TATResult {
  updatedTasks: TATTask[];
  newTickets: SmartAssistTicket[];
}

export interface TATBreachInfo {
  breached: boolean;
  overdueMs: number;
  overdueHuman: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const TAT_CHECK_INTERVAL_MS = 60 * 60 * 1000;        // 1 hour (production)
export const TAT_CHECK_INTERVAL_DEV_MS = 60 * 1000;          // 1 min (development)
export const SMART_ASSIST_REMINDER_INTERVAL = 24 * 60 * 60 * 1000; // 24 hrs

/** Build exact ISO deadline from dueDate + time slot */
export function computeExactDeadline(
  dueDate: string,
  timeSlot: string = "PM"
): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate + "T00:00:00");
  switch (timeSlot) {
    case "AM":
      d.setHours(9, 0, 0, 0);
      break;
    case "Noon":
      d.setHours(12, 0, 0, 0);
      break;
    case "PM":
    default:
      d.setHours(18, 0, 0, 0);
      break;
  }
  return d.toISOString();
}

/** Human-readable overdue string */
function fmtOverdue(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}d ${h % 24}h overdue` : `${h}h overdue`;
}

/** Returns breach info for a task */
export function checkTATBreach(task: TATTask): TATBreachInfo {
  const deadline =
    task.exactDeadline ?? computeExactDeadline(task.dueDate, task.timeSlot);
  if (!deadline) return { breached: false, overdueMs: 0, overdueHuman: "" };
  const diff = Date.now() - new Date(deadline).getTime();
  if (diff <= 0) return { breached: false, overdueMs: 0, overdueHuman: "" };
  return { breached: true, overdueMs: diff, overdueHuman: fmtOverdue(diff) };
}

/** True if 24 hrs have passed since last reminder and task is still open */
export function shouldSendReminder(task: TATTask): boolean {
  const done = ["completed", "superadmin-approved"];
  if (done.includes(task.approvalStatus)) return false;
  if (!task.smartAssist) return true;
  const elapsed =
    Date.now() - new Date(task.smartAssist.lastReminderAt ?? 0).getTime();
  return elapsed >= SMART_ASSIST_REMINDER_INTERVAL;
}

/** Build a Smart Assist ticket payload */
export function generateSmartAssistTicket(
  task: TATTask,
  assignedByName: string,
  assignedToName: string
): SmartAssistTicket {
  const { overdueHuman } = checkTATBreach(task);
  const prev = task.smartAssist?.reminderCount ?? 0;
  return {
    id: `sa_${task.id}_${Date.now()}`,
    taskId: task.id,
    taskTitle: task.title,
    assignedBy: task.assignedBy,
    assignedByName,
    assignedTo: task.assignedTo,
    assignedToName,
    delayDuration: overdueHuman,
    originalDeadline:
      task.exactDeadline ?? computeExactDeadline(task.dueDate, task.timeSlot) ?? undefined,
    timeSlot: task.timeSlot ?? "PM",
    status: "open",
    reminderCount: prev + 1,
    createdAt: new Date().toISOString(),
    lastReminderAt: new Date().toISOString(),
  };
}

/**
 * Main engine pass — call this from a polling interval.
 * Returns { updatedTasks, newTickets }
 */
export function processTATEngine(
  tasks: TATTask[],
  getNameFn: (email: string) => string = (e) => e
): TATResult {
  const updatedTasks: TATTask[] = [];
  const newTickets: SmartAssistTicket[] = [];
  const done = ["superadmin-approved", "completed"];

  for (const task of tasks) {
    if (done.includes(task.approvalStatus)) {
      updatedTasks.push({
        ...task,
        tatBreached: false,
        smartAssist: task.smartAssist
          ? {
              ...task.smartAssist,
              status: "resolved",
              resolvedAt: new Date().toISOString(),
            }
          : null,
      });
      continue;
    }

    const { breached, overdueHuman } = checkTATBreach(task);
    if (!breached) {
      updatedTasks.push({ ...task, tatBreached: false });
      continue;
    }

    let updated: TATTask = {
      ...task,
      tatBreached: true,
      tatBreachAt: task.tatBreachAt ?? new Date().toISOString(),
    };

    if (shouldSendReminder(updated)) {
      const ticket = generateSmartAssistTicket(
        updated,
        getNameFn(task.assignedBy ?? ""),
        getNameFn(task.assignedTo ?? "")
      );
      newTickets.push(ticket);
      const history = [
        ...(task.tatHistory ?? []),
        {
          timestamp: ticket.createdAt ?? new Date().toISOString(),
          overdueHuman,
          reminderCount: ticket.reminderCount,
        },
      ];
      updated = {
        ...updated,
        smartAssist: { ...ticket, status: "open" },
        tatHistory: history,
      };
    } else {
      updated = {
        ...updated,
        smartAssist: updated.smartAssist
          ? { ...updated.smartAssist, delayDuration: overdueHuman }
          : null,
      };
    }

    updatedTasks.push(updated);
  }

  return { updatedTasks, newTickets };
}

/** Start polling. Returns cleanup fn. */
export function startTATMonitor(
  getAllTasks: () => TATTask[],
  getNameFn: (email: string) => string,
  onUpdate: (updatedTasks: TATTask[], newTickets: SmartAssistTicket[]) => void,
  intervalMs: number = TAT_CHECK_INTERVAL_DEV_MS
): () => void {
  const run = (): void => {
    const tasks = getAllTasks();
    if (!tasks?.length) return;
    const result = processTATEngine(tasks, getNameFn);
    onUpdate(result.updatedTasks, result.newTickets);
  };
  run();
  const id = setInterval(run, intervalMs);
  return () => clearInterval(id);
}
