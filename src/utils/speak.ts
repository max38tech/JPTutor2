import { getServerBaseUrl } from './api';

let sharedTtsAudioCtx: AudioContext | null = null;

function fallbackWebSpeech(cleanText: string, rate: number = 0.8, voiceURI?: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = null;
  if (voiceURI) {
    selectedVoice = voices.find(v => v.voiceURI === voiceURI || v.name === voiceURI);
  }
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.toLowerCase().includes('ja-jp') || v.lang.toLowerCase().startsWith('ja'));
  }
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  window.speechSynthesis.speak(utterance);
}

/**
 * Japanese text playback using Gemini 2.0 Flash Audio endpoint (/api/tts).
 * Decodes WAV audio via Web Audio API for zero-latency, high-quality playback.
 * Falls back gracefully to browser SpeechSynthesis API if needed.
 */
export function speakJapanese(text: string, rate: number = 0.8, voiceURI?: string, apiKeyParam?: string) {
  const cleanText = text
    .replace(/^JAPANESE:\s*/i, '')
    .replace(/^ROMAJI:\s*/i, '')
    .replace(/^ENGLISH:\s*/i, '')
    .replace(/<\/?b>/gi, '')
    .trim();

  if (!cleanText) return;

  let apiKey = apiKeyParam || '';
  if (!apiKey && typeof window !== 'undefined') {
    try {
      const storedSettings = localStorage.getItem('nihongo_tutor_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed.apiKey) apiKey = parsed.apiKey;
      }
    } catch (e) {
      console.error('Error reading apiKey for TTS:', e);
    }
  }

  const serverBase = getServerBaseUrl();
  if (serverBase) {
    const ttsUrl = `${serverBase}/api/tts?text=${encodeURIComponent(cleanText)}&apiKey=${encodeURIComponent(apiKey)}`;

    try {
      const AudioCtxClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
      if (AudioCtxClass) {
        if (!sharedTtsAudioCtx || sharedTtsAudioCtx.state === 'closed') {
          sharedTtsAudioCtx = new AudioCtxClass();
        }
        if (sharedTtsAudioCtx.state === 'suspended') {
          sharedTtsAudioCtx.resume();
        }

        fetch(ttsUrl)
          .then(res => {
            if (!res.ok) throw new Error(`TTS server HTTP ${res.status}`);
            return res.arrayBuffer();
          })
          .then(arrayBuffer => sharedTtsAudioCtx!.decodeAudioData(arrayBuffer))
          .then(audioBuffer => {
            if (!sharedTtsAudioCtx) return;
            const source = sharedTtsAudioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(sharedTtsAudioCtx.destination);
            source.start(0);
          })
          .catch(err => {
            console.warn('Gemini Server TTS WebAudio error, falling back to WebSpeech:', err);
            fallbackWebSpeech(cleanText, rate, voiceURI);
          });
        return;
      }
    } catch (e) {
      console.warn('WebAudio TTS exception:', e);
    }
  }

  fallbackWebSpeech(cleanText, rate, voiceURI);
}
