"use client";

import { useState } from "react";

type Job = { id: string; status: "processing" | "completed" | "failed"; videoUrl?: string; error?: string | null };

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Home() {
  const [script, setScript] = useState("Welcome to AI Video Studio. This demo turns a written script into spoken narration, creates subtitles from the generated audio, and renders everything into a vertical video.");
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generateVideo() {
    setBusy(true);
    setMessage("");
    setJob(null);
    try {
      const response = await fetch(`${API}/api/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start generation.");
      setJob(data);
      setMessage("Your video is being generated. This can take a few minutes on the first run.");
      pollJob(data.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function pollJob(id: string) {
    const check = async () => {
      try {
        const response = await fetch(`${API}/api/jobs/${id}`);
        const data = await response.json();
        setJob(data);
        if (data.status === "completed") {
          setMessage("Video generated successfully.");
          setBusy(false);
          return;
        }
        if (data.status === "failed") {
          setMessage(data.error || "Video generation failed. Check the backend terminal.");
          setBusy(false);
          return;
        }
        window.setTimeout(check, 4000);
      } catch {
        setMessage("Unable to check job status. Make sure the backend is running.");
        setBusy(false);
      }
    };
    window.setTimeout(check, 2500);
  }

  return (
    <main className="shell">
      <nav className="nav"><div className="brand"><span className="brandIcon">▶</span> AI VIDEO STUDIO</div><span className="navTag">SCRIPT TO VIDEO</span></nav>
      <section className="hero">
        <div className="eyebrow">AI-POWERED VIDEO CREATION</div>
        <h1>Your words.<br /><span>One finished video.</span></h1>
        <p className="intro">Turn a written script into narrated video content with automatically synchronized subtitles.</p>
      </section>
      <section className="workspace">
        <div className="panel">
          <div className="panelHeading"><div><div className="step">01 / INPUT</div><h2>Write your script</h2></div><span className="counter">{script.length}/3000</span></div>
          <textarea value={script} maxLength={3000} onChange={e => setScript(e.target.value)} placeholder="Type or paste your video script here..." />
          <div className="hint">Tip: A short paragraph works best for your first render.</div>
          <button onClick={generateVideo} disabled={busy || script.trim().length < 20}>
            {busy ? "Generating your video..." : "Generate video"} <span>↗</span>
          </button>
          {message && <div className={`status ${job?.status === "failed" ? "error" : ""}`}>{busy && <span className="spinner" />} {message}</div>}
        </div>
        <aside className="panel process">
          <div className="step">02 / WORKFLOW</div><h2>Behind the scenes</h2>
          <div className="processItem"><b>01</b><div><strong>Voice generation</strong><small>gTTS converts your script into narration.</small></div></div>
          <div className="processItem"><b>02</b><div><strong>AI transcription</strong><small>Whisper identifies spoken words and timestamps.</small></div></div>
          <div className="processItem"><b>03</b><div><strong>Subtitle sync</strong><small>Transcript segments are aligned to the audio.</small></div></div>
          <div className="processItem"><b>04</b><div><strong>Video rendering</strong><small>MoviePy combines visuals, captions and sound.</small></div></div>
          {job?.status === "completed" && <a className="download" href={`${API}${job.videoUrl}`} download>Download MP4 ↓</a>}
        </aside>
      </section>
      <footer>BUILT WITH NEXT.JS · NODE.JS · WHISPER · MOVIEPY · gTTS</footer>
    </main>
  );
}
