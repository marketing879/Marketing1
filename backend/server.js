import Anthropic from "@anthropic-ai/sdk";
import rateLimit from "express-rate-limit";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("Cloudinary: ✔ Configured");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("Cloudinary: ✔ Configured");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("Cloudinary: ✔ Configured");

const app        = express();
const httpServer = createServer(app);

// ── ALLOWED ORIGINS (single source of truth) ─────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://marketing1-delta.vercel.app",
  "https://www.roswaltsmartcue.com",
  "https://roswaltsmartcue.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

// ── SOCKET.IO (chat real-time layer) ─────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ["websocket", "polling"],
});

app.set("trust proxy", 1);

// General API rate limit — 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for sensitive endpoints — 10 requests per 15 minutes
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many attempts. Please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);
app.use("/api/tts", strictLimiter);
app.use("/api/score-content", strictLimiter);
app.use("/api/draft-notes", strictLimiter);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.options("/{*path}", cors());
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const reqOrigin = req.headers.origin;
    res.header("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0]);
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
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
  console.error("✘ ERROR: ANTHROPIC_API_KEY is not set in .env");
  process.exit(1);
}
console.log("✔ ANTHROPIC_API_KEY is configured");

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

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
        console.warn(`[RETRY] Anthropic overloaded. Attempt ${attempt}/${maxRetries} – retrying in ${delay}ms...`);
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
    .then(() => console.log("✔ MongoDB connected"))
    .catch((err) => console.error("✘ MongoDB error:", err));
} else {
  console.warn("⚠ MONGO_URI not set – projects will use in-memory fallback.");
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const projectSchema = new mongoose.Schema({
  name:               { type: String, required: true, trim: true },
  description:        { type: String, default: "" },
  color:              { type: String, default: "#c9a96e" },
  projectCode:        { type: String, required: true, unique: true, uppercase: true, trim: true },
  concernedDoerEmail: { type: String, required: false, lowercase: true, trim: true },
  launchDate:         { type: String, required: true },
  status:             { type: String, enum: ["active", "inactive"], default: "active" },
  createdBy:          { type: String },
}, { timestamps: true });

// ── FIX: added `id` field to store the frontend UUID ─────────────────────────
const taskSchema = new mongoose.Schema({
  id:              { type: String, index: true },   // ← frontend UUID (crypto.randomUUID)
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
}, { timestamps: true, strict: false }); // strict:false keeps any extra fields the frontend sends

taskSchema.index({ assignedBy: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ approvalStatus: 1 });
const Project = mongoose.model("Project", projectSchema);
const Task    = mongoose.model("Task",    taskSchema);

let inMemoryProjects = [];

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

// Chat message — text, sticker, gif, meeting link, voice note
const chatMessageSchema = new mongoose.Schema({
  id:           { type: String, index: true },
  channelId:    { type: String, required: true, index: true },
  authorId:     { type: String, required: true },
  authorName:   { type: String, required: true },
  authorRole:   { type: String, required: true },
  authorAvatar: { type: String, default: "" },
  authorEmail:  { type: String, default: "" },
  type:         { type: String, enum: ["text","sticker","gif","meeting","voice","emoji"], default: "text" },
  text:         { type: String, default: "" },
  gif:          { type: String },
  meeting: {
    title:     String,
    link:      String,
    createdBy: String,
  },
  reactions:  { type: Map, of: [String], default: {} },   // emoji → [userId, ...]
  readBy:     [String],
  deletedAt:  Date,
}, { timestamps: true });
chatMessageSchema.index({ channelId: 1, createdAt: -1 });
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

// Chat presence — tracks online status, avatar (Cloudinary URL), status text
const chatPresenceSchema = new mongoose.Schema({
  email:    { type: String, unique: true, required: true, lowercase: true },
  name:     { type: String, default: "" },
  role:     { type: String, default: "staff" },
  avatar:   { type: String, default: "" },
  status:   { type: String, default: "Available" },
  isOnline: { type: Boolean, default: false },
  socketId: { type: String },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });
const ChatPresence = mongoose.model("ChatPresence", chatPresenceSchema);

// In-memory fallbacks for when MongoDB is not connected
let inMemoryChatMessages = [];
let inMemoryChatPresence = [];

// ─────────────────────────────────────────────────────────────────────────────
// TEAM DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────
const TEAM_DIRECTORY = {
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
  "aziz.khan@roswalt.com":         { name: "Aziz Khan",         phone: "8879778560" },
  "vinay.vanmali@roswalt.com":     { name: "Vinay Vanmali",     phone: "9270833482" },
  "jalal.shaikh@roswalt.com":      { name: "Jalal Shaikh",      phone: "9XXXXXXXXX" },
  "nidhi.mehta@roswalt.com":       { name: "Nidhi Mehta",       phone: "9XXXXXXXXX" },
  "keerti.barua@roswalt.com":      { name: "Keerti Barua",      phone: "9XXXXXXXXX" },
  "hetal.makwana@roswalt.com":     { name: "Hetal Makwana",     phone: "9XXXXXXXXX" },
  "pushkaraj.gore@roswalt.com":    { name: "Pushkaraj Gore",    phone: "9321181236" },
};

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP – stubbed (re-enable with Twilio when ready)
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
`⚠️ *TASK REMINDER #${reminderCount}* – Roswalt Realty

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
`🔴 *TAT BREACH ALERT #${reminderCount}* – Roswalt Realty

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

      // ── FIX: update by custom `id` field, not _id ──────────────────────────
      await Task.findOneAndUpdate(
        { id: task.id || String(task._id) },
        { reminderCount, lastReminderAt: now.toISOString() }
      );

      console.log(`📲 TAT reminder #${reminderCount} logged → "${task.title}"`);
      alertCount++;
    }

    if (alertCount === 0) {
      console.log(`✔ TAT check – ${tasks.length} tasks scanned, no breaches`);
    }
  } catch (err) {
    console.error("✘ TAT monitor error:", err.message);
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
  let { name, projectCode, concernedDoerEmail, launchDate } = req.body;
  // Normalize ISO datetime → YYYY-MM-DD (handles date picker returning full ISO string)
  if (launchDate && launchDate.length > 10) launchDate = launchDate.slice(0, 10);
  req.body.launchDate = launchDate; // update for downstream handlers
  const missing = [
    !name               && "name",
    !projectCode        && "projectCode",
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
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided." });
    const b64 = req.file.buffer.toString("base64");
    const dataUri = \data:\;base64,\\;
    const folder = req.body?.folder || "smartcue";
    const result = await cloudinary.uploader.upload(dataUri, { folder, resource_type: "auto" });
    res.json({ success: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("[Cloudinary] Upload failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/projects",, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1)
      return res.json(await Project.find().sort({ createdAt: -1 }));
    res.json(inMemoryProjects);
  } catch (e) { res.status(500).json({ message: "Failed to fetch projects." }); }
});

app.post("/api/projects", requireRole("superadmin", "supremo"), validateProject, async (req, res) => {
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

app.put("/api/projects/:id", requireRole("superadmin", "supremo"), validateProject, async (req, res) => {
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
// TASK ROUTES  ── FIXED: all routes now use custom `id` field, not _id
// ─────────────────────────────────────────────────────────────────────────────

// GET – normalize so every task has an `id` the frontend can use
app.get("/api/tasks", async (req, res) => {
  try {
    const callerEmail = (req.query.email ?? "").toLowerCase();
    const callerRole  = (req.query.role  ?? "").toLowerCase();
    // Superadmin and supremo see all tasks; admins see only their own
    const filter = (callerRole === "superadmin" || callerRole === "supremo")
      ? {}
      : callerEmail
        ? { $or: [{ assignedBy: { $regex: new RegExp("^" + callerEmail + "$", "i") } }, { assignedTo: { $regex: new RegExp("^" + callerEmail + "$", "i") } }] }
        : {};
    const tasks = await Task.find(filter).select("-attachments -scoreData").sort({ createdAt: -1 }).lean();
    const normalized = tasks.map(t => { if (!t.id) t.id = String(t._id); return t; });
    res.json(normalized);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST – preserve the frontend UUID as `id`
app.post("/api/tasks", async (req, res) => {
  try {
    const data = {
      ...req.body,
      id: req.body.id || String(Date.now()), // keep crypto.randomUUID() from frontend
    };
    const created = await Task.create(data);
    const obj = created.toObject();
    if (!obj.id) obj.id = String(obj._id);
    res.status(201).json(obj);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ⚠️  /all MUST stay above /:id
app.delete("/api/tasks/all", async (req, res) => {
  try {
    const r = await Task.deleteMany({});
    res.json({ success: true, deleted: r.deletedCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT – find by custom `id` first, fall back to _id for any legacy docs
app.put("/api/tasks/:id", async (req, res) => {
  try {
    let t = await Task.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!t) t = await Task.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!t) return res.status(404).json({ message: "Task not found." });
    const obj = t.toObject();
    if (!obj.id) obj.id = String(obj._id);
    res.json(obj);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// DELETE – find by custom `id` first, fall back to _id for any legacy docs
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    let t = await Task.findOneAndDelete({ id: req.params.id });
    if (!t) t = await Task.findByIdAndDelete(req.params.id);
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are a professional writing assistant. Improve the following task completion notes for clarity, professionalism, and impact. Keep the same meaning but enhance the writing quality.\n\nOriginal notes:\n${notes}\n\nReturn ONLY the improved notes, no preamble.`,
        }],
      })
    );
    const improvedNotes = message.content[0]?.type === "text" ? message.content[0].text : notes;
    console.log("[INFO] ✔ Notes drafted");
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
        model: "claude-haiku-4-5-20251001",
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
    console.log(`[INFO] ✔ Review complete (${hasErrors ? "errors found" : "all clear"})`);
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
    console.log(`[INFO] 🎯 Scoring content – ${imageCount} image(s)...`);
    const message = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        temperature: 0,
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
      return res.status(500).json({ success: false, message: "AI returned invalid JSON – please try again", raw: clean.slice(0, 300) });
    }
    console.log("[INFO] ✔ Content scored successfully");
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
        model:      model      || "claude-haiku-4-5-20251001",
        max_tokens: max_tokens || 1024,
        system:     system     || "You are SmartCue, an elite AI assistant for Roswalt Realty.",
        messages,
      })
    );
    const reply = response.content?.[0]?.text ?? "Systems briefly offline. Please retry.";
    console.log("[INFO] ✔ SmartCue response generated");
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
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.35, similarity_boost: 0.85, style: 0.40, use_speaker_boost: true },
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
    whatsapp:         "stubbed – enable Twilio when ready",
    chat:             "socket.io active",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT REST ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper: normalize a ChatMessage doc ──────────────────────────────────────
function normMsg(m) {
  const obj = m.toObject ? m.toObject() : m;
  if (!obj.id) obj.id = String(obj._id);
  // Convert Map to plain object for JSON
  if (obj.reactions instanceof Map) {
    const plain = {};
    for (const [k, v] of obj.reactions) plain[k] = v;
    obj.reactions = plain;
  }
  return obj;
}

// GET /api/chat/messages/:channelId — last 100 messages, oldest first
app.get("/api/chat/messages/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? "100"), 200);

    if (mongoose.connection.readyState === 1) {
      const msgs = await ChatMessage
        .find({ channelId, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return res.json(msgs.reverse().map(m => {
        if (!m.id) m.id = String(m._id);
        // reactions is stored as Map in Mongo — lean() gives a plain object already
        return m;
      }));
    }

    const fallback = inMemoryChatMessages
      .filter(m => m.channelId === channelId)
      .slice(-limit);
    res.json(fallback);
  } catch (e) {
    console.error("[Chat] GET messages error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

// POST /api/chat/messages — persist a new message (also broadcast via socket on client side)
app.post("/api/chat/messages", async (req, res) => {
  try {
    const data = { ...req.body, id: req.body.id || String(Date.now() + Math.random()) };

    if (mongoose.connection.readyState === 1) {
      const created = await ChatMessage.create(data);
      return res.status(201).json(normMsg(created));
    }

    inMemoryChatMessages.push(data);
    if (inMemoryChatMessages.length > 1000) inMemoryChatMessages = inMemoryChatMessages.slice(-800);
    res.status(201).json(data);
  } catch (e) {
    console.error("[Chat] POST message error:", e.message);
    res.status(400).json({ message: e.message });
  }
});

// PUT /api/chat/messages/:id/react — toggle a reaction
app.put("/api/chat/messages/:id/react", async (req, res) => {
  try {
    const { emoji, userId } = req.body;
    if (!emoji || !userId)
      return res.status(400).json({ message: "emoji and userId are required." });

    if (mongoose.connection.readyState === 1) {
      const msg = await ChatMessage.findOne({ id: req.params.id });
      if (!msg) return res.status(404).json({ message: "Message not found." });

      const users = msg.reactions.get(emoji) || [];
      const idx = users.indexOf(userId);
      if (idx > -1) users.splice(idx, 1); else users.push(userId);
      msg.reactions.set(emoji, users);
      await msg.save();

      const updated = normMsg(msg);
      // Broadcast updated reactions to the channel
      io.to(`channel:${msg.channelId}`).emit("reaction_update", {
        messageId: msg.id,
        emoji,
        userId,
        reactions: updated.reactions,
      });
      return res.json(updated);
    }

    // In-memory fallback
    const msg = inMemoryChatMessages.find(m => m.id === req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found." });
    if (!msg.reactions) msg.reactions = {};
    const users = msg.reactions[emoji] || [];
    const idx = users.indexOf(userId);
    if (idx > -1) users.splice(idx, 1); else users.push(userId);
    msg.reactions[emoji] = users;
    res.json(msg);
  } catch (e) {
    console.error("[Chat] React error:", e.message);
    res.status(400).json({ message: e.message });
  }
});

// DELETE /api/chat/messages/:id — soft-delete a message
app.delete("/api/chat/messages/:id", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const msg = await ChatMessage.findOneAndUpdate(
        { id: req.params.id },
        { $set: { deletedAt: new Date(), text: "[message deleted]" } },
        { new: true }
      );
      if (!msg) return res.status(404).json({ message: "Message not found." });
      io.to(`channel:${msg.channelId}`).emit("message_deleted", { messageId: msg.id });
      return res.json({ success: true });
    }
    inMemoryChatMessages = inMemoryChatMessages.filter(m => m.id !== req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/chat/presence — all online users
app.get("/api/chat/presence", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const online = await ChatPresence.find({ isOnline: true }).lean();
      return res.json(online);
    }
    res.json(inMemoryChatPresence.filter(p => p.isOnline));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/chat/presence — upsert presence record (name, role, avatar, status)
// Called by the frontend after login and after profile updates
app.patch("/api/chat/presence", async (req, res) => {
  try {
    const { email, ...updates } = req.body;
    if (!email) return res.status(400).json({ message: "email is required." });

    if (mongoose.connection.readyState === 1) {
      const presence = await ChatPresence.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: { ...updates, email: email.toLowerCase() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json(presence);
    }

    const idx = inMemoryChatPresence.findIndex(p => p.email === email.toLowerCase());
    const record = { email: email.toLowerCase(), ...updates, updatedAt: new Date().toISOString() };
    if (idx > -1) inMemoryChatPresence[idx] = { ...inMemoryChatPresence[idx], ...record };
    else inMemoryChatPresence.push(record);
    res.json(record);
  } catch (e) {
    console.error("[Chat] PATCH presence error:", e.message);
    res.status(400).json({ message: e.message });
  }
});

// POST /api/chat/meeting — generate a meeting room link
// Integrates with Daily.co if DAILY_API_KEY is set; falls back to a mock link
app.post("/api/chat/meeting", async (req, res) => {
  try {
    const { title } = req.body;
    if (process.env.DAILY_API_KEY) {
      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { max_participants: 50, enable_chat: false, exp: Math.floor(Date.now() / 1000) + 7200 },
        }),
      });
      if (!response.ok) throw new Error(`Daily.co error: ${response.status}`);
      const room = await response.json();
      console.log(`[Chat] Daily.co room created: ${room.url}`);
      return res.json({ url: room.url, roomName: room.name, provider: "daily" });
    }

    // Fallback — generate a deterministic mock link
    const roomId = Math.random().toString(36).substr(2, 8);
    const url = `https://meet.roswalt.io/room-${roomId}`;
    console.log(`[Chat] Mock meeting link: ${url}`);
    res.json({ url, roomName: `room-${roomId}`, provider: "mock", title });
  } catch (e) {
    console.error("[Chat] Meeting creation error:", e.message);
    res.status(500).json({ message: "Could not create meeting room: " + e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO — REAL-TIME CHAT ENGINE
// ─────────────────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── user_join: called right after login with { email, name, role, avatar } ──
  socket.on("user_join", async (user) => {
    if (!user?.email) return;
    socket.data.user = user;
    socket.join("presence");

    if (mongoose.connection.readyState === 1) {
      await ChatPresence.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        { $set: { ...user, email: user.email.toLowerCase(), isOnline: true, socketId: socket.id, lastSeen: new Date() } },
        { upsert: true, setDefaultsOnInsert: true }
      ).catch(e => console.error("[Socket] Presence upsert error:", e.message));
    } else {
      const idx = inMemoryChatPresence.findIndex(p => p.email === user.email.toLowerCase());
      const record = { ...user, email: user.email.toLowerCase(), isOnline: true, socketId: socket.id };
      if (idx > -1) inMemoryChatPresence[idx] = record; else inMemoryChatPresence.push(record);
    }

    // Broadcast updated online list to all clients
    io.emit("user_online", { ...user, isOnline: true, socketId: socket.id });
    console.log(`[Socket] ${user.name} (${user.role}) joined`);
  });

  // ── join_channel: subscribe to a channel room ─────────────────────────────
  socket.on("join_channel", (channelId) => {
    if (!channelId) return;
    socket.join(`channel:${channelId}`);
    console.log(`[Socket] ${socket.data.user?.name || socket.id} → channel:${channelId}`);
  });

  // ── leave_channel ─────────────────────────────────────────────────────────
  socket.on("leave_channel", (channelId) => {
    if (channelId) socket.leave(`channel:${channelId}`);
  });

  // ── send_message: persist + broadcast ────────────────────────────────────
  socket.on("send_message", async (msg) => {
    if (!msg?.channelId || !msg?.authorId) return;

    const data = { ...msg, id: msg.id || String(Date.now() + Math.random()) };

    // Persist
    if (mongoose.connection.readyState === 1) {
      ChatMessage.create(data).catch(e => console.error("[Socket] Message save error:", e.message));
    } else {
      inMemoryChatMessages.push(data);
    }

    // Broadcast to everyone else in the channel (sender already has it locally)
    socket.to(`channel:${msg.channelId}`).emit("new_message", data);
    console.log(`[Socket] Message in ${msg.channelId} from ${msg.authorName}: "${String(msg.text || msg.type).slice(0, 40)}"`);
  });

  // ── typing: forward typing indicator to channel ───────────────────────────
  socket.on("typing", ({ channelId, isTyping }) => {
    if (!channelId) return;
    socket.to(`channel:${channelId}`).emit("user_typing", {
      name: socket.data.user?.name || "Someone",
      channelId,
      isTyping,
    });
  });

  // ── react: toggle reaction and broadcast ─────────────────────────────────
  socket.on("react", async ({ messageId, emoji, userId, channelId }) => {
    if (!messageId || !emoji || !userId || !channelId) return;

    if (mongoose.connection.readyState === 1) {
      const msg = await ChatMessage.findOne({ id: messageId }).catch(() => null);
      if (msg) {
        const users = msg.reactions.get(emoji) || [];
        const idx = users.indexOf(userId);
        if (idx > -1) users.splice(idx, 1); else users.push(userId);
        msg.reactions.set(emoji, users);
        await msg.save().catch(e => console.error("[Socket] Reaction save error:", e.message));
      }
    } else {
      const msg = inMemoryChatMessages.find(m => m.id === messageId);
      if (msg) {
        if (!msg.reactions) msg.reactions = {};
        const users = msg.reactions[emoji] || [];
        const idx = users.indexOf(userId);
        if (idx > -1) users.splice(idx, 1); else users.push(userId);
        msg.reactions[emoji] = users;
      }
    }

    io.to(`channel:${channelId}`).emit("reaction_update", { messageId, emoji, userId });
  });

  // ── call_request: notify a user of an incoming video call ────────────────
  socket.on("call_request", ({ channelId, fromUser }) => {
    socket.to(`channel:${channelId}`).emit("call_incoming", {
      from: fromUser || socket.data.user,
      channelId,
    });
  });

  // ── call_end: notify channel that call has ended ──────────────────────────
  socket.on("call_end", ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit("call_ended", { channelId });
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    const user = socket.data.user;
    if (user?.email) {
      if (mongoose.connection.readyState === 1) {
        await ChatPresence.findOneAndUpdate(
          { email: user.email.toLowerCase() },
          { $set: { isOnline: false, socketId: null, lastSeen: new Date() } }
        ).catch(e => console.error("[Socket] Disconnect presence error:", e.message));
      } else {
        const p = inMemoryChatPresence.find(p => p.email === user.email.toLowerCase());
        if (p) { p.isOnline = false; p.socketId = null; }
      }
      io.emit("user_offline", { email: user.email, id: user.id || user.email });
      console.log(`[Socket] Disconnected: ${user.name} (${user.role})`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER  (httpServer replaces app.listen so Socket.io shares the port)
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  ✔ Server + Socket.io running on port ${PORT}              ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Projects:   GET/POST/PUT  /api/projects                ║`);
  console.log(`║  Tasks:      GET/POST/PUT/DELETE /api/tasks             ║`);
  console.log(`║  Chat:       GET  /api/chat/messages/:channelId         ║`);
  console.log(`║              POST /api/chat/messages                    ║`);
  console.log(`║              PUT  /api/chat/messages/:id/react          ║`);
  console.log(`║              DEL  /api/chat/messages/:id                ║`);
  console.log(`║              GET  /api/chat/presence                    ║`);
  console.log(`║              PATCH/api/chat/presence                    ║`);
  console.log(`║              POST /api/chat/meeting                     ║`);
  console.log(`║  Socket.io:  ws://  (chat real-time)                    ║`);
  console.log(`║  AI:         POST /api/draft-notes                      ║`);
  console.log(`║              POST /api/review-attachments               ║`);
  console.log(`║              POST /api/score-content                    ║`);
  console.log(`║              POST /api/chat  (SmartCue AI)              ║`);
  console.log(`║  TTS:        POST /api/tts                              ║`);
  console.log(`║  Health:     GET  /health                               ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  console.log("ElevenLabs Key:", process.env.ELEVEN_LABS_API_KEY ? "✔ Loaded" : "✗ Missing");
  console.log("Daily.co Key:  ", process.env.DAILY_API_KEY        ? "✔ Loaded" : "✗ Missing (using mock links)");

  setInterval(() => {
    fetch("https://adaptable-patience-production-45da.up.railway.app/health").catch(() => {});
  }, 300000); // ping every 5 minutes to prevent sleep

  setTimeout(() => {
    console.log("⏱  TAT monitor started – checking every 4 hours");
    runTATMonitor();
    setInterval(runTATMonitor, 14400000);
  }, 5_000);
});




