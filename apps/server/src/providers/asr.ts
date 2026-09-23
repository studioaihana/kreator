import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { store } from '../store.js';
import type { Language, SubtitleCue } from '../types.js';
import { demoTranscript, splitIntoCues } from '../creator/translate.js';

export interface TranscriptionResult {
  text: string;
  cues: SubtitleCue[];
  provider: 'demo' | 'openai' | 'local-whisper';
  note: string;
  detectedLanguage: Language;
}

function runCommand(command: string, args: string[], timeoutMs = 180_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function ffmpegExtractAudio(input: string, outputDir: string): Promise<string | null> {
  const target = `${outputDir}/audio-track.wav`;
  const result = await runCommand('ffmpeg', ['-y', '-i', input, '-vn', '-ac', '1', '-ar', '16000', target]);
  if (result.code !== 0) return null;
  try {
    await fs.access(target);
    return target;
  } catch {
    return null;
  }
}

async function openaiTranscription(filePath: string, language: Language): Promise<TranscriptionResult | null> {
  const settings = store.settings().providers.openai;
  if (!settings.apiKey) return null;
  try {
    const buffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', settings.asrModel);
    form.append('response_format', 'verbose_json');
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${settings.apiKey}` },
      body: form,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      text?: string;
      language?: string;
      segments?: { start: number; end: number; text: string }[];
    };
    const text = payload.text ?? '';
    if (!text.trim()) return null;
    const cues: SubtitleCue[] = payload.segments?.length
      ? payload.segments.map((segment, index) => ({
          index: index + 1,
          start: Number(segment.start.toFixed(2)),
          end: Number(segment.end.toFixed(2)),
          text: segment.text.trim(),
        }))
      : splitIntoCues(text, { language });
    return { text, cues, provider: 'openai', note: `Transkripsi oleh ${settings.asrModel}.`, detectedLanguage: language };
  } catch {
    return null;
  }
}

async function localWhisper(filePath: string, language: Language): Promise<TranscriptionResult | null> {
  const binary = process.env.KREATOR_WHISPER_BIN ?? 'whisper';
  const outDir = `${filePath.replace(/[^/]+$/, '')}whisper`;
  const result = await runCommand(binary, [
    filePath,
    '--model',
    process.env.KREATOR_WHISPER_MODEL ?? 'base',
    '--output_format',
    'srt',
    '--output_dir',
    outDir,
    '--language',
    language,
  ]);
  if (result.code !== 0) return null;
  try {
    const files = await fs.readdir(outDir);
    const srtName = files.find((file) => file.endsWith('.srt'));
    if (!srtName) return null;
    const srt = await fs.readFile(`${outDir}/${srtName}`, 'utf8');
    const cues: SubtitleCue[] = [];
    for (const block of srt.split(/\n\s*\n/)) {
      const lines = block.split('\n').filter(Boolean);
      if (lines.length < 3) continue;
      const [startRaw, endRaw] = (lines[1] ?? '').split(' --> ');
      const toSeconds = (value: string) => {
        const [hms, ms = '0'] = value.split(',');
        const [h = '0', m = '0', s = '0'] = (hms ?? '').split(':');
        return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
      };
      cues.push({
        index: cues.length + 1,
        start: Number(toSeconds(startRaw ?? '0').toFixed(2)),
        end: Number(toSeconds(endRaw ?? '0').toFixed(2)),
        text: lines.slice(2).join(' ').trim(),
      });
    }
    if (!cues.length) return null;
    return {
      text: cues.map((cue) => cue.text).join(' '),
      cues,
      provider: 'local-whisper',
      note: 'Transkripsi oleh Whisper lokal.',
      detectedLanguage: language,
    };
  } catch {
    return null;
  }
}

/**
 * Transcribes a media file. Order: configured provider -> local Whisper -> demo transcript.
 * The demo path keeps the whole translation workflow usable without any model.
 */
export async function transcribeAsset(assetPath: string, sourceName: string, language: Language): Promise<TranscriptionResult> {
  const provider = store.settings().providers.asr;
  const audioPath = await ffmpegExtractAudio(assetPath, assetPath.replace(/[^/]+$/, ''));

  if (provider === 'openai' && audioPath) {
    const result = await openaiTranscription(audioPath, language);
    if (result) return result;
  }
  if (provider === 'ollama') {
    const result = await localWhisper(audioPath ?? assetPath, language);
    if (result) return result;
  }
  if (provider === 'demo') {
    const local = await localWhisper(audioPath ?? assetPath, language);
    if (local) return local;
  }

  const demo = demoTranscript(sourceName, 1.5, language);
  return {
    ...demo,
    provider: 'demo',
    note: audioPath
      ? 'Mode demo: transkrip contoh dibuat lokal karena tidak ada model ASR yang aktif.'
      : 'Mode demo: transkrip contoh dibuat lokal (ffmpeg tidak tersedia untuk ekstraksi audio).',
    detectedLanguage: language,
  };
}
