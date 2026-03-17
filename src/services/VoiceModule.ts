// ── Voice Module (Backend ElevenLabs Only) ───────────────────────────────────
// Uses backend proxy (/api/tts)
// No Web Speech fallback
// Single audio engine only
// announceVoice() and speakText() now return Promise<void> so callers
// can await full audio playback before gating navigation.

type VoiceEvent =
  | "task_assigned"
  | "task_approved"
  | "task_sent_for_approval"
  | "task_rejected"
  | "task_submitted"
  | "task_forwarded"
  | "Access_Granted"
  | "Access_Denied"
  | "Welcome_Login"
  | "task_deleted";

// ── Backend Config ────────────────────────────────────────────────────────────
const API_BASE =
  process.env.REACT_APP_API_URL || "https://adaptable-patience-production-45da.up.railway.app";

// ── Voice Selection Controller ────────────────────────────────────────────────
let _selectedVoice: string | null = null;

export function setElevenLabsVoice(voiceId: string): void {
  _selectedVoice = voiceId;
  console.log("✓ Voice set to:", voiceId);
}

// ── Time-aware greeting helper ────────────────────────────────────────────────
function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getGreetingWord(): string {
  const map = {
    morning:   "Good Morning",
    afternoon: "Good afternoon",
    evening:   "Good evening",
    night:     "Welcome back",
  };
  return map[getTimeOfDay()];
}

// ── Login greeting scripts ────────────────────────────────────────────────────
const LOGIN_SCRIPTS = [
  "{greeting}, {name}. Welcome to your Roswalt SmartCue dashboard. You are all set.",
  "{greeting}, {name}. Good to have you back. Your dashboard is ready.",
  "{greeting}, {name}. You are logged in. Let us get things done today.",
  "{greeting}, {name}. You are in. Have a productive session.",
];

let _loginScriptIndex = -1;

// Returns Promise<void> — resolves when greeting audio fully finishes.
export function greetUser(fullName?: string): Promise<void> {
  let idx = Math.floor(Math.random() * LOGIN_SCRIPTS.length);
  if (LOGIN_SCRIPTS.length > 1 && idx === _loginScriptIndex) {
    idx = (idx + 1) % LOGIN_SCRIPTS.length;
  }
  _loginScriptIndex = idx;

  const greeting  = getGreetingWord();
  const firstName = fullName?.trim().split(/\s+/)[0] ?? "there";
  const text      = LOGIN_SCRIPTS[idx]
    .replace("{greeting}", greeting)
    .replace("{name}", firstName);

  return _speak(text);
}

// ── Task & auth event scripts ─────────────────────────────────────────────────
const VOICE_SCRIPTS: Record<VoiceEvent, string[]> = {
  task_assigned: [
    "New task assigned. Your team member has been notified.",
    "Task successfully assigned and dispatched.",
    "Assignment confirmed. The task is now live on their dashboard.",
  ],
  task_approved: [
    "Task approved and forwarded to the Superadmin for final sign off.",
    "Approval confirmed. This task is now escalated to Superadmin review.",
    "Well done. Task has been approved and sent up for Superadmin clearance.",
  ],
  task_sent_for_approval: [
    "Task submitted and sent for Superadmin approval.",
    "Submission complete. Awaiting Superadmin review and final approval.",
    "Your task has been forwarded to Superadmin for sign off.",
  ],
  task_rejected: [
    "Task returned for rework. Please review the feedback provided.",
    "Rework requested. The assignee will be notified to revise and resubmit.",
    "Task sent back for revision. Comments have been logged.",
  ],
  task_submitted: [
    "Task submitted for review. Your manager will be notified shortly.",
    "Submission received. The task is now under review.",
    "Task marked complete and submitted to your admin for approval.",
  ],
  task_forwarded: [
    "Task forwarded successfully. The new assignee has been notified.",
    "Handover complete. Full context has been preserved for the new assignee.",
    "Task delegated. History and notes have been transferred.",
  ],
  task_deleted: [
    "Task deleted.",
    "Task removed from the system.",
    "Done. That task has been permanently deleted.",
  ],

  // ── Auth voice events ────────────────────────────────────────────────────
  Welcome_Login: [
    // Single fixed script — spoken on app mount
    "Welcome to Smart Cue. Enter your credentials to login.",
  ],
  Access_Granted: [
    "Access granted. Welcome to your dashboard.",
    "Access granted. You are now authenticated.",
    "Access granted. Navigation commencing.",
  ],
  Access_Denied: [
    "Access denied. Please check your credentials and try again.",
    "Invalid credentials. Access denied.",
    "Authentication failed. Access denied.",
  ],
};

let _lastIndex: Partial<Record<VoiceEvent, number>> = {};

function getScript(event: VoiceEvent): string {
  const scripts = VOICE_SCRIPTS[event];
  const lastIdx = _lastIndex[event] ?? -1;

  let idx = Math.floor(Math.random() * scripts.length);
  if (scripts.length > 1 && idx === lastIdx) {
    idx = (idx + 1) % scripts.length;
  }

  _lastIndex[event] = idx;
  return scripts[idx];
}

// ── Backend TTS Call ──────────────────────────────────────────────────────────
// IMPORTANT: Returns a Promise that resolves only when audio has FINISHED
// playing. This is what allows login() to gate navigation on speech end.
async function _speakWithBackend(text: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tts`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        text,
        voiceId: _selectedVoice || "ThT5KcBeYPX3keUQqHPh",
      }),
    });

    if (!response.ok) {
      console.error("Backend TTS failed:", response.status);
      return;
    }

    const blob  = await response.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);

    // Wrap in a Promise so _speak resolves AFTER audio ends, not at play() call
    await new Promise<void>((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); }; // always resolve
      audio.play().catch(() => resolve());
    });
  } catch (error) {
    console.error("TTS error:", error);
    // Resolve silently — login/gate logic must never hang on network errors
  }
}

// ── Main Speak Controller ─────────────────────────────────────────────────────
async function _speak(text: string): Promise<void> {
  await _speakWithBackend(text);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fire a named voice event via ElevenLabs.
 * Returns Promise<void> that resolves when the audio has FULLY finished.
 * Await this in auth flows to gate navigation on speech completion.
 *
 *   await announceVoice("Access_Granted");
 *   setVoiceAccessGranted(true); // ← fires AFTER audio ends
 */
export function announceVoice(event: VoiceEvent): Promise<void> {
  return _speak(getScript(event));
}

/**
 * Speak arbitrary text via ElevenLabs.
 * Returns Promise<void> that resolves when audio finishes.
 */
export function speakText(text: string): Promise<void> {
  return _speak(text);
}

// ── Debug Helper ─────────────────────────────────────────────────────────────
export function logVoiceStatus(): void {
  console.log("🎤 Voice Module Status:");
  console.log("  Backend API:", API_BASE);
  console.log("  Selected Voice:", _selectedVoice);
}

// Init
if (typeof window !== "undefined") {
  console.log("🎤 Voice Module loaded (Backend ElevenLabs Only)");
  logVoiceStatus();
}
