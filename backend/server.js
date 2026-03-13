import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.options("/{*path}", cors());
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL);
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    return res.status(204).send();
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC CLIENT
// ─────────────────────────────────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ERROR: ANTHROPIC_API_KEY is not set in .env");
  process.exit(1);
}
console.log("✓ ANTHROPIC_API_KEY is configured");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

async function callAnthropicWithRetry(fn, maxRetries = 4) {
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try { return await fn(); }
    catch (err) {
      const isOverloaded =
        err?.status === 529 || err?.status === 503 ||
        err?.error?.error?.type === "overloaded_error";
      if (isOverloaded && attempt <= maxRetries) {
        console.warn(`[RETRY] Anthropic overloaded. Attempt ${attempt}/${maxRetries} — retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      } else { throw err; }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONGODB
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✓ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));
} else {
  console.warn("⚠ MONGO_URI not set — projects will use in-memory fallback.");
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const projectSchema = new mongoose.Schema({
  name:               { type: String, required: true, trim: true },
  description:        { type: String, default: "" },
  color:              { type: String, default: "#c9a96e" },
  projectCode:        { type: String, required: true, unique: true, uppercase: true, trim: true },
  concernedDoerEmail: { type: String, required: true, lowercase: true, trim: true },
  launchDate:         { type: String, required: true },
  status:             { type: String, enum: ["active", "inactive"], default: "active" },
  createdBy:          { type: String },
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  title:           { type: String, required: true },
  description:     { type: String, default: "" },
  status:          { type: String, default: "pending" },
  priority:        { type: String, default: "medium" },
  dueDate:         { type: String },
  assignedTo:      { type: String },
  assignedBy:      { type: String },
  projectId:       { type: String },
  approvalStatus:  { type: String, default: "assigned" },
  completionNotes: { type: String },
  adminComments:   { type: String },
  reminderCount:   { type: Number, default: 0 },
  lastReminderAt:  { type: String, default: null },
}, { timestamps: true });

const Project = mongoose.model("Project", projectSchema);
const Task    = mongoose.model("Task",    taskSchema);

let inMemoryProjects = [];

// ─────────────────────────────────────────────────────────────────────────────
// TEAM DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────
const TEAM_DIRECTORY = {
  // ── Doers ──────────────────────────────────────────────────────────────────
  "prathamesh.chile@roswalt.com":  { name: "Prathamesh Chile",  phone: "9XXXXXXXXX" },
  "samruddhi.shivgan@roswalt.com": { name: "Samruddhi Shivgan", phone: "9XXXXXXXXX" },
  "irfan.ansari@roswalt.com":      { name: "Irfan Ansari",      phone: "9XXXXXXXXX" },
  "vishal.chaudhary@roswalt.com":  { name: "Vishal Chaudhary",  phone: "9XXXXXXXXX" },
  "mithilesh.menge@roswalt.com":   { name: "Mithilesh Menge",   phone: "9XXXXXXXXX" },
  "jai.bhojwani@roswalt.com":      { name: "Jai Bhojwani",      phone: "9XXXXXXXXX" },
  "vikrant.pabrekar@roswalt.com":  { name: "Vikrant Pabrekar",  phone: "9XXXXXXXXX" },
  "gaurav.chavan@roswalt.com":     { name: "Gaurav Chavan",     phone: "9XXXXXXXXX" },
  "harish.utkam@roswalt.com":      { name: "Harish Utkam",      phone: "9XXXXXXXXX" },
  "siddhesh.achari@roswalt.com":   { name: "Siddhesh Achari",   phone: "9XXXXXXXXX" },
  "raj.vichare@roswalt.com":       { name: "Raj Vichare",       phone: "8879142617" },
  "rohan.fernandes@roswalt.com":   { name: "Rohan Fernandes",   phone: "9XXXXXXXXX" },
  "vaibhavi.gujjeti@roswalt.com":  { name: "Vaibhavi Gujjeti",  phone: "9870826798" },
  // ── Admins ─────────────────────────────────────────────────────────────────
  "aziz.khan@roswalt.com":         { name: "Aziz Khan",         phone: "8879778560" },
  "vinay.vanmali@roswalt.com":     { name: "Vinay Vanmali",     phone: "9270833482" },
  "jalal.shaikh@roswalt.com":      { name: "Jalal Shaikh",      phone: "9XXXXXXXXX" },
  "nidhi.mehta@roswalt.com":       { name: "Nidhi Mehta",       phone: "9XXXXXXXXX" },
  "keerti.barua@roswalt.com":      { name: "Keerti Barua",      phone: "9XXXXXXXXX" },
  "hetal.makwana@roswalt.com":     { name: "Hetal Makwana",     phone: "9XXXXXXXXX" },
  // ── Superadmin ─────────────────────────────────────────────────────────────
  "pushkaraj.gore@roswalt.com":    { name: "Pushkaraj Gore",    phone: "9321181236" },
};

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — stubbed out (re-enable with Twilio when ready)
// ─────────────────────────────────────────────────────────────────────────────
async function sendWhatsApp(phone, message) {
  console.log(`[WA STUB] Skipping WA message to ${phone}: ${message.slice(0, 60)}...`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAT MONITOR
// ─────────────────────────────────────────────────────────────────────────────
function getDelayString(deadline, now) {
  const diffMs      = now.getTime() - deadline.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours   = Math.floor(diffMinutes / 60);
  const diffDays    = Math.floor(diffHours / 24);
  if (diffDays > 0)  return `${diffDays}d ${diffHours % 24}h overdue`;
  if (diffHours > 0) return `${diffHours}h ${diffMinutes % 60}m overdue`;
  return `${diffMinutes}m overdue`;
}

async function runTATMonitor() {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const now   = new Date();
    const tasks = await Task.find({
      approvalStatus: { $nin: ["superadmin-approved", "rejected"] },
    });

    let alertCount = 0;

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const deadline = new Date(task.dueDate + "T18:00:00");
      if (now < deadline) continue;

      if (task.lastReminderAt) {
        const minsSince = (now - new Date(task.lastReminderAt)) / 60000;
        if (minsSince < 60) continue;
      }

      const doer  = TEAM_DIRECTORY[task.assignedTo?.toLowerCase()];
      const admin = TEAM_DIRECTORY[task.assignedBy?.toLowerCase()];
      if (!doer && !admin) continue;

      const delayDuration = getDelayString(deadline, now);
      const reminderCount = (task.reminderCount ?? 0) + 1;
      const dashboardUrl  = process.env.FRONTEND_URL || "https://your-app.vercel.app";

      if (doer?.phone) {
        await sendWhatsApp(doer.phone,
`⚠️ *TASK REMINDER #${reminderCount}* — Roswalt Realty

Hello *${doer.name}*,

Your task is overdue and requires immediate attention:

📋 *Task:* ${task.title}
🕐 *Deadline was:* ${deadline.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
⏱ *Overdue by:* ${delayDuration}

Please submit your completed work or contact your manager for a revised timeline.

🔗 Dashboard: ${dashboardUrl}`
        );
      }

      if (admin?.phone) {
        await sendWhatsApp(admin.phone,
`🔴 *TAT BREACH ALERT #${reminderCount}* — Roswalt Realty

Hello *${admin.name}*,

A task you assigned is overdue:

📋 *Task:* ${task.title}
👤 *Assigned to:* ${doer?.name ?? task.assignedTo}
🕐 *Deadline was:* ${deadline.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
⏱ *Overdue by:* ${delayDuration}

Please follow up or use *Smart Assist* in the dashboard to revise the timeline.

🔗 Dashboard: ${dashboardUrl}`
        );
      }

      await Task.findByIdAndUpdate(task._id, {
        reminderCount,
        lastReminderAt: now.toISOString(),
      });

      console.log(`📲 TAT reminder #${reminderCount} logged → "${task.title}"`);
      alertCount++;
    }

    if (alertCount === 0) {
      console.log(`✓ TAT check — ${tasks.length} tasks scanned, no breaches`);
    }
  } catch (err) {
    console.error("❌ TAT monitor error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.body?.callerRole ?? ""))
    return res.status(403).json({ message: "Access denied." });
  next();
};

const validateProject = (req, res, next) => {
  const { name, projectCode, concernedDoerEmail, launchDate } = req.body;
  const missing = [
    !name               && "name",
    !projectCode        && "projectCode",
    !concernedDoerEmail && "concernedDoerEmail",
    !launchDate         && "launchDate",
  ].filter(Boolean);
  if (missing.length)
    return res.status(400).json({ message: `Missing: ${missing.join(", ")}.` });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate))
    return res.status(400).json({ message: "launchDate must be YYYY-MM-DD." });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/projects", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1)
      return res.json(await Project.find().sort({ createdAt: -1 }));
    res.json(inMemoryProjects);
  } catch (e) { res.status(500).json({ message: "Failed to fetch projects." }); }
});

app.post("/api/projects", requireRole("superadmin"), validateProject, async (req, res) => {
  try {
    const { name, description, color, projectCode, concernedDoerEmail, launchDate, status, createdBy } = req.body;
    if (mongoose.connection.readyState === 1) {
      if (await Project.findOne({ projectCode: projectCode.toUpperCase() }))
        return res.status(409).json({ message: `Project code "${projectCode}" already exists.` });
      return res.status(201).json(await Project.create({
        name, description, color, projectCode, concernedDoerEmail,
        launchDate, status: status ?? "active", createdBy,
      }));
    }
    if (inMemoryProjects.find(p => p.projectCode === projectCode.toUpperCase()))
      return res.status(409).json({ message: `Project code "${projectCode}" already exists.` });
    const p = {
      _id: String(Date.now()), id: String(Date.now()),
      name, description, color, projectCode: projectCode.toUpperCase(),
      concernedDoerEmail, launchDate, status: status ?? "active",
      createdBy, createdAt: new Date().toISOString(),
    };
    inMemoryProjects.unshift(p);
    res.status(201).json(p);
  } catch (e) { res.status(500).json({ message: "Failed to create project." }); }
});

app.put("/api/projects/:id", requireRole("superadmin"), validateProject, async (req, res) => {
  try {
    const { name, description, color, projectCode, concernedDoerEmail, launchDate, status } = req.body;
    if (mongoose.connection.readyState === 1) {
      if (await Project.findOne({ projectCode: projectCode.toUpperCase(), _id: { $ne: req.params.id } }))
        return res.status(409).json({ message: `Project code "${projectCode}" already in use.` });
      const updated = await Project.findByIdAndUpdate(
        req.params.id,
        { name, description, color, projectCode, concernedDoerEmail, launchDate, status },
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ message: "Project not found." });
      return res.json(updated);
    }
    const idx = inMemoryProjects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "Project not found." });
    inMemoryProjects[idx] = { ...inMemoryProjects[idx], name, description, color, projectCode, concernedDoerEmail, launchDate, status };
    res.json(inMemoryProjects[idx]);
  } catch (e) { res.status(500).json({ message: "Failed to update project." }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/tasks", async (req, res) => {
  try { res.json(await Task.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/tasks", async (req, res) => {
  try { res.status(201).json(await Task.create(req.body)); }
  catch (e) { res.status(400).json({ message: e.message }); }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const t = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!t) return res.status(404).json({ message: "Task not found." });
    res.json(t);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ⚠️ /all MUST be BEFORE /:id
app.delete("/api/tasks/all", async (req, res) => {
  try {
    const r = await Task.deleteMany({});
    res.json({ success: true, deleted: r.deletedCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const t = await Task.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ message: "Task not found." });
    res.json({ success: true, message: `Task "${t.title}" deleted.` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT NOTES
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/draft-notes", async (req, res) => {
  const { notes } = req.body;
  if (!notes) return res.status(400).json({ success: false, message: "Notes are required" });
  try {
    console.log("[INFO] 📝 Drafting notes...");
    const message = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are a professional writing assistant. Improve the following task completion notes for clarity, professionalism, and impact. Keep the same meaning but enhance the writing quality.\n\nOriginal notes:\n${notes}\n\nReturn ONLY the improved notes, no preamble.`,
        }],
      })
    );
    const improvedNotes = message.content[0]?.type === "text" ? message.content[0].text : notes;
    console.log("[INFO] ✓ Notes drafted");
    res.json({ success: true, improvedNotes });
  } catch (error) {
    console.error("[ERROR] Draft notes:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ success: false, message: "Anthropic API overloaded. Try again in a few seconds." });
    res.status(500).json({ success: false, message: "Failed to draft notes: " + error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/review-attachments", async (req, res) => {
  const { contentArray } = req.body;
  if (!contentArray?.length) return res.status(400).json({ success: false, message: "Content array is required" });
  try {
    console.log(`[INFO] 👁️  Reviewing ${contentArray.filter(c => c.type === "image").length} images...`);
    const message = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: contentArray }],
      })
    );
    const responseText = message.content[0]?.type === "text" ? message.content[0].text : "[]";
    let parsedResults = [];
    try {
      const m = responseText.match(/\[[\s\S]*\]/);
      parsedResults = m ? JSON.parse(m[0]) : JSON.parse(responseText);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Could not parse review results" });
    }
    const hasErrors = parsedResults.some(r => r.status === "ERROR");
    console.log(`[INFO] ✓ Review complete (${hasErrors ? "errors found" : "all clear"})`);
    res.json({ success: true, results: parsedResults, hasErrors });
  } catch (error) {
    console.error("[ERROR] Review attachments:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ success: false, message: "Anthropic API overloaded. Try again in a few seconds." });
    res.status(500).json({ success: false, message: "Failed to review attachments: " + error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CONTENT
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/score-content", async (req, res) => {
  const { systemPrompt, userContent } = req.body;
  if (!systemPrompt || !userContent) {
    return res.status(400).json({ success: false, message: "Missing systemPrompt or userContent" });
  }
  try {
    const imageCount = userContent.filter(c => c.type === "image").length;
    console.log(`[INFO] 🎯 Scoring content — ${imageCount} image(s)...`);
    const message = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      })
    );
    const rawText = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const clean = rawText.replace(/```json|```/g, "").trim();
    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error("[ERROR] score-content JSON parse failed:", clean.slice(0, 300));
      return res.status(500).json({ success: false, message: "AI returned invalid JSON — please try again", raw: clean.slice(0, 300) });
    }
    console.log("[INFO] ✓ Content scored successfully");
    res.json({ success: true, result });
  } catch (error) {
    console.error("[ERROR] score-content:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ success: false, message: "Anthropic API overloaded. Try again in a few seconds." });
    res.status(500).json({ success: false, message: "Failed to score content: " + error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SMARTCUE AI CHAT
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { model, max_tokens, system, messages } = req.body;
  if (!messages?.length) {
    return res.status(400).json({ success: false, message: "messages are required" });
  }
  try {
    console.log("[INFO] 🤖 SmartCue AI chat request...");
    const response = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model:      model      || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 1024,
        system:     system     || "You are SmartCue, an elite AI assistant for Roswalt Realty.",
        messages,
      })
    );
    const reply = response.content?.[0]?.text ?? "Systems briefly offline. Please retry.";
    console.log("[INFO] ✓ SmartCue response generated");
    res.json({ content: [{ type: "text", text: reply }] });
  } catch (error) {
    console.error("[ERROR] SmartCue chat:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ content: [{ type: "text", text: "SmartCue is overloaded. Please retry in a moment." }] });
    res.status(500).json({ content: [{ type: "text", text: "Network disruption detected. Please retry." }] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ELEVENLABS TEXT-TO-SPEECH
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });
    const selectedVoice = voiceId || "21m00Tcm4TlvDq8ikWAM";
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", errorText);
      return res.status(response.status).send(errorText);
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ message: "Failed to generate speech" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:           "ok",
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    mongoConnected:   mongoose.connection.readyState === 1,
    whatsapp:         "stubbed — enable Twilio when ready",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  ✓ Server running on port ${PORT}                      ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  Projects:   GET/POST/PUT  /api/projects             ║`);
  console.log(`║  Tasks:      GET/POST/PUT/DELETE /api/tasks          ║`);
  console.log(`║  AI:         POST /api/draft-notes                   ║`);
  console.log(`║              POST /api/review-attachments            ║`);
  console.log(`║              POST /api/score-content                 ║`);
  console.log(`║              POST /api/chat  (SmartCue AI)           ║`);
  console.log(`║  TTS:        POST /api/tts                           ║`);
  console.log(`║  Health:     GET  /health                            ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
  console.log("ElevenLabs Key:", process.env.ELEVEN_LABS_API_KEY ? "✓ Loaded" : "✗ Missing");

  // Start TAT monitor
  setTimeout(() => {
    console.log("⏱  TAT monitor started — checking every 60 seconds");
    runTATMonitor();
    setInterval(runTATMonitor, 60_000);
  }, 5_000);
});