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
  process.env.REACT_APP_API_URL ||
  "https://adaptable-patience-production-45da.up.railway.app";

// FIX 1 ── Auth secret read from env at module load.
// Add REACT_APP_TTS_SECRET=<your-backend-shared-secret> to your .env file.
// The backend middleware must accept: Authorization: Bearer <secret>
const TTS_SECRET = process.env.REACT_APP_TTS_SECRET ?? "";

if (!TTS_SECRET && typeof window !== "undefined") {
  console.warn(
    "[VoiceModule] REACT_APP_TTS_SECRET is not set. " +
    "/api/tts calls will return 401 Unauthorized."
  );
}

// ── Default voice — used immediately; overrideable via setElevenLabsVoice() ──
const DEFAULT_VOICE_ID = "ThT5KcBeYPX3keUQqHPh";

// FIX 2 ── Initialise to the default so no call ever fires with null voiceId.
// setElevenLabsVoice() can still override this at any time.
let _selectedVoice: string = DEFAULT_VOICE_ID;

export function setElevenLabsVoice(voiceId: string): void {
  _selectedVoice = voiceId || DEFAULT_VOICE_ID;
  console.log("✓ Voice set to:", _selectedVoice);
}

// ── Time-aware greeting helper ────────────────────────────────────────────────
function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getGreetingWord(): string {
  const map: Record<ReturnType<typeof getTimeOfDay>, string> = {
    morning:   "Good morning",
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

/** Returns Promise<void> — resolves when greeting audio fully finishes. */
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
    .replace("{name}",    firstName);

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
  Welcome_Login: [
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

// ── FIX 3: Speak queue ────────────────────────────────────────────────────────
// Prevents concurrent Audio instances from overlapping. Each call is serialised
// behind the previous one, so rapid successive announcements play in order.
let _speakQueue: Promise<void> = Promise.resolve();

// ── Backend TTS Call ──────────────────────────────────────────────────────────
async function _speakWithBackend(text: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/tts`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        // FIX 1 ── Send the shared secret so the backend accepts the request
        ...(TTS_SECRET ? { "Authorization": `Bearer ${TTS_SECRET}` } : {}),
      },
      body: JSON.stringify({
        text,
        // FIX 2 ── _selectedVoice is never null; always resolves to a valid ID
        voiceId: _selectedVoice,
      }),
    });

    if (!response.ok) {
      console.error(`[VoiceModule] Backend TTS failed: ${response.status}`, await response.text().catch(() => ""));
      return;
    }

    const blob  = await response.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);

    await new Promise<void>((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    });
  } catch (err) {
    // Always resolve — login/gate logic must never hang on network errors
    console.error("[VoiceModule] TTS error:", err);
  }
}

// ── Main Speak Controller ─────────────────────────────────────────────────────
function _speak(text: string): Promise<void> {
  // Chain onto the existing queue so calls never overlap
  _speakQueue = _speakQueue.then(() => _speakWithBackend(text));
  return _speakQueue;
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

// ── Debug Helper ──────────────────────────────────────────────────────────────
export function logVoiceStatus(): void {
  console.log("🎤 Voice Module Status:");
  console.log("  Backend API:    ", API_BASE);
  console.log("  Selected Voice: ", _selectedVoice);
  console.log("  Auth secret set:", !!TTS_SECRET);
}

// ── Init (runs once on module load) ──────────────────────────────────────────
if (typeof window !== "undefined") {
  console.log("🎤 Voice Module loaded (Backend ElevenLabs Only)");
  // logVoiceStatus is called AFTER all module-level initialisers have run,
  // so _selectedVoice will correctly show DEFAULT_VOICE_ID instead of null.
  logVoiceStatus();
}
