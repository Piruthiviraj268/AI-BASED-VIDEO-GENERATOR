import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 5000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(serverRoot, "..");
const storageDir = path.join(serverRoot, "storage");
const workerPath = path.join(projectRoot, "worker", "generate_video.py");
fs.mkdirSync(storageDir, { recursive: true });

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

let jobsCollection = null;
if (process.env.MONGODB_URI) {
  try {
    const mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    jobsCollection = mongo.db("ai_video_generator").collection("jobs");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection failed; continuing without persistence:", error.message);
  }
}

const jobs = new Map();

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    error: job.error || null,
    videoUrl: job.status === "completed" ? `/api/videos/${job.id}` : null
  };
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", database: jobsCollection ? "connected" : "optional/offline" }));

app.post("/api/videos", async (req, res) => {
  const script = typeof req.body?.script === "string" ? req.body.script.trim() : "";
  if (script.length < 20) return res.status(400).json({ error: "Please enter a script with at least 20 characters." });
  if (script.length > 3000) return res.status(400).json({ error: "Script must be 3,000 characters or fewer." });

  const id = nanoid(12);
  const job = { id, script, status: "processing", createdAt: new Date().toISOString() };
  jobs.set(id, job);
  if (jobsCollection) await jobsCollection.insertOne({ ...job });

  const python = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");
  const child = spawn(python, [workerPath, "--script", script, "--output-dir", storageDir, "--job-id", id], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stdout.on("data", chunk => console.log(`[worker ${id}] ${chunk.toString().trim()}`));
  child.stderr.on("data", chunk => { stderr += chunk.toString(); console.error(`[worker ${id}] ${chunk.toString().trim()}`); });

  child.on("error", async error => {
    job.status = "failed";
    job.error = `Could not start Python worker: ${error.message}`;
    if (jobsCollection) await jobsCollection.updateOne({ id }, { $set: { status: job.status, error: job.error } });
  });

  child.on("close", async code => {
    if (code === 0) {
      job.status = "completed";
    } else {
      job.status = "failed";
      job.error = stderr.slice(-1200) || `Video worker exited with code ${code}`;
    }
    if (jobsCollection) await jobsCollection.updateOne({ id }, { $set: { status: job.status, error: job.error || null } });
  });

  res.status(202).json(publicJob(job));
});

app.get("/api/videos/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Video job not found. Jobs are stored in memory for this demo session." });
  if (job.status !== "completed") return res.status(409).json({ error: "Video is not ready yet." });
  const videoPath = path.join(storageDir, `${job.id}.mp4`);
  if (!fs.existsSync(videoPath)) return res.status(404).json({ error: "Rendered video file is missing." });
  res.download(videoPath, `ai-video-${job.id}.mp4`);
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json(publicJob(job));
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
