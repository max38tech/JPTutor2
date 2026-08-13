import { getServerBaseUrl } from './api';

let sharedTtsAudioCtx: AudioContext | null = null;
let currentTtsSource: AudioBufferSourceNode | null = null;

export function stopTtsAudio() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (currentTtsSource) {
    try {
      currentTtsSource.stop();
    } catch (e) {
      // Source might have finished playing
    }
    currentTtsSource = null;
  }
}

function fallbackWebSpeech(cleanText: string, rate: number = 0.8, voiceURI?: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  stopTtsAudio();
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
 * Japanese text playback using Gemini/Edge Audio endpoint (/api/tts).
 * Decodes audio via Web Audio API for zero-latency, high-quality playback.
 * Falls back gracefully to browser SpeechSynthesis API if needed.
 */
export function speakJapanese(
  text: string, 
  rate: number = 0.8, 
  voiceURI?: string, 
  apiKeyParam?: string,
  cardVoiceParam?: string
) {
  const cleanText = text
    .replace(/^JAPANESE:\s*/i, '')
    .replace(/^ROMAJI:\s*/i, '')
    .replace(/^ENGLISH:\s*/i, '')
    .replace(/<\/?b>/gi, '')
    .trim();

  if (!cleanText) return;

  stopTtsAudio();

  let apiKey = apiKeyParam || '';
  let cardVoice = cardVoiceParam || '';

  if (typeof window !== 'undefined') {
    try {
      const storedSettings = localStorage.getItem('nihongo_tutor_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (!apiKey && parsed.apiKey) apiKey = parsed.apiKey;
        if (!cardVoice && parsed.cardVoice) cardVoice = parsed.cardVoice;
      }
    } catch (e) {
      console.error('Error reading settings for TTS:', e);
    }
  }

  if (!cardVoice) cardVoice = 'ja-JP-KeitaNeural';

  // Construct TTS endpoint URL
  const serverBase = getServerBaseUrl();
  const ttsUrl = `${serverBase}/api/tts?text=${encodeURIComponent(cleanText)}&apiKey=${encodeURIComponent(apiKey)}&voice=${encodeURIComponent(cardVoice)}&rate=${encodeURIComponent(String(rate))}`;

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
          // The gtx voice can't take a rate server-side; approximate it here instead
          // of silently ignoring the setting for that one voice choice.
          const rateAppliedServerSide = res.headers.get('X-TTS-Rate-Applied') !== 'false';
          return res.arrayBuffer().then(buf => ({ buf, rateAppliedServerSide }));
        })
        .then(({ buf, rateAppliedServerSide }) =>
          sharedTtsAudioCtx!.decodeAudioData(buf).then(audioBuffer => ({ audioBuffer, rateAppliedServerSide }))
        )
        .then(({ audioBuffer, rateAppliedServerSide }) => {
          if (!sharedTtsAudioCtx) return;

          stopTtsAudio();

          const source = sharedTtsAudioCtx.createBufferSource();
          source.buffer = audioBuffer;
          if (!rateAppliedServerSide) {
            source.playbackRate.value = rate;
          }
          source.connect(sharedTtsAudioCtx.destination);
          currentTtsSource = source;

          source.onended = () => {
            if (currentTtsSource === source) {
              currentTtsSource = null;
            }
          };

          source.start(0);
        })
        .catch(err => {
          console.warn('Server TTS WebAudio error, falling back to WebSpeech:', err);
          fallbackWebSpeech(cleanText, rate, voiceURI);
        });
      return;
    }
  } catch (e) {
    console.warn('WebAudio TTS exception:', e);
  }

  fallbackWebSpeech(cleanText, rate, voiceURI);
}
