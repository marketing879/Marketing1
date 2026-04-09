import Anthropic from "@anthropic-ai/sdk";
import rateLimit from "express-rate-limit";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import webpush from "web-push";

dotenv.config();

// Node 20 has fetch built-in — no polyfill needed.

// ─────────────────────────────────────────────────────────────────────────────
// CLOUDINARY
// ─────────────────────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
console.log("Cloudinary: ✔ Configured");

// ── WEB PUSH (VAPID) ──────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "admin@roswalt.com"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log("✔ Web Push (VAPID) configured");
} else {
  console.warn("⚠ VAPID keys not set — push notifications disabled.");
}

const app        = express();
const httpServer = createServer(app);

httpServer.setTimeout(300_000);
httpServer.keepAliveTimeout = 120_000;

// ── ALLOWED ORIGINS ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://marketing1-delta.vercel.app",
  "https://roswaltsmartcue.com",
  "https://www.roswaltsmartcue.com",
  "http://localhost:3000",
];

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ["websocket", "polling"],
});

app.set("trust proxy", 1);

// ── RATE LIMITERS ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
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

app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.path} — origin: ${req.headers.origin ?? "none"}`);
  next();
});

// ── BODY PARSERS (registered ONCE at 100 mb) ──────────────────────────────────
app.use(express.json({ limit: "250mb" }));
app.use(express.urlencoded({ limit: "250mb", extended: true }));

// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC CLIENT
// ─────────────────────────────────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✘ ANTHROPIC_API_KEY is not set — exiting.");
  process.exit(1);
}
console.log("✔ ANTHROPIC_API_KEY is configured");

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
        console.warn(`[RETRY] Anthropic overloaded — attempt ${attempt}/${maxRetries}, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else { throw err; }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONGODB — with auto-reconnect
// ─────────────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

function connectMongo() {
  if (!MONGO_URI) {
    console.warn("⚠ MONGO_URI not set — running in-memory mode.");
    return;
  }
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS:          45_000,
    heartbeatFrequencyMS:     10_000,
    maxIdleTimeMS:            30_000,
    connectTimeoutMS:         20_000,
  })
    .then(() => console.log("✔ MongoDB connected"))
    .catch(err => {
      console.error("✘ MongoDB connection error:", err.message);
      console.log("🔄 Retrying MongoDB connection in 10s…");
      setTimeout(connectMongo, 10_000);
    });
}

mongoose.connection.on("disconnected", () => {
  console.warn("⚠ MongoDB disconnected — reconnecting…");
  setTimeout(connectMongo, 5_000);
});

mongoose.connection.on("error", err => {
  console.error("MongoDB error:", err.message);
});

connectMongo();

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

const taskSchema = new mongoose.Schema({
  id:              { type: String, index: true },
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
  reminderCount:        { type: Number,  default: 0    },
  lastReminderAt:       { type: String,  default: null },
  // ── Autopulse ────────────────────────────────────────────────────────────
  isAutopulse:          { type: Boolean, default: false },
  autopulseCycleDays:   { type: Number,  default: 7    },
  autopulseParentId:    { type: String,  default: null },
  autopulseGeneration:  { type: Number,  default: 0    },
  autopulseScheduledFor:{ type: String,  default: null },
  autopulseNextCreated: { type: Boolean, default: false },
  autopulsePaused:      { type: Boolean, default: false },
}, { timestamps: true, strict: false });

taskSchema.index({ assignedBy: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ approvalStatus: 1 });

const userSchema = new mongoose.Schema({
  id:       { type: String, index: true },
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  role:     { type: String, enum: ["superadmin", "supremo", "admin", "staff"], default: "staff" },
  phone:    { type: String, default: "" },
  password: { type: String, default: "" },
  avatar:   { type: String, default: "" },
  isActive:     { type: Boolean, default: true },
  voiceEnabled: { type: Boolean, default: true },  // global voice toggle per user
}, { timestamps: true, strict: false });

const assistanceTicketSchema = new mongoose.Schema({
  id:           { type: String, index: true },
  taskId:       { type: String },
  taskTitle:    { type: String },
  taskDueDate:  { type: String },
  assignedTo:   { type: String },
  assignedBy:   { type: String },
  raisedBy:     { type: String },
  ticketType:   { type: String, default: "general-query" },
  reason:       { type: String },
  staffNote:    { type: String },
  status:       { type: String, default: "open" },
  adminComment: { type: String },
  approvedBy:   { type: String },
  approvedAt:   { type: String },
  raisedAt:     { type: String, default: () => new Date().toISOString() },
}, { timestamps: true, strict: false });

const pushSubscriptionSchema = new mongoose.Schema({
  email:        { type: String, required: true, lowercase: true, trim: true, index: true },
  subscription: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt:    { type: Date, default: Date.now },
});

const chatMessageSchema = new mongoose.Schema({
  id:           { type: String, index: true },
  channelId:    { type: String, required: true, index: true },
  authorId:     { type: String, required: true },
  authorName:   { type: String, required: true },
  authorRole:   { type: String, required: true },
  authorAvatar: { type: String, default: "" },
  authorEmail:  { type: String, default: "" },
  type:         { type: String, enum: ["text", "sticker", "gif", "meeting", "voice", "emoji", "system_notification"], default: "text" },
  text:         { type: String, default: "" },
  gif:          { type: String },
  meeting: {
    title:     String,
    link:      String,
    createdBy: String,
  },
  reactions: { type: Map, of: [String], default: {} },
  readBy:    [String],
  deletedAt: Date,
}, { timestamps: true });
chatMessageSchema.index({ channelId: 1, createdAt: -1 });

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


// ── SystemSettings — singleton document, controls system-wide toggles ─────────
const systemSettingsSchema = new mongoose.Schema(
  {
    _id:          { type: String, default: "singleton" },
    voiceEnabled: { type: Boolean, default: false },  // OFF by default — Supremo controls this
  },
  { timestamps: true }
);
systemSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findById("singleton");
  if (!doc) doc = await this.create({ _id: "singleton", voiceEnabled: false });
  return doc;
};

// ── Models (guard against OverwriteModelError on hot-reload) ─────────────────
const Project          = mongoose.models.Project          || mongoose.model("Project",          projectSchema);
const Task             = mongoose.models.Task             || mongoose.model("Task",             taskSchema);
const User             = mongoose.models.User             || mongoose.model("User",             userSchema);
const AssistanceTicket = mongoose.models.AssistanceTicket || mongoose.model("AssistanceTicket", assistanceTicketSchema);
const PushSub          = mongoose.models.PushSub          || mongoose.model("PushSub",          pushSubscriptionSchema);
const ChatMessage      = mongoose.models.ChatMessage      || mongoose.model("ChatMessage",      chatMessageSchema);
const ChatPresence     = mongoose.models.ChatPresence     || mongoose.model("ChatPresence",     chatPresenceSchema);
const SystemSettings   = mongoose.models.SystemSettings   || mongoose.model("SystemSettings",   systemSettingsSchema);

// ── In-memory fallbacks ───────────────────────────────────────────────────────
let inMemoryProjects     = [];
let inMemoryUsers        = [];
let inMemoryChatMessages = [];
let inMemoryChatPresence = [];

// ── DB readiness helper ───────────────────────────────────────────────────────
const dbReady = () => mongoose.connection.readyState === 1;

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
// WHATSAPP – stubbed
// ─────────────────────────────────────────────────────────────────────────────
async function sendWhatsApp(phone, message) {
  console.log(`[WA STUB] ${phone}: ${message.slice(0, 60)}…`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function sendPushToSubscription(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await PushSub.deleteOne({ "subscription.endpoint": subscription.endpoint }).catch(() => {});
      console.log("[Push] Removed expired subscription");
    } else {
      console.error("[Push] sendNotification error:", err.message);
    }
    return false;
  }
}

async function sendPushToUser(email, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !dbReady()) return;
  try {
    const subs = await PushSub.find({ email: email.toLowerCase() });
    if (!subs.length) return;
    await Promise.all(subs.map(s => sendPushToSubscription(s.subscription, payload)));
    console.log(`[Push] Sent to ${subs.length} device(s) for ${email}`);
  } catch (err) {
    console.error("[Push] sendPushToUser error:", err.message);
  }
}

async function sendPushToRole(roles, payload, excludeEmail = "") {
  if (!process.env.VAPID_PUBLIC_KEY || !dbReady()) return;
  try {
    const roleList = Array.isArray(roles) ? roles : [roles];
    const allSubs  = await PushSub.find({}).lean();
    const users    = await User.find({ role: { $in: roleList } }, "email").lean();
    const emails   = new Set(users.map(u => u.email.toLowerCase()));
    const filtered = allSubs.filter(
      s => emails.has(s.email.toLowerCase()) &&
           s.email.toLowerCase() !== excludeEmail.toLowerCase()
    );
    if (!filtered.length) return;
    await Promise.all(filtered.map(s => sendPushToSubscription(s.subscription, payload)));
    console.log(`[Push] Broadcast to ${filtered.length} device(s) for roles: ${roleList.join(",")}`);
  } catch (err) {
    console.error("[Push] sendPushToRole error:", err.message);
  }
}

function broadcastTaskNotification(eventData) {
  io.emit("task_notification", eventData);
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
  if (!dbReady()) {
    console.log("[TAT] Skipping — DB not ready");
    return;
  }
  try {
    const now   = new Date();
    const tasks = await Task.find({ approvalStatus: { $nin: ["superadmin-approved", "rejected"] } })
      .lean()
      .maxTimeMS(15_000);
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
      const dashboardUrl  = process.env.FRONTEND_URL || "https://marketing1-delta.vercel.app";

      // ── Send Smart Assist reminder via ChatRoom DM (replaces WhatsApp) ────
      const taskId      = task.id || String(task._id);
      const doerEmail   = (task.assignedTo  || "").toLowerCase();
      const adminEmail  = (task.assignedBy  || "").toLowerCase();
      const doerName    = doer?.name  || doerEmail.split("@")[0];
      const adminName   = admin?.name || adminEmail.split("@")[0];

      // ── DM to doer — opens SmartAssist when clicked ──────────────────────
      if (doerEmail) {
        const dmChannelId = "dm_" + [doerEmail, adminEmail || doerEmail].sort().join("__");
        const dmMsg = {
          id:           `tat_doer_${taskId}_${Date.now()}`,
          channelId:    dmChannelId,
          authorId:     adminEmail || "system",
          authorName:   adminName  || "SmartCue System",
          authorRole:   "admin",
          authorEmail:  adminEmail || "system",
          authorAvatar: "",
          author: {
            id: adminEmail || "system", name: adminName || "SmartCue System",
            role: "admin", email: adminEmail || "system", avatar: "",
          },
          type:          "system_notification",
          notifType:     "task_reminder",
          text:          `⏰ TAT Reminder #${reminderCount}: Your task "${task.title}" is overdue by ${delayDuration}. Please submit or provide a revised timeline.`,
          taskId,
          taskTitle:     task.title,
          delayDuration,
          reminderCount,
          dueDate:       task.dueDate || "",
          projectName:   "",
          reactions:     {},
          readBy:        [],
          createdAt:     new Date().toISOString(),
        };
        await ChatMessage.create(dmMsg).catch(e => console.error("[TAT] DM to doer failed:", e.message));
        io.to(`channel:${dmChannelId}`).emit("new_message", dmMsg);
      }

      // ── DM to admin — awareness notification ──────────────────────────────
      if (adminEmail && adminEmail !== doerEmail) {
        const adminDmChannelId = "dm_" + [adminEmail, adminEmail].sort().join("__");
        // Use a system-wide notification channel for admin
        const adminNotifChannel = `notif_admin_${adminEmail}`;
        const adminMsg = {
          id:           `tat_admin_${taskId}_${Date.now()}`,
          channelId:    adminNotifChannel,
          authorId:     "system",
          authorName:   "SmartCue System",
          authorRole:   "admin",
          authorEmail:  "system",
          authorAvatar: "",
          author: {
            id: "system", name: "SmartCue System",
            role: "admin", email: "system", avatar: "",
          },
          type:          "system_notification",
          notifType:     "task_reminder",
          text:          `🔴 TAT Breach #${reminderCount}: "${task.title}" assigned to ${doerName} is overdue by ${delayDuration}.`,
          taskId,
          taskTitle:     task.title,
          delayDuration,
          reminderCount,
          assignedToName:doerName,
          dueDate:       task.dueDate || "",
          reactions:     {},
          readBy:        [],
          createdAt:     new Date().toISOString(),
        };
        await ChatMessage.create(adminMsg).catch(e => console.error("[TAT] DM to admin failed:", e.message));
        io.to(`channel:${adminNotifChannel}`).emit("new_message", adminMsg);
      }

      await Task.findOneAndUpdate(
        { id: task.id || String(task._id) },
        { reminderCount, lastReminderAt: now.toISOString() }
      );

      if (task.assignedTo) {
        await sendPushToUser(task.assignedTo, {
          title:   `⚠ Task Overdue — Reminder #${reminderCount}`,
          body:    `"${task.title}" was due ${delayDuration}. Please submit immediately.`,
          url:     dashboardUrl,
          taskId:  task.id || String(task._id),
          tag:     `tat-${task.id || task._id}`,
          icon:    "/favicon.png",
        });
      }
      if (task.assignedBy) {
        await sendPushToUser(task.assignedBy, {
          title:   `🔴 TAT Breach — ${task.title}`,
          body:    `Assigned to ${doer?.name ?? task.assignedTo} · Overdue by ${delayDuration}`,
          url:     dashboardUrl,
          taskId:  task.id || String(task._id),
          tag:     `tat-admin-${task.id || task._id}`,
          icon:    "/favicon.png",
        });
      }

      console.log(`📲 TAT reminder #${reminderCount} → "${task.title}"`);
      alertCount++;
    }

    if (alertCount === 0) console.log(`✔ TAT check – ${tasks.length} tasks scanned, no breaches`);
  } catch (err) {
    console.error("✘ TAT monitor error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPULSE CRON — runs every 6 hours, fires next recurring task instance
// ─────────────────────────────────────────────────────────────────────────────
async function runAutopulseCron() {
  if (!dbReady()) { console.log("[Autopulse] Skipping — DB not ready"); return; }
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Find all fully-approved autopulse tasks due for their next cycle
    const dueTasks = await Task.find({
      isAutopulse:          true,
      autopulseNextCreated: false,
      autopulsePaused:      { $ne: true },
      autopulseScheduledFor:{ $lte: todayStr, $ne: null },
      approvalStatus:       "superadmin-approved",  // only fully approved tasks spawn new cycles
    }).lean();

    if (dueTasks.length === 0) {
      console.log("[Autopulse] No tasks due for recurrence today");
      return;
    }

    const dashboardUrl = process.env.FRONTEND_URL || "https://marketing1-delta.vercel.app";

    for (const task of dueTasks) {
      const parentId   = task.autopulseParentId || task.id || String(task._id);
      const generation = (task.autopulseGeneration ?? 0) + 1;
      const newId      = String(Date.now()) + "_ap" + generation;
      const now        = new Date().toISOString();
      const cycleDays  = task.autopulseCycleDays ?? 7;

      // New due date = today + cycleDays
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + cycleDays);
      const nextDueStr = nextDue.toISOString().split("T")[0];

      const newTask = {
        id:                   newId,
        title:                task.title,
        description:          task.description,
        status:               "pending",
        approvalStatus:       "assigned",
        priority:             task.priority,
        dueDate:              nextDueStr,
        assignedTo:           task.assignedTo,
        assignedBy:           task.assignedBy,
        projectId:            task.projectId,
        timeSlot:             task.timeSlot     || "18:00",
        purpose:              task.purpose      || "",
        voiceNote:            task.voiceNote    || undefined,
        isAutopulse:          true,
        autopulseCycleDays:   cycleDays,
        autopulseParentId:    parentId,
        autopulseGeneration:  generation,
        autopulseScheduledFor:null,
        autopulseNextCreated: false,
        autopulsePaused:      false,
        history: [{
          id:        "hist_ap_" + Date.now(),
          timestamp: now,
          action:    `Auto-assigned (Autopulse #${generation}) — recurring from "${task.title}"`,
          by:        task.assignedBy ?? "system",
          to:        task.assignedTo,
        }],
        createdAt: now,
      };

      await Task.create(newTask);

      // Mark parent so cron won't fire again for this cycle
      await Task.findOneAndUpdate(
        { id: task.id || String(task._id) },
        { $set: { autopulseNextCreated: true } }
      );

      // Push notification to doer
      if (task.assignedTo) {
        const dueDateFormatted = nextDue.toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric"
        });
        await sendPushToUser(task.assignedTo, {
          title: "⚡ Autopulse — New Recurring Task",
          body:  `${task.title} · Due: ${dueDateFormatted}`,
          url:   dashboardUrl,
          taskId: newId,
          tag:   `autopulse-${newId}`,
          icon:  "/favicon.png",
          type:  "task_assigned",
        });
      }

      // Broadcast via socket so dashboard updates live
      broadcastTaskNotification({
        type:               "task_assigned",
        taskId:             newId,
        taskTitle:          task.title,
        assignedTo:         task.assignedTo,
        assignedBy:         task.assignedBy,
        priority:           task.priority,
        dueDate:            nextDueStr,
        projectId:          task.projectId,
        isAutopulse:        true,
        autopulseGeneration:generation,
      });

      console.log(`[Autopulse] Created instance #${generation} of "${task.title}" -> ${task.assignedTo} (due ${nextDueStr})`);
    }
  } catch (err) {
    console.error("[Autopulse] Cron error:", err.message);
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
  let { name, projectCode, launchDate } = req.body;
  if (launchDate && launchDate.length > 10) launchDate = launchDate.slice(0, 10);
  req.body.launchDate = launchDate;
  const missing = [!name && "name", !projectCode && "projectCode", !launchDate && "launchDate"].filter(Boolean);
  if (missing.length) return res.status(400).json({ message: `Missing: ${missing.join(", ")}.` });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate))
    return res.status(400).json({ message: "launchDate must be YYYY-MM-DD." });
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOAD (Cloudinary)
// ─────────────────────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided." });
    const folder = req.body?.folder || "smartcue";
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "auto", timeout: 600000 },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    res.json({ success: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("[Cloudinary] Upload failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/projects", async (req, res) => {
  try {
    if (dbReady()) return res.json(await Project.find().sort({ createdAt: -1 }));
    res.json(inMemoryProjects);
  } catch (e) { res.status(500).json({ message: "Failed to fetch projects." }); }
});

app.post("/api/projects", requireRole("superadmin", "supremo"), validateProject, async (req, res) => {
  try {
    const { name, description, color, projectCode, concernedDoerEmail, launchDate, status, createdBy } = req.body;
    if (dbReady()) {
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
    if (dbReady()) {
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
  try {
    const callerEmail = (req.query.email ?? "").toLowerCase();
    const callerRole  = (req.query.role  ?? "").toLowerCase();
    const filter = (callerRole === "superadmin" || callerRole === "supremo")
      ? {}
      : callerEmail
        ? { $or: [
            { assignedBy: { $regex: new RegExp("^" + callerEmail + "$", "i") } },
            { assignedTo: { $regex: new RegExp("^" + callerEmail + "$", "i") } }
          ] }
        : {};
    const tasks      = await Task.find(filter).select("-attachments").sort({ createdAt: -1 }).lean();
    const normalized = tasks.map(t => { if (!t.id) t.id = String(t._id); return t; });
    res.json(normalized);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const data    = { ...req.body, id: req.body.id || String(Date.now()) };
    const created = await Task.create(data);
    const obj     = created.toObject();
    if (!obj.id) obj.id = String(obj._id);

    broadcastTaskNotification({
      type: "task_assigned", taskId: obj.id, taskTitle: obj.title,
      assignedTo: obj.assignedTo, assignedBy: obj.assignedBy,
      priority: obj.priority, dueDate: obj.dueDate, projectId: obj.projectId,
    });

    if (obj.assignedTo) {
      const dueStr = obj.dueDate
        ? new Date(obj.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "No due date";
      await sendPushToUser(obj.assignedTo, {
        title: "📋 New Task Assigned",
        body:  `${obj.title} · Priority: ${(obj.priority || "medium").toUpperCase()} · Due: ${dueStr}`,
        url:   process.env.FRONTEND_URL || "/",
        taskId: obj.id, tag: `new-task-${obj.id}`, icon: "/favicon.png", type: "task_assigned",
      });
    }
    res.status(201).json(obj);
  } catch (e) { res.status(400).json({ message: e.message }); }
});


// GET single task by ID — returns full document including attachments, scoreData, completionNotes
app.get("/api/tasks/:id", async (req, res) => {
  try {
    let t = await Task.findOne({ id: req.params.id }).lean();
    if (!t) t = await Task.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Task not found." });
    if (!t.id) t.id = String(t._id);
    res.json(t);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET single task by ID — returns full document including attachments, scoreData, completionNotes
app.get("/api/tasks/:id", async (req, res) => {
  try {
    let t = await Task.findOne({ id: req.params.id }).lean();
    if (!t) t = await Task.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Task not found." });
    if (!t.id) t.id = String(t._id);
    res.json(t);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
// ⚠️ /all MUST stay above /:id
app.delete("/api/tasks/all", async (req, res) => {
  try {
    const r = await Task.deleteMany({});
    res.json({ success: true, deleted: r.deletedCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    let t = await Task.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true, runValidators: false });
    if (!t) t = await Task.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!t) return res.status(404).json({ message: "Task not found." });
    const obj = t.toObject();
    if (!obj.id) obj.id = String(obj._id);

    const newStatus = req.body.approvalStatus;
    if (newStatus) {
      broadcastTaskNotification({
        type: "task_status_changed", taskId: obj.id, taskTitle: obj.title,
        assignedTo: obj.assignedTo, assignedBy: obj.assignedBy,
        newStatus, priority: obj.priority, dueDate: obj.dueDate, projectId: obj.projectId,
      });

      const base = { url: process.env.FRONTEND_URL || "/", taskId: obj.id, tag: `status-${obj.id}`, icon: "/favicon.png", type: "task_status_changed" };

      if (newStatus === "in-review") {
        const adminMsg = { ...base, title: "👁 Task Submitted for Review", body: `${obj.title} needs your review.` };
        if (obj.assignedBy) await sendPushToUser(obj.assignedBy, adminMsg);
        await sendPushToRole(["superadmin", "supremo"], adminMsg, obj.assignedBy);
      }
      if (newStatus === "admin-approved") {
        if (obj.assignedTo) await sendPushToUser(obj.assignedTo, { ...base, title: "✅ Task Approved by Admin", body: `${obj.title} — awaiting final sign-off.` });
        await sendPushToRole(["superadmin", "supremo"], { ...base, title: "📋 Ready for Final Approval", body: `${obj.title} needs your final review.` }, obj.assignedBy);
      }
      if (newStatus === "superadmin-approved") {
        if (obj.assignedTo) await sendPushToUser(obj.assignedTo, { ...base, title: "🏆 Task Fully Approved!", body: `${obj.title} — great work!` });
        if (obj.assignedBy) await sendPushToUser(obj.assignedBy, { ...base, title: "✅ Final Approval Done", body: `${obj.title} received full approval.` });
      }
      if (newStatus === "rejected") {
        if (obj.assignedTo) await sendPushToUser(obj.assignedTo, { ...base, title: "↩ Task Needs Rework", body: `${obj.title} — check admin comments.` });
      }

      // ── Autopulse: schedule next instance when superadmin fully approves ──
      if (newStatus === "superadmin-approved" && obj.isAutopulse && !obj.autopulseNextCreated) {
        const cycleDays = obj.autopulseCycleDays ?? 7;
        const approvedAt = new Date();
        const scheduledFor = new Date(approvedAt);
        scheduledFor.setDate(scheduledFor.getDate() + cycleDays);
        const scheduledForISO = scheduledFor.toISOString().split("T")[0];
        await Task.findOneAndUpdate(
          { id: obj.id },
          { $set: { autopulseScheduledFor: scheduledForISO, autopulseNextCreated: false } }
        );
        console.log(`[Autopulse] Scheduled next instance of "${obj.title}" for ${scheduledForISO}`);
      }
    }
    res.json(obj);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    let t = await Task.findOneAndDelete({ id: req.params.id });
    if (!t) t = await Task.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ message: "Task not found." });
    res.json({ success: true, message: `Task "${t.title}" deleted.` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/users", async (req, res) => {
  try {
    if (dbReady()) {
      const users      = await User.find({}, "-password").sort({ name: 1 }).lean();
      const normalized = users.map(u => ({ ...u, id: u.id || String(u._id) }));
      if (normalized.length === 0) {
        const fallback = Object.entries(TEAM_DIRECTORY).map(([email, info]) => ({
          id: email, email, name: info.name, phone: info.phone, role: "staff",
        }));
        return res.json(fallback);
      }
      return res.json(normalized);
    }
    const fallback = Object.entries(TEAM_DIRECTORY).map(([email, info]) => ({
      id: email, email, name: info.name, phone: info.phone, role: "staff",
    }));
    res.json(inMemoryUsers.length ? inMemoryUsers : fallback);
  } catch (e) {
    console.error("[Users] GET /api/users error:", e.message);
    res.status(500).json({ message: "Failed to fetch users: " + e.message });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    if (dbReady()) {
      const user = await User.findOne(
        { $or: [{ id: req.params.id }, { email: req.params.id.toLowerCase() }] },
        "-password"
      ).lean();
      if (!user) return res.status(404).json({ message: "User not found." });
      return res.json({ ...user, id: user.id || String(user._id) });
    }
    const user = inMemoryUsers.find(u => u.id === req.params.id || u.email === req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(user);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/users", async (req, res) => {
  try {
    const data = { ...req.body, id: req.body.id || String(Date.now()) };
    if (dbReady()) {
      if (await User.findOne({ email: data.email?.toLowerCase() }))
        return res.status(409).json({ message: "User with this email already exists." });
      const created = await User.create({ ...data, email: data.email?.toLowerCase() });
      const obj = created.toObject();
      obj.id = obj.id || String(obj._id);
      delete obj.password;
      return res.status(201).json(obj);
    }
    if (inMemoryUsers.find(u => u.email === data.email?.toLowerCase()))
      return res.status(409).json({ message: "User with this email already exists." });
    inMemoryUsers.push(data);
    res.status(201).json(data);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password;
    if (dbReady()) {
      const user = await User.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { email: req.params.id.toLowerCase() }] },
        { $set: updates },
        { new: true, upsert: true, projection: "-password", setDefaultsOnInsert: true }
      );
      if (!user) return res.status(404).json({ message: "User not found." });
      return res.json({ ...user.toObject(), id: user.id || String(user._id) });
    }
    const idx = inMemoryUsers.findIndex(u => u.id === req.params.id || u.email === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "User not found." });
    inMemoryUsers[idx] = { ...inMemoryUsers[idx], ...updates };
    res.json(inMemoryUsers[idx]);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.patch("/api/users/:id", async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password;
    if (dbReady()) {
      const user = await User.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { email: req.params.id.toLowerCase() }] },
        { $set: updates },
        { new: true, upsert: true, projection: "-password", setDefaultsOnInsert: true }
      );
      if (!user) return res.status(404).json({ message: "User not found." });
      return res.json({ ...user.toObject(), id: user.id || String(user._id) });
    }
    const idx = inMemoryUsers.findIndex(u => u.id === req.params.id || u.email === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "User not found." });
    inMemoryUsers[idx] = { ...inMemoryUsers[idx], ...updates };
    res.json(inMemoryUsers[idx]);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    if (dbReady()) {
      const user = await User.findOneAndDelete(
        { $or: [{ id: req.params.id }, { email: req.params.id.toLowerCase() }] }
      );
      if (!user) return res.status(404).json({ message: "User not found." });
      return res.json({ success: true, message: `User "${user.name}" deleted.` });
    }
    const idx = inMemoryUsers.findIndex(u => u.id === req.params.id || u.email === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "User not found." });
    const [removed] = inMemoryUsers.splice(idx, 1);
    res.json({ success: true, message: `User "${removed.name}" deleted.` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANCE TICKET ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/tickets", async (req, res) => {
  try {
    if (dbReady()) {
      const tickets = await AssistanceTicket.find().sort({ raisedAt: -1 }).lean();
      const normalized = tickets.map(t => ({ ...t, id: t.id || String(t._id) }));
      return res.json(normalized);
    }
    res.json([]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/tickets/dedup-cleanup — one-time cleanup: keeps newest ticket per taskId,
// marks all older duplicates as resolved so they stop showing in admin queue
app.post("/api/tickets/dedup-cleanup", async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ message: "DB not ready" });
    const tickets = await AssistanceTicket.find({
      status: { $nin: ["resolved", "rejected", "superadmin-approved", "admin-approved"] }
    }).sort({ raisedAt: -1 }).lean();

    // Group by taskId
    const byTask = {};
    tickets.forEach(t => {
      const key = t.taskId || String(t._id);
      if (!byTask[key]) byTask[key] = [];
      byTask[key].push(t);
    });

    let cleaned = 0;
    for (const [taskId, group] of Object.entries(byTask)) {
      if (group.length <= 1) continue;
      // Keep first (newest due to sort), mark rest as resolved
      const duplicates = group.slice(1);
      for (const dup of duplicates) {
        await AssistanceTicket.findOneAndUpdate(
          { id: dup.id || String(dup._id) },
          { $set: { status: "resolved", adminComment: "Auto-resolved: duplicate ticket" } }
        );
        cleaned++;
      }
    }
    console.log(`[Dedup] Cleaned ${cleaned} duplicate tickets`);
    res.json({ success: true, cleaned, message: `Resolved ${cleaned} duplicate tickets` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/tickets", async (req, res) => {
  try {
    const data = { ...req.body, id: req.body.id || String(Date.now()) };
    if (dbReady()) {
      const created = await AssistanceTicket.create(data);
      const obj = created.toObject();
      return res.status(201).json({ ...obj, id: obj.id || String(obj._id) });
    }
    res.status(201).json(data);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.put("/api/tickets/:id", async (req, res) => {
  try {
    if (dbReady()) {
      let t = await AssistanceTicket.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true, runValidators: false });
      if (!t) t = await AssistanceTicket.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
      if (!t) return res.status(404).json({ message: "Ticket not found." });
      return res.json({ ...t.toObject(), id: t.id || String(t._id) });
    }
    res.status(404).json({ message: "Ticket not found." });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/push/vapid-public-key", (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY)
    return res.status(503).json({ message: "Push notifications not configured." });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { subscription, email } = req.body;
    if (!subscription || !email)
      return res.status(400).json({ message: "subscription and email are required." });
    if (dbReady()) {
      await PushSub.findOneAndUpdate(
        { "subscription.endpoint": subscription.endpoint },
        { email: email.toLowerCase(), subscription, updatedAt: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`[Push] Subscription saved for ${email}`);
    await sendPushToUser(email, {
      title: "✅ SmartCue Notifications Active",
      body:  "You will receive task reminders even when the app is closed.",
      url:   process.env.FRONTEND_URL || "/", tag: "push-welcome", icon: "/favicon.png",
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[Push] Subscribe error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required." });
    if (dbReady()) await PushSub.deleteMany({ email: email.toLowerCase() });
    console.log(`[Push] Unsubscribed all devices for ${email}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/push/send", async (req, res) => {
  try {
    const { email, emails, title, body, url, taskId } = req.body;
    if (!title) return res.status(400).json({ message: "title is required." });
    const targets = emails ?? (email ? [email] : []);
    if (!targets.length) return res.status(400).json({ message: "email or emails required." });
    await Promise.all(targets.map(e => sendPushToUser(e, { title, body, url: url || "/", taskId, icon: "/favicon.png" })));
    res.json({ success: true, sent: targets.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/push/broadcast", async (req, res) => {
  try {
    const { title, body, url } = req.body;
    if (!title) return res.status(400).json({ message: "title is required." });
    if (!dbReady()) return res.status(503).json({ message: "Database not connected." });
    const allSubs = await PushSub.find({});
    let sent = 0;
    await Promise.all(allSubs.map(async s => {
      const ok = await sendPushToSubscription(s.subscription, { title, body, url: url || "/", icon: "/favicon.png" });
      if (ok) sent++;
    }));
    console.log(`[Push] Broadcast → ${sent}/${allSubs.length} devices`);
    res.json({ success: true, sent, total: allSubs.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/draft-notes", async (req, res) => {
  const { notes } = req.body;
  if (!notes) return res.status(400).json({ success: false, message: "Notes are required" });
  try {
    const message = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: `You are a professional writing assistant. Improve the following task completion notes for clarity, professionalism, and impact. Keep the same meaning but enhance the writing quality.\n\nOriginal notes:\n${notes}\n\nReturn ONLY the improved notes, no preamble.` }],
      })
    );
    const improvedNotes = message.content[0]?.type === "text" ? message.content[0].text : notes;
    res.json({ success: true, improvedNotes });
  } catch (error) {
    console.error("[ERROR] draft-notes:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ success: false, message: "Anthropic API overloaded. Try again in a few seconds." });
    res.status(500).json({ success: false, message: "Failed to draft notes: " + error.message });
  }
});

app.post("/api/review-attachments", async (req, res) => {
  const { contentArray } = req.body;
  if (!contentArray?.length) return res.status(400).json({ success: false, message: "Content array is required" });
  try {
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
    } catch {
      return res.status(400).json({ success: false, message: "Could not parse review results" });
    }
    res.json({ success: true, results: parsedResults, hasErrors: parsedResults.some(r => r.status === "ERROR") });
  } catch (error) {
    console.error("[ERROR] review-attachments:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ success: false, message: "Anthropic API overloaded." });
    res.status(500).json({ success: false, message: "Failed to review attachments: " + error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORE CONTENT
// FIX: max_tokens raised to 8000 so the JSON is never truncated mid-response.
//      System prompt tightened to demand compact notes (no long sentences) so
//      the response stays well within the token budget.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/score-content", async (req, res) => {
  // Compact system prompt — same rubric, shorter output per criterion
  const systemPrompt = req.body.systemPrompt ||
    "You are an expert visual content reviewer for a real estate marketing team. " +
    "Review the provided image(s) and respond ONLY with a raw JSON object — " +
    "no markdown, no code fences, no preamble, no explanation outside the JSON. " +
    "Keep every note/feedback field to ONE concise sentence (max 20 words). " +
    "Required JSON shape: { " +
    "\"percentScore\": number, " +
    "\"grade\": string, " +
    "\"verdict\": string, " +
    "\"grammarClean\": boolean, " +
    "\"grammarErrors\": string[], " +
    "\"strengths\": string[], " +
    "\"improvements\": string[], " +
    "\"categories\": [{ \"id\": string, \"name\": string, \"score\": number, \"max\": number, " +
    "\"subcriteria\": [{ \"label\": string, \"score\": number, \"max\": number, \"note\": string }] }] }";

  let userContent = req.body.userContent;

  if (!userContent) {
    const rawImage = req.body.image;
    if (!rawImage) {
      return res.status(400).json({ success: false, message: "Missing userContent or image" });
    }
    const cleanBase64 = rawImage.includes(",") ? rawImage.split(",")[1] : rawImage;
    userContent = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: cleanBase64 } },
      { type: "text", text: "Score and review this image. Reply with JSON only — no markdown fences." },
    ];
  }

  // Normalise every image block through Buffer — guarantees clean standard base64
  for (const block of userContent) {
    if (block.type === "image" && block?.source?.data) {
      let data = block.source.data;

      // Strip data URI prefix if present
      if (data.includes(";base64,")) {
        data = data.split(";base64,")[1];
      } else if (data.startsWith("data:")) {
        data = data.split(",")[1] ?? data;
      }

      // Convert URL-safe base64 to standard base64
      data = data.replace(/-/g, "+").replace(/_/g, "/");

      // Remove ALL non-base64 characters
      data = data.replace(/[^A-Za-z0-9+/=]/g, "");

      // Re-encode through Buffer — definitive clean-up
      try {
        data = Buffer.from(data, "base64").toString("base64");
      } catch (e) {
        console.error("[score-content] Buffer re-encode failed:", e.message);
        return res.status(400).json({ success: false, message: "Image data is corrupted. Please re-upload and try again." });
      }

      if (!data || data.length < 100) {
        return res.status(400).json({ success: false, message: "Image data is empty after processing. Please re-upload." });
      }

      // ── SIZE GUARD: reject images over ~5MB ──────────────────────────────
      if (data.length > 6_900_000) {
        const sizeMB = (data.length * 0.75 / 1_048_576).toFixed(1);
        console.warn(`[score-content] Image too large: ${data.length} chars (~${sizeMB}MB). Rejecting.`);
        return res.status(400).json({
          success: false,
          message: `Image is too large (${sizeMB}MB). Please compress the image to under 5MB and re-upload.`,
        });
      }

      // Detect media type from magic bytes
      const header = Buffer.from(data.slice(0, 16), "base64");
      let media_type = block.source.media_type || "image/jpeg";
      if (header[0] === 0x89 && header[1] === 0x50) media_type = "image/png";
      else if (header[0] === 0xff && header[1] === 0xd8) media_type = "image/jpeg";
      else if (header[0] === 0x47 && header[1] === 0x49) media_type = "image/gif";
      else if (header[0] === 0x52 && header[1] === 0x49) media_type = "image/webp";

      block.source.data       = data;
      block.source.media_type = media_type;
      console.log(`[score-content] Image block ${userContent.indexOf(block)}: ${data.length} chars, ${media_type}`);
    }
  }

  const imageCount = userContent.filter(c => c.type === "image").length;
  console.log("[score-content] Scoring", imageCount, "image(s)...");

  try {
    const message = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: Math.min(16000, 6000 + imageCount * 3000),
        temperature: 0,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userContent }],
      })
    );

    const rawText = message.content.map(b => b.type === "text" ? b.text : "").join("").trim();
    console.log("[score-content] Raw AI response (first 500 chars):", rawText.slice(0, 500));

    // Strip markdown fences — handles ```json, ```, and trailing ```
    let clean = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // Extract first complete JSON object or array if surrounded by other text
    const objMatch   = clean.match(/\{[\s\S]*\}/);
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (objMatch)        clean = objMatch[0];
    else if (arrayMatch) clean = arrayMatch[0];

    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error("[score-content] JSON parse failed. Raw (first 800 chars):", clean.slice(0, 800));
      result = {
        percentScore:  50,
        grade:         "N/A",
        verdict:       "AI response could not be parsed. Please try again.",
        grammarClean:  true,
        grammarErrors: [],
        strengths:     [],
        improvements:  ["Re-submit for a fresh score."],
        categories:    [],
        parseError:    true,
        rawResponse:   clean.slice(0, 300),
      };
    }

    console.log("[score-content] Done. Score:", result?.percentScore ?? "N/A");
    res.json({ success: true, result });

  } catch (error) {
    console.error("[ERROR] score-content:", error?.status, error?.message);
    const isOverloaded = error?.status === 529 || error?.status === 503 ||
      error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) {
      return res.status(503).json({ success: false, message: "Anthropic API is overloaded. Please try again in a few seconds." });
    }
    console.error("[ERROR] score-content full:", JSON.stringify(error?.error ?? error));
    res.status(500).json({ success: false, message: "Failed to score content: " + (error?.message ?? "Unknown error") });
  }
});

app.post("/api/chat", async (req, res) => {
  const { model, max_tokens, system, messages } = req.body;
  if (!messages?.length) return res.status(400).json({ success: false, message: "messages are required" });
  try {
    const response = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model:      model      || "claude-haiku-4-5-20251001",
        max_tokens: max_tokens || 1024,
        system:     system     || "You are SmartCue, an elite AI assistant for Roswalt Realty.",
        messages,
      })
    );
    const reply = response.content?.[0]?.text ?? "Systems briefly offline. Please retry.";
    res.json({ content: [{ type: "text", text: reply }] });
  } catch (error) {
    console.error("[ERROR] SmartCue chat:", error);
    const isOverloaded = error?.status === 529 || error?.error?.error?.type === "overloaded_error";
    if (isOverloaded) return res.status(503).json({ content: [{ type: "text", text: "SmartCue is overloaded. Please retry in a moment." }] });
    res.status(500).json({ content: [{ type: "text", text: "Network disruption detected. Please retry." }] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ELEVENLABS TTS
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    if (!process.env.ELEVEN_LABS_API_KEY) {
      return res.status(503).json({ message: "TTS is not configured on this server." });
    }

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
      let errorJson = null;
      try { errorJson = JSON.parse(errorText); } catch { /* not JSON */ }

      const status  = errorJson?.detail?.status ?? "";
      const message = errorJson?.detail?.message ?? errorText;

      if (status === "quota_exceeded" || response.status === 429) {
        console.warn("[TTS] ElevenLabs quota exceeded");
        return res.status(402).json({
          message: "Voice narration is temporarily unavailable — ElevenLabs credit quota has been reached. Please top up at elevenlabs.io or try again later.",
          detail: message,
        });
      }

      console.error("[TTS] ElevenLabs error:", errorText);
      return res.status(response.status).json({ message: "TTS failed: " + message });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (error) {
    console.error("[TTS] Unexpected error:", error.message);
    res.status(500).json({ message: "Failed to generate speech: " + error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG ROUTES
// ─────────────────────────────────────────────────────────────────────────────
const activitySchema = new mongoose.Schema({
  id:         { type: String, index: true },
  timestamp:  { type: String, default: () => new Date().toISOString() },
  category:   { type: String },
  action:     { type: String },
  actorEmail: { type: String },
  actorName:  { type: String },
  targetId:   { type: String },
  targetName: { type: String },
  meta:       { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", activitySchema);

app.post("/api/activity", async (req, res) => {
  try {
    const data = {
      ...req.body,
      id: req.body.id || "ACT-" + Date.now().toString(36).toUpperCase(),
    };
    if (dbReady()) {
      const created = await ActivityLog.create(data);
      return res.status(201).json({ ...created.toObject(), id: created.id || String(created._id) });
    }
    res.status(201).json(data);
  } catch (e) {
    console.error("[Activity] POST error:", e.message);
    res.status(400).json({ message: e.message });
  }
});

app.get("/api/activity", async (req, res) => {
  try {
    if (dbReady()) {
      const logs = await ActivityLog.find()
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();
      return res.json(logs.map(l => ({ ...l, id: l.id || String(l._id) })));
    }
    res.json([]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM SETTINGS — voice toggle (controlled by Supremo only via frontend)
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/settings/voice", async (req, res) => {
  try {
    if (!dbReady()) return res.json({ voiceEnabled: false });
    const settings = await SystemSettings.getSingleton();
    res.json({ voiceEnabled: settings.voiceEnabled });
  } catch (err) {
    console.error("[Settings] GET /voice error:", err.message);
    res.status(500).json({ error: "Failed to retrieve voice setting" });
  }
});

app.patch("/api/settings/voice", async (req, res) => {
  const { voiceEnabled } = req.body;
  if (typeof voiceEnabled !== "boolean")
    return res.status(400).json({ error: "voiceEnabled must be a boolean" });
  try {
    if (!dbReady()) return res.json({ voiceEnabled });
    const settings = await SystemSettings.getSingleton();
    settings.voiceEnabled = voiceEnabled;
    await settings.save();
    console.log(`[Settings] System voice set to: ${voiceEnabled}`);
    res.json({ voiceEnabled: settings.voiceEnabled });
  } catch (err) {
    console.error("[Settings] PATCH /voice error:", err.message);
    res.status(500).json({ error: "Failed to update voice setting" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:           "ok",
    mongoConnected:   dbReady(),
    mongoState:       mongoose.connection.readyState,
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    chat:             "socket.io active",
    uptime:           process.uptime(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT REST ROUTES
// ─────────────────────────────────────────────────────────────────────────────
function normMsg(m) {
  const obj = m.toObject ? m.toObject() : m;
  if (!obj.id) obj.id = String(obj._id);
  if (obj.reactions instanceof Map) {
    const plain = {};
    for (const [k, v] of obj.reactions) plain[k] = v;
    obj.reactions = plain;
  }
  return obj;
}

app.get("/api/chat/messages/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? "100"), 200);
    if (dbReady()) {
      const msgs = await ChatMessage.find({ channelId, deletedAt: null })
        .sort({ createdAt: -1 }).limit(limit).lean();
      return res.json(msgs.reverse().map(m => { if (!m.id) m.id = String(m._id); return m; }));
    }
    res.json(inMemoryChatMessages.filter(m => m.channelId === channelId).slice(-limit));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/chat/messages", async (req, res) => {
  try {
    const data = { ...req.body, id: req.body.id || String(Date.now() + Math.random()) };
    if (dbReady()) {
      const created = await ChatMessage.create(data);
      return res.status(201).json(normMsg(created));
    }
    inMemoryChatMessages.push(data);
    if (inMemoryChatMessages.length > 1000) inMemoryChatMessages = inMemoryChatMessages.slice(-800);
    res.status(201).json(data);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.put("/api/chat/messages/:id/react", async (req, res) => {
  try {
    const { emoji, userId } = req.body;
    if (!emoji || !userId) return res.status(400).json({ message: "emoji and userId are required." });
    if (dbReady()) {
      const msg = await ChatMessage.findOne({ id: req.params.id });
      if (!msg) return res.status(404).json({ message: "Message not found." });
      const users = msg.reactions.get(emoji) || [];
      const idx = users.indexOf(userId);
      if (idx > -1) users.splice(idx, 1); else users.push(userId);
      msg.reactions.set(emoji, users);
      await msg.save();
      const updated = normMsg(msg);
      io.to(`channel:${msg.channelId}`).emit("reaction_update", { messageId: msg.id, emoji, userId, reactions: updated.reactions });
      return res.json(updated);
    }
    const msg = inMemoryChatMessages.find(m => m.id === req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found." });
    if (!msg.reactions) msg.reactions = {};
    const users = msg.reactions[emoji] || [];
    const idx = users.indexOf(userId);
    if (idx > -1) users.splice(idx, 1); else users.push(userId);
    msg.reactions[emoji] = users;
    res.json(msg);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.delete("/api/chat/messages/:id", async (req, res) => {
  try {
    if (dbReady()) {
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
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/chat/presence", async (req, res) => {
  try {
    if (dbReady()) return res.json(await ChatPresence.find({ isOnline: true }).lean());
    res.json(inMemoryChatPresence.filter(p => p.isOnline));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch("/api/chat/presence", async (req, res) => {
  try {
    const { email, ...updates } = req.body;
    if (!email) return res.status(400).json({ message: "email is required." });
    if (dbReady()) {
      const presence = await ChatPresence.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: { ...updates, email: email.toLowerCase() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.json(presence);
    }
    const idx    = inMemoryChatPresence.findIndex(p => p.email === email.toLowerCase());
    const record = { email: email.toLowerCase(), ...updates, updatedAt: new Date().toISOString() };
    if (idx > -1) inMemoryChatPresence[idx] = { ...inMemoryChatPresence[idx], ...record };
    else inMemoryChatPresence.push(record);
    res.json(record);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.post("/api/chat/meeting", async (req, res) => {
  try {
    const { title } = req.body;
    if (process.env.DAILY_API_KEY) {
      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { max_participants: 50, enable_chat: false, exp: Math.floor(Date.now() / 1000) + 7200 } }),
      });
      if (!response.ok) throw new Error(`Daily.co error: ${response.status}`);
      const room = await response.json();
      return res.json({ url: room.url, roomName: room.name, provider: "daily" });
    }
    const roomId = Math.random().toString(36).substr(2, 8);
    res.json({ url: `https://meet.roswalt.io/room-${roomId}`, roomName: `room-${roomId}`, provider: "mock", title });
  } catch (e) {
    res.status(500).json({ message: "Could not create meeting room: " + e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MEETING QUEUE — in-memory (per session)
// ─────────────────────────────────────────────────────────────────────────────
const meetingQueue    = {};  // sessionId → [{ userId, userName, email, socketId, joinedAt }]
const supremoSockets  = {};  // sessionId → socketId of supremo


// GET /api/meeting/active-session — staff polls this to discover active sessions
app.get("/api/meeting/active-session", (req, res) => {
  // Return the first active session (there's typically only one)
  const sessionId = Object.keys(supremoSockets)[0] || null;
  if (!sessionId) return res.json({ active: false });
  const queue = meetingQueue[sessionId] || [];
  res.json({ active: true, sessionId, queueLength: queue.length });
});

// REST fallback — GET /api/meeting/queue?sessionId=xxx
app.get("/api/meeting/queue", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.json([]);
  res.json(meetingQueue[sessionId] || []);
});

// REST — POST /api/meeting/promise-score
app.post("/api/meeting/promise-score", express.json(), async (req, res) => {
  try {
    const { sessionId, userId, userName, email, score, comment } = req.body;
    const entry = { userId, userName, email, score: Number(score), comment: comment || "", submittedAt: new Date().toISOString() };
    // Broadcast to supremo
    const supSocket = supremoSockets[sessionId];
    if (supSocket) io.to(supSocket).emit("meeting:promise-score", entry);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PROMISE SCORE ─────────────────────────────────────────────────────────────
const promiseScoreSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  week:      { type: Number, required: true },
  weekLabel: { type: String, default: "" },
  score:     { type: Number, default: 0 },
  date:      { type: String, default: "" },
  outcome:   { type: String, enum: ["pending", "met", "missed"], default: "pending" },
}, { timestamps: true });
promiseScoreSchema.index({ userId: 1, week: 1 }, { unique: true });
const PromiseScore = mongoose.models.PromiseScore || mongoose.model("PromiseScore", promiseScoreSchema);

app.get("/api/promise-score/:userId", async (req, res) => {
  try { res.json(await PromiseScore.find({ userId: req.params.userId }).sort({ week: -1 }).lean()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/promise-score", express.json(), async (req, res) => {
  try {
    const { userId, week, weekLabel, score, date, outcome } = req.body;
    const doc = await PromiseScore.findOneAndUpdate(
      { userId, week },
      { userId, week, weekLabel, score: Number(score), date, outcome: outcome || "pending" },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch("/api/promise-score/:userId/:week", express.json(), async (req, res) => {
  try {
    const doc = await PromiseScore.findOneAndUpdate(
      { userId: req.params.userId, week: Number(req.params.week) },
      { outcome: req.body.outcome },
      { new: true }
    );
    res.json(doc || { error: "not found" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on("user_join", async (user) => {
    if (!user?.email) return;
    socket.data.user = user;
    socket.join("presence");
    if (dbReady()) {
      await ChatPresence.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        { $set: { ...user, email: user.email.toLowerCase(), isOnline: true, socketId: socket.id, lastSeen: new Date() } },
        { upsert: true, setDefaultsOnInsert: true }
      ).catch(e => console.error("[Socket] Presence upsert error:", e.message));
    } else {
      const idx    = inMemoryChatPresence.findIndex(p => p.email === user.email.toLowerCase());
      const record = { ...user, email: user.email.toLowerCase(), isOnline: true, socketId: socket.id };
      if (idx > -1) inMemoryChatPresence[idx] = record; else inMemoryChatPresence.push(record);
    }
    io.emit("user_online", { ...user, isOnline: true, socketId: socket.id });
    console.log(`[Socket] ${user.name} (${user.role}) joined`);
  });

  socket.on("join_channel", (channelId) => {
    if (channelId) socket.join(`channel:${channelId}`);
  });

  socket.on("leave_channel", (channelId) => {
    if (channelId) socket.leave(`channel:${channelId}`);
  });

  socket.on("send_message", async (msg) => {
    if (!msg?.channelId || !msg?.authorId) return;
    const data = { ...msg, id: msg.id || String(Date.now() + Math.random()) };
    if (dbReady()) {
      ChatMessage.create(data).catch(e => console.error("[Socket] Message save error:", e.message));
    } else {
      inMemoryChatMessages.push(data);
    }
    socket.to(`channel:${msg.channelId}`).emit("new_message", data);
  });

  socket.on("typing", ({ channelId, isTyping }) => {
    if (!channelId) return;
    socket.to(`channel:${channelId}`).emit("user_typing", {
      name: socket.data.user?.name || "Someone", channelId, isTyping,
    });
  });

  socket.on("react", async ({ messageId, emoji, userId, channelId }) => {
    if (!messageId || !emoji || !userId || !channelId) return;
    if (dbReady()) {
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

  socket.on("call_request", ({ channelId, fromUser }) => {
    socket.to(`channel:${channelId}`).emit("call_incoming", { from: fromUser || socket.data.user, channelId });
  });

  socket.on("call_end", ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit("call_ended", { channelId });
  });


  // ── MEETING: Supremo starts session ─────────────────────────────────────
  socket.on("meeting:supremo-start", ({ sessionId, name }) => {
    supremoSockets[sessionId] = socket.id;
    meetingQueue[sessionId]   = [];
    socket.join(`meeting:${sessionId}`);
    // Broadcast to ALL connected sockets so staff know a session is live
    socket.broadcast.emit("meeting:session-started", { sessionId, supremoName: name });
    console.log(`[Meeting] Supremo started session: ${sessionId}`);
  });

  // ── MEETING: Staff joins queue ────────────────────────────────────────────
  socket.on("meeting:join-queue", ({ sessionId, userId, userName, email }) => {
    if (!meetingQueue[sessionId]) meetingQueue[sessionId] = [];
    // Remove if already in queue
    meetingQueue[sessionId] = meetingQueue[sessionId].filter(e => e.userId !== userId);
    const entry = { userId, userName, email, socketId: socket.id, joinedAt: new Date().toISOString() };
    meetingQueue[sessionId].push(entry);
    socket.data.meetingSession = sessionId;
    socket.join(`meeting:${sessionId}`);
    // Notify supremo
    const supSocket = supremoSockets[sessionId];
    if (supSocket) io.to(supSocket).emit("meeting:queue-update", meetingQueue[sessionId]);
    // Confirm to staff
    socket.emit("meeting:queue-joined", { position: meetingQueue[sessionId].length });
    console.log(`[Meeting] ${userName} joined queue for session ${sessionId}`);
  });

  // ── MEETING: Staff leaves queue ───────────────────────────────────────────
  socket.on("meeting:leave-queue", ({ sessionId, userId }) => {
    if (meetingQueue[sessionId]) {
      meetingQueue[sessionId] = meetingQueue[sessionId].filter(e => e.userId !== userId);
      const supSocket = supremoSockets[sessionId];
      if (supSocket) io.to(supSocket).emit("meeting:queue-update", meetingQueue[sessionId]);
    }
    socket.emit("meeting:queue-left");
  });

  // ── MEETING: WebRTC offer (supremo → staff) ───────────────────────────────
  socket.on("meeting:offer", ({ to, offer, sessionId }) => {
    const entry = (meetingQueue[sessionId] || []).find(e => e.userId === to);
    if (entry?.socketId) io.to(entry.socketId).emit("meeting:offer", { from: socket.id, offer, sessionId });
  });

  // ── MEETING: WebRTC answer (staff → supremo) ──────────────────────────────
  socket.on("meeting:answer", ({ to, answer }) => {
    io.to(to).emit("meeting:answer", answer);
  });

  // ── MEETING: ICE candidates ───────────────────────────────────────────────
  socket.on("meeting:ice-candidate", ({ to, candidate, sessionId }) => {
    // `to` can be a socketId (supremo sends userId, we resolve; staff sends supremo socketId directly)
    const entry = meetingQueue[sessionId]
      ? (meetingQueue[sessionId].find(e => e.userId === to) || null)
      : null;
    const targetSocket = entry ? entry.socketId : to;
    if (targetSocket) io.to(targetSocket).emit("meeting:ice-candidate", { candidate });
  });

  // ── MEETING: Promise score (staff submits) ────────────────────────────────
  socket.on("meeting:promise-score", ({ sessionId, userId, userName, email, score, comment }) => {
    const entry = { userId, userName, email, score: Number(score), comment: comment || "", submittedAt: new Date().toISOString() };
    const supSocket = supremoSockets[sessionId];
    if (supSocket) io.to(supSocket).emit("meeting:promise-score", entry);
    socket.emit("meeting:score-submitted");
  });

  // ── MEETING: End call ──────────────────────────────────────────────────────
  socket.on("meeting:end-call", ({ sessionId }) => {
    io.to(`meeting:${sessionId}`).emit("meeting:call-ended");
  });

  // ── MEETING: Supremo ends session ─────────────────────────────────────────
  socket.on("meeting:supremo-end", ({ sessionId }) => {
    io.to(`meeting:${sessionId}`).emit("meeting:session-ended");
    delete meetingQueue[sessionId];
    delete supremoSockets[sessionId];
    console.log(`[Meeting] Session ended: ${sessionId}`);
  });

  socket.on("disconnect", async () => {
    const user = socket.data.user;
    if (user?.email) {
      if (dbReady()) {
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
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  httpServer.close(async () => {
    console.log("HTTP server closed.");
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    } catch (err) {
      console.error("Error closing MongoDB:", err.message);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced exit after 10s timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("  SmartCue Server + Socket.io running on port " + PORT);
  console.log("=".repeat(60));
  console.log("  GET/POST/PUT/PATCH/DELETE  /api/users");
  console.log("  GET/POST/PUT         /api/tickets");
  console.log("  GET/POST/PUT         /api/projects");
  console.log("  GET/POST/PUT/DELETE  /api/tasks");
  console.log("  GET/POST/PUT/DELETE  /api/chat/messages/:id");
  console.log("  GET/PATCH            /api/chat/presence");
  console.log("  POST                 /api/chat/meeting");
  console.log("  GET/POST             /api/push/*");
  console.log("  POST                 /api/draft-notes");
  console.log("  POST                 /api/review-attachments");
  console.log("  POST                 /api/score-content");
  console.log("  POST                 /api/chat  (SmartCue AI)");
  console.log("  POST                 /api/tts");
  console.log("  GET/PATCH            /api/settings/voice");
  console.log("  GET                  /health");
  console.log("=".repeat(60));
  console.log("ElevenLabs:", process.env.ELEVEN_LABS_API_KEY ? "✔" : "✗ Missing");
  console.log("Daily.co:  ", process.env.DAILY_API_KEY       ? "✔" : "✗ Missing (mock links)");
  console.log("MongoDB:   ", MONGO_URI                        ? "✔ Connecting…" : "✗ In-memory mode");

  const SELF_URL = process.env.RAILWAY_STATIC_URL
    ? `https://${process.env.RAILWAY_STATIC_URL}/health`
    : `http://localhost:${PORT}/health`;

  setInterval(() => {
    fetch(SELF_URL).catch(() => {});
  }, 300_000);

  setTimeout(() => {
    console.log("⏱  TAT monitor started");
    runTATMonitor();
    setInterval(runTATMonitor, 14_400_000);

    // ── Autopulse cron — runs every 6 hours (21_600_000ms) ─────────────────
    console.log("⚡ Autopulse cron started");
    runAutopulseCron();
    setInterval(runAutopulseCron, 21_600_000);
  }, 5_000);
});


