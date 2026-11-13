# AI-Based Video Generator

A portfolio-ready application that turns a written script into a narrated MP4 video with automatically generated subtitles.

## Features
- Next.js interface for entering a script and generating a video
- Node.js + Express API for job orchestration
- Python worker using gTTS, OpenAI Whisper, MoviePy, and Pillow
- Whisper-generated transcription segments used to time subtitles
- Vertical 9:16 MP4 output (720 × 1280)
- Optional MongoDB job metadata storage
- Download endpoint for completed videos

## Architecture

```text
Next.js UI
   |
   v
Express API (Node.js)
   |---- MongoDB (optional job metadata)
   |
   v
Python worker
   |---- gTTS: script -> narration
   |---- Whisper: narration -> timestamped transcript
   |---- MoviePy + Pillow: background + subtitles + audio -> MP4
   |
   v
Generated MP4
```

## Requirements
- Node.js 18+
- Python 3.10 or 3.11
- FFmpeg installed and available on PATH
- Internet connection for gTTS and the first Whisper model download
- MongoDB is optional

## Run locally

### 1. Python worker

From the project root:

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r worker/requirements.txt
```

### 2. Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

On Windows, create `.env` manually if `cp` is unavailable. The API runs at `http://localhost:5000`.

### 3. Frontend

In another terminal:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

`server/.env`:

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
MONGODB_URI=
PYTHON_EXECUTABLE=python
```

Set `MONGODB_URI` to a MongoDB connection string if you want job metadata persisted. Without it, the app still works and keeps generated files on disk.

## Output

Generated videos are saved under `server/storage/` and can be downloaded from the UI. The worker also stores narration audio and a JSON transcript alongside each video.

## Notes and limitations
- The first Whisper run downloads the selected model (`base`) and may take time.
- gTTS and Whisper model download require internet access.
- This is a functional prototype, not a production rendering service. For production, add a job queue, authentication, upload limits, cloud object storage, and resource/time limits.
- The app currently uses a generated gradient background. Custom background uploads and advanced templates can be added as future enhancements.
- Whisper transcription may differ slightly from the original script because it transcribes the generated speech.

## GitHub upload

Create a repository named `ai-video-generator`, then from this folder:

```bash
git init
git add .
git commit -m "Build AI video generator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-video-generator.git
git push -u origin main
```
