import argparse
import json
import os
import sys
from pathlib import Path

import whisper
from gtts import gTTS
from PIL import Image, ImageDraw, ImageFont
from moviepy.editor import AudioFileClip, ImageClip, CompositeVideoClip

WIDTH, HEIGHT = 720, 1280
FPS = 24

def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()

def make_background(path):
    image = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = image.load()
    top = (19, 28, 58)
    bottom = (76, 35, 104)
    for y in range(HEIGHT):
        t = y / max(1, HEIGHT - 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        for x in range(WIDTH):
            pixels[x, y] = color
    draw = ImageDraw.Draw(image)
    draw.ellipse((460, 100, 900, 540), fill=(45, 57, 105))
    draw.ellipse((-220, 850, 300, 1370), fill=(45, 43, 105))
    image.save(path, quality=92)

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = f"{current} {word}".strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]

def make_caption_image(text, path):
    canvas = Image.new("RGBA", (WIDTH, 270), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font = load_font(38)
    lines = wrap_text(draw, text.strip(), font, 620)[:3]
    line_heights = [draw.textbbox((0, 0), line, font=font)[3] + 12 for line in lines]
    y = (270 - sum(line_heights)) // 2
    for line, line_height in zip(lines, line_heights):
        box = draw.textbbox((0, 0), line, font=font, stroke_width=1)
        x = (WIDTH - (box[2] - box[0])) // 2
        draw.text((x, y), line, font=font, fill="white",
                  stroke_width=2, stroke_fill=(10, 10, 20, 230))
        y += line_height
    canvas.save(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--job-id", required=True)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    audio_path = output_dir / f"{args.job_id}.mp3"
    video_path = output_dir / f"{args.job_id}.mp4"
    transcript_path = output_dir / f"{args.job_id}.json"
    background_path = output_dir / f"{args.job_id}-background.jpg"

    print("Generating narration with gTTS...")
    gTTS(text=args.script, lang="en", slow=False).save(str(audio_path))

    print("Loading Whisper model and transcribing narration...")
    model = whisper.load_model("base")
    transcription = model.transcribe(str(audio_path), fp16=False)
    segments = transcription.get("segments", [])
    audio = AudioFileClip(str(audio_path))
    duration = audio.duration

    if not segments:
        segments = [{"start": 0.0, "end": duration, "text": args.script}]

    make_background(background_path)
    background = ImageClip(str(background_path)).set_duration(duration)
    layers = [background]
    caption_files = []

    for index, segment in enumerate(segments):
        start = max(0.0, float(segment.get("start", 0)))
        end = min(duration, float(segment.get("end", duration)))
        if end <= start:
            continue
        caption_path = output_dir / f"{args.job_id}-caption-{index}.png"
        make_caption_image(segment.get("text", ""), caption_path)
        caption_files.append(caption_path)
        caption = (ImageClip(str(caption_path))
                   .set_start(start).set_duration(end - start)
                   .set_position(("center", HEIGHT - 390)))
        layers.append(caption)

    print("Rendering MP4 with synchronized captions...")
    video = CompositeVideoClip(layers, size=(WIDTH, HEIGHT)).set_audio(audio)
    video.write_videofile(
        str(video_path), fps=FPS, codec="libx264", audio_codec="aac",
        preset="medium", threads=2, logger=None
    )

    transcript_path.write_text(json.dumps({
        "language": transcription.get("language", "unknown"),
        "duration_seconds": duration,
        "segments": segments
    }, indent=2), encoding="utf-8")

    video.close()
    audio.close()
    for item in caption_files:
        item.unlink(missing_ok=True)
    background_path.unlink(missing_ok=True)
    print(f"SUCCESS: {video_path}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
