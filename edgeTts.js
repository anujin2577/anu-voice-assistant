import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EdgeTTS } from "node-edge-tts";

const cacheDir = path.join(process.cwd(), ".tts-cache");

export async function createEdgeSpeech(text, options = {}) {
  await fs.mkdir(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, `${randomUUID()}.mp3`);
  const tts = new EdgeTTS({
    voice: options.voice || "mn-MN-YesuiNeural",
    lang: options.lang || "mn-MN",
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    rate: options.rate || "-6%",
    pitch: options.pitch || "default",
    volume: options.volume || "default",
    timeout: 20000,
  });

  await tts.ttsPromise(text, filePath);
  const audio = await fs.readFile(filePath);
  await fs.unlink(filePath).catch(() => {});
  return audio;
}
