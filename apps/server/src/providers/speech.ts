import { store } from '../store.js';
import type { Language } from '../types.js';

export interface SpeechRequest {
  text: string;
  language: Language;
  voice?: string;
  presetId?: string;
}

export interface SpeechResult {
  buffer?: Buffer;
  mimeType: string;
  provider: 'demo' | 'openai' | 'elevenlabs';
  /** When no server side TTS is configured the client renders speech itself. */
  clientSide?: boolean;
  voiceId?: string;
  note: string;
}

const ELEVEN_VOICES: Record<string, string> = {
  'warm-narrator': '21m00Tcm4TlvDq8ikWAM',
  'energetic-host': 'TxGEqnHWrfWFTfGW9XjX',
  'soft-storyteller': 'EXAVITQu4vr4xnSDxMaL',
  'clear-corporate': 'onwK4e9ZLuTAKqWW03F9',
};

async function openaiSpeech(request: SpeechRequest): Promise<SpeechResult> {
  const settings = store.settings().providers.openai;
  if (!settings.apiKey) throw new Error('OpenAI API key belum diisi / OpenAI API key is not set.');
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.ttsModel,
      voice: request.voice || settings.ttsVoice,
      input: request.text,
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    throw new Error(`TTS provider failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: 'audio/mpeg',
    provider: 'openai',
    note: `Voice-over dirender oleh ${settings.ttsModel}.`,
  };
}

async function elevenLabsSpeech(request: SpeechRequest): Promise<SpeechResult> {
  const settings = store.settings().providers.elevenlabs;
  if (!settings.apiKey) throw new Error('ElevenLabs API key belum diisi / ElevenLabs API key is not set.');
  const voiceId = ELEVEN_VOICES[request.presetId ?? ''] ?? request.voice ?? settings.voiceId;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': settings.apiKey },
    body: JSON.stringify({ text: request.text, model_id: settings.model }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: 'audio/mpeg',
    provider: 'elevenlabs',
    voiceId,
    note: `Voice-over dirender oleh ElevenLabs (${voiceId}).`,
  };
}

export async function synthesizeSpeech(request: SpeechRequest): Promise<SpeechResult> {
  const provider = store.settings().providers.tts;
  try {
    if (provider === 'openai') return await openaiSpeech(request);
    if (provider === 'elevenlabs') return await elevenLabsSpeech(request);
  } catch (error) {
    return {
      mimeType: 'audio/mpeg',
      provider: 'demo',
      clientSide: true,
      note: `Provider suara gagal (${error instanceof Error ? error.message : 'unknown'}). Memakai mesin suara browser.`,
    };
  }
  return {
    mimeType: 'audio/mpeg',
    provider: 'demo',
    clientSide: true,
    note: 'Mode demo: voice-over dibacakan mesin suara bawaan browser.',
  };
}

export function voiceMap(): Record<string, string> {
  return ELEVEN_VOICES;
}
