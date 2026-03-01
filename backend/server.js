import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import qrcode from "qrcode-terminal";

// ── whatsapp-web.js is CommonJS — must import via default ─────────────────────
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true })); // ← fixed warning

// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ERROR: ANTHROPIC_API_KEY is not set in .env");
  process.exit(1);
}
console.log("✓ ANTHROPIC_API_KEY is configured");

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
// TEAM DIRECTORY  (backend only — fill in real 10-digit numbers)
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
// WHATSAPP CLIENT  (fixed puppeteer args for Windows)
// ─────────────────────────────────────────────────────────────────────────────
let waReady  = false;
let waClient = null;

function initWhatsApp() {
  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wa_auth" }),
    puppeteer: {
      headless: true,
      // ── Removed --single-process / --no-zygote / --no-first-run
      // ── These caused "Navigating frame was detached" on Windows
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,720",
      ],
    },
  });

  waClient.on("qr", (qr) => {
    console.log("\n──────────────────────────────────────────────");
    console.log("📱  SCAN THIS QR CODE WITH WHATSAPP");
    console.log("──────────────────────────────────────────────\n");
    qrcode.generate(qr, { small: true });
    console.log("\n  WhatsApp → ⋮ → Linked Devices → Link a Device\n");
    console.log("──────────────────────────────────────────────\n");
  });

  waClient.on("loading_screen", (p, m) => console.log(`⏳ WhatsApp: ${p}% — ${m}`));
  waClient.on("authenticated",  ()    => console.log("🔐 WhatsApp authenticated — session saved"));
  waClient.on("auth_failure",   (m)   => { console.error("❌ WA auth failure:", m); waReady = false; });
  waClient.on("ready",          ()    => { waReady = true; console.log("✅ WhatsApp READY — reminders active"); });
  waClient.on("disconnected",   (r)   => {
    waReady = false;
    console.warn("⚠️  WhatsApp disconnected:", r, "— reinitializing in 10s...");
    setTimeout(() => waClient.initialize().catch((e) => console.error("Reinit failed:", e.message)), 10_000);
  });

  waClient.initialize().catch((e) => console.error("❌ WA init error:", e.message));
}

// ── normalize phone → WhatsApp chat ID ───────────────────────────────────────
function toWhatsAppId(phone) {
  const digits = phone.replace(/\D/g, "");
  return `${digits.length === 10 ? "91" + digits : digits}@c.us`;
}

// ── send a WhatsApp message, returns true/false ───────────────────────────────
async function sendWhatsApp(phone, message) {
  if (!waReady) {
    console.warn(`⚠️  WA not ready — skipping ${phone}`);
    return false;
  }
  try {
    await waClient.sendMessage(toWhatsAppId(phone), message);
    console.log(`✅ WA sent → ${phone}`);
    return true;
  } catch (e) {
    console.error(`❌ WA failed → ${phone}:`, e.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND TAT MONITOR  (fully independent — no frontend involvement)
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
  if (!waReady) {
    console.log("⏭  TAT monitor skipped — WhatsApp not ready yet");
    return;
  }

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

      // Avoid spamming — only send once per hour per task
      if (task.lastReminderAt) {
        const minsSince = (now - new Date(task.lastReminderAt)) / 60000;
        if (minsSince < 60) continue;
      }

      const doer  = TEAM_DIRECTORY[task.assignedTo?.toLowerCase()];
      const admin = TEAM_DIRECTORY[task.assignedBy?.toLowerCase()];
      if (!doer && !admin) continue;

      const delayDuration = getDelayString(deadline, now);
      const reminderCount = (task.reminderCount ?? 0) + 1;

      if (doer?.phone) {
        await sendWhatsApp(doer.phone,
`⚠️ *TASK REMINDER #${reminderCount}* — Roswalt Realty

Hello *${doer.name}*,

Your task is overdue and requires immediate attention:

📋 *Task:* ${task.title}
🕐 *Deadline was:* ${deadline.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
⏱ *Overdue by:* ${delayDuration}

Please submit your completed work or contact your manager for a revised timeline.

🔗 Dashboard: http://localhost:3000`
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

🔗 Dashboard: http://localhost:3000`
        );
      }

      await Task.findByIdAndUpdate(task._id, {
        reminderCount,
        lastReminderAt: now.toISOString(),
      });

      console.log(`📲 TAT reminder #${reminderCount} sent → "${task.title}"`);
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

// ⚠️  /all MUST be BEFORE /:id
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
// WHATSAPP STATUS & TEST
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/whatsapp/status", (req, res) => {
  res.json({ ready: waReady });
});

app.post("/api/whatsapp/test", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "phone is required" });
  const sent = await sendWhatsApp(phone, message || "✅ Test message from Roswalt Task System");
  res.json({ success: sent });
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:           "ok",
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    mongoConnected:   mongoose.connection.readyState === 1,
    whatsapp:         waReady ? "connected" : "not ready",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  ✓ Server running on http://localhost:${PORT}          ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  Projects:   GET/POST/PUT  /api/projects             ║`);
  console.log(`║  Tasks:      GET/POST/PUT/DELETE /api/tasks          ║`);
  console.log(`║  AI:         POST /api/draft-notes                   ║`);
  console.log(`║              POST /api/review-attachments            ║`);
  console.log(`║  WhatsApp:   GET  /api/whatsapp/status               ║`);
  console.log(`║              POST /api/whatsapp/test                 ║`);
  console.log(`║  Health:     GET  /health                            ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  // 1. Start WhatsApp
  initWhatsApp();

  // 2. Start TAT monitor — 30s delay gives WhatsApp time to connect first
  setTimeout(() => {
    console.log("⏱  TAT monitor started — checking every 60 seconds");
    runTATMonitor();
    setInterval(runTATMonitor, 60_000);
  }, 30_000);
});