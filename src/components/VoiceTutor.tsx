/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Message,
  TopicSession, 
  Flashcard, 
  UserProgress, 
  UserSettings 
} from '../types';
import { 
  Mic,
  MicOff,
  Sparkles, 
  ChevronRight, 
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Wifi,
  WifiOff,
  X,
  Bookmark,
  Plus,
  Check,
  Volume2
} from 'lucide-react';
import { motion } from 'motion/react';
import { speakJapanese } from '../utils/speak';
import { getWebSocketBaseUrl, isServerConfigured } from '../utils/api';
import { logger } from '../utils/logger';
import { parseTutorTurn, segmentJapanese, TurnAnalysis } from '../utils/transcript';

const SUGGESTED_TOPICS = [
  { id: 'restaurant', emoji: '🍣', label: 'Ordering Food', detail: 'Practice ordering sushi & drinks' },
  { id: 'directions', emoji: '🗺️', label: 'Asking for Directions', detail: 'Navigate Kyoto streets safely' },
  { id: 'hotel', emoji: '🏨', label: 'Ryokan Hotel Check-in', detail: 'Check into a traditional inn' },
  { id: 'intro', emoji: '🤝', label: 'Self-Introduction', detail: 'Introduce yourself to peers' },
  { id: 'shopping', emoji: '🏪', label: 'Convenience Store', detail: 'Buy snacks at a Lawson' },
];

interface VoiceTutorProps {
  settings: UserSettings;
  progress: UserProgress;
  sessions: TopicSession[];
  flashcards: Flashcard[];
  activeSessionId: string | null;
  onUpdateSessions: (sessions: TopicSession[]) => void;
  onUpdateFlashcards: (flashcards: Flashcard[]) => void;
  onUpdateProgress: (progress: UserProgress) => void;
  onSetActiveSessionId: (id: string | null) => void;
  onOpenLogs?: () => void;
  onConnectionStatusChange?: (connected: boolean) => void;
}

export default function VoiceTutor({
  settings,
  progress,
  sessions,
  flashcards,
  activeSessionId,
  onUpdateSessions,
  onUpdateFlashcards,
  onUpdateProgress,
  onSetActiveSessionId,
  onOpenLogs,
  onConnectionStatusChange,
}: VoiceTutorProps) {
  const [customTopic, setCustomTopic] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [interimSpeech, setInterimSpeech] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const sessionsRef = useRef(sessions);
  const isMicMutedRef = useRef(isMicMuted);
  const activeSessionIdRef = useRef(activeSessionId);
  const playingSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const tutorTranscriptRef = useRef<string>('');

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    onConnectionStatusChange?.(isConnected);
  }, [isConnected, onConnectionStatusChange]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Flashcard states
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [modalJapanese, setModalJapanese] = useState('');
  const [modalRomaji, setModalRomaji] = useState('');
  const [modalEnglish, setModalEnglish] = useState('');
  const [selectedText, setSelectedText] = useState('');

  // Handle save from direct bookmarked message. The message fields are already
  // parsed and validated, so they are stored as-is.
  const handleSaveToFlashcards = (japanese: string, romaji: string, english: string) => {
    const trimmedJap = japanese.trim();
    if (!trimmedJap) return;

    if (flashcards.some(fc => fc.japanese.trim() === trimmedJap)) {
      // Toggle off / remove
      const updated = flashcards.filter(fc => fc.japanese.trim() !== trimmedJap);
      onUpdateFlashcards(updated);
      return;
    }

    const newCard: Flashcard = {
      id: `fc-tutor-${Date.now()}`,
      japanese: trimmedJap,
      romaji: romaji.trim(),
      english: english.trim() || 'Meaning',
      topic: activeSession ? activeSession.topic : 'Conversation',
      learned: false,
      createdAt: Date.now()
    };

    onUpdateFlashcards([newCard, ...flashcards]);
    
    // Reward XP
    const updatedProgress = {
      ...progress,
      xp: progress.xp + 5,
      totalFlashcards: progress.totalFlashcards + 1,
    };
    onUpdateProgress(updatedProgress);
  };

  const handleOpenAddCardModal = (japanese: string, romaji: string, english: string) => {
    setModalJapanese(japanese);
    setModalRomaji(romaji || '');
    setModalEnglish(english || '');
    setShowAddCardModal(true);
  };

  const handleCreateCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalJapanese.trim()) return;

    const newCard: Flashcard = {
      id: `fc-custom-${Date.now()}`,
      japanese: modalJapanese.trim(),
      romaji: modalRomaji.trim(),
      english: modalEnglish.trim() || 'Meaning',
      topic: activeSession ? activeSession.topic : 'Personal Vocab',
      learned: false,
      createdAt: Date.now()
    };

    onUpdateFlashcards([newCard, ...flashcards]);
    setShowAddCardModal(false);
    setModalJapanese('');
    setModalRomaji('');
    setModalEnglish('');
    setSelectedText('');
    window.getSelection()?.removeAllRanges();

    // Reward XP
    const updatedProgress = {
      ...progress,
      xp: progress.xp + 5,
      totalFlashcards: progress.totalFlashcards + 1,
    };
    onUpdateProgress(updatedProgress);
  };

  const handleTextSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      setSelectedText(sel.toString().trim());
    }
  };

  // Helper: Convert PCM Float32 to Base64 16-bit PCM Little Endian
  const pcmToBase64 = (float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const stopAllAudio = () => {
    playingSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (err) {
        // Source might have finished playing or not started yet
      }
    });
    playingSourcesRef.current = [];
    if (audioContextRef.current) {
      nextStartTimeRef.current = audioContextRef.current.currentTime + 0.1;
    }
  };

  const playAudioChunk = (audioCtx: AudioContext, base64Audio: string) => {
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        float32Data[i] = buffer[i] / 32768.0;
      }
      const audioBuffer = audioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      // Slow down settings (voiceRate) only applies to browser TTS.
      // For Live AI audio, play at native speed 1.0 to preserve natural pitch.
      source.playbackRate.value = 1.0;
      
      playingSourcesRef.current.push(source);
      source.onended = () => {
        playingSourcesRef.current = playingSourcesRef.current.filter(s => s !== source);
      };
      
      const currentTime = audioCtx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.1; // Small buffer for jitter
      }
      source.start(nextStartTimeRef.current);
      // Audio plays at 1.0 speed, so advance scheduling by native duration
      nextStartTimeRef.current += audioBuffer.duration;
    } catch (e) {
      console.error("Playback error:", e);
    }
  };

  /**
   * Applies a change to the messages of the live session. Reads and writes
   * sessionsRef synchronously so that several WebSocket messages arriving in the
   * same tick (turn completion followed by its analysis) cannot clobber each other.
   */
  const updateActiveSession = (mutate: (messages: Message[]) => Message[]) => {
    const currentSessions = sessionsRef.current;
    const index = currentSessions.findIndex(s => s.id === activeSessionIdRef.current);
    if (index < 0) return;

    const newSessions = [...currentSessions];
    newSessions[index] = {
      ...currentSessions[index],
      messages: mutate(currentSessions[index].messages),
      lastActiveAt: Date.now(),
    };
    sessionsRef.current = newSessions;
    onUpdateSessions(newSessions);
  };

  const startLiveSession = async (topicName: string) => {
    setErrorMessage(null);

    if (!isServerConfigured()) {
      setErrorMessage('No backend server configured. Go to Settings → Backend Server Endpoint and enter your server URL (e.g. http://192.168.1.100:3000).');
      logger.addLog('error', 'Cannot start session: no backend server URL configured. Please set one in Settings.');
      return;
    }

    setIsConnecting(true);
    logger.addLog('info', `Attempting to start live tutor session. Topic: "${topicName}"`);

    try {
      // 1. Set up audio context for playback
      logger.addLog('info', 'Setting up audio contexts for playback...');
      const outputAudioCtx = new window.AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputAudioCtx;
      nextStartTimeRef.current = 0;

      // 2. Set up microphone capture (16kHz)
      logger.addLog('info', 'Requesting microphone permission...');
      const inputAudioCtx = new window.AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputAudioCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      logger.addLog('info', 'Microphone stream obtained successfully.');
      streamRef.current = stream;
      setIsMicrophoneActive(true);

      // Create new session object if it doesn't exist
      if (!activeSessionId) {
        const newSessionId = `session-${Date.now()}`;
        const newSession: TopicSession = {
          id: newSessionId,
          topic: topicName,
          messages: [],
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        };
        onUpdateSessions([newSession, ...sessions]);
        onSetActiveSessionId(newSessionId);
      }

      // 3. Connect to WebSocket
      const wsUrl = `${getWebSocketBaseUrl()}/live?apiKey=${encodeURIComponent(settings.apiKey)}&voice=${encodeURIComponent(settings.liveVoice || 'Charon')}`;
      logger.addLog('info', `Connecting to WebSocket live tutor backend at: ${getWebSocketBaseUrl()}/live`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.addLog('info', 'WebSocket connected successfully to live tutor. Sending prompt...');
        setIsConnected(true);
        setIsConnecting(false);

        // Gather previous coverage logs for this topic
        const matchingSessions = sessionsRef.current.filter(
          s => s.topic.trim().toLowerCase() === topicName.trim().toLowerCase()
        );
        const coveredSentences = Array.from(
          new Set(
            matchingSessions.flatMap(s =>
              s.messages
                .filter(m => m.role === 'tutor' && m.japanese)
                .map(m => m.japanese!.trim())
            )
          )
        ).filter(Boolean).slice(0, 10);

        const matchingFlashcards = flashcards.filter(fc =>
          fc.topic.trim().toLowerCase() === topicName.trim().toLowerCase() ||
          fc.topic.trim().toLowerCase().includes(topicName.trim().toLowerCase()) ||
          topicName.trim().toLowerCase().includes(fc.topic.trim().toLowerCase())
        );
        const coveredFlashcards = Array.from(
          new Set(
            matchingFlashcards.map(fc => `${fc.japanese.trim()} (${fc.english.trim()})`)
          )
        ).slice(0, 10);

        // Previously covered material is sent so the tutor moves on to new
        // phrases. It must not turn into a menu for the student to choose from.
        const covered = [...coveredSentences, ...coveredFlashcards];
        const logContext = covered.length > 0
          ? `\n\nAlready practised, so teach something new instead and only revisit these if I get one wrong: ${covered.join(' / ')}`
          : '';

        const startPrompt = `Topic: "${topicName}". I am a beginner and will mostly speak English. Say exactly "Great, let's learn to converse about the topic: ${topicName}." then introduce yourself in one short sentence and immediately teach me the first phrase. Do not ask me what I want to practise.${logContext}`;

        // Tell the model about the topic immediately once connected.
        ws.send(JSON.stringify({ 
          text: startPrompt
        }));
        
        // Start streaming mic audio
        const source = inputAudioCtx.createMediaStreamSource(stream);
        const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        source.connect(processor);
        processor.connect(inputAudioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !isMicMutedRef.current) {
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            playAudioChunk(outputAudioCtx, msg.audio);
          }
          if (msg.textChunk) {
            tutorTranscriptRef.current += msg.textChunk;
            setCurrentTranscript(tutorTranscriptRef.current);
          }
          if (msg.userTranscript !== undefined) {
            if (msg.isInterim) {
              setInterimSpeech(msg.userTranscript);
            } else {
              setInterimSpeech('');
              stopAllAudio(); // Stop any overlapping audio when the user is speaking/done speaking
              if (msg.userTranscript.trim()) {
                const cleanUserText = msg.userTranscript
                  .replace(/<\/?b>/gi, '')
                  .replace(/\*\*/g, '')
                  .replace(/\*/g, '')
                  .trim();
                const newUserMsg: Message = {
                  id: `user-${Date.now()}`,
                  role: 'user',
                  text: cleanUserText,
                  timestamp: Date.now()
                };
                updateActiveSession(messages => [newUserMsg, ...messages]);
              }
            }
          }
          if (msg.turnComplete) {
            const completedText = tutorTranscriptRef.current.trim();
            if (completedText) {
              // Show the turn straight away from the transcript alone. The
              // backend sends its structured analysis separately, keyed by
              // turnId, and it refines this message when it arrives.
              const newMsg: Message = {
                id: `tutor-${msg.turnId || Date.now()}`,
                role: 'tutor',
                text: completedText.replace(/<\/?b>/gi, '').replace(/\*/g, '').trim(),
                ...parseTutorTurn(completedText, msg.turnAnalysis),
                timestamp: Date.now()
              };
              updateActiveSession(messages => [newMsg, ...messages]);
            }
            tutorTranscriptRef.current = '';
            setCurrentTranscript('');
          }
          if (msg.turnAnalysis && msg.turnId && !msg.turnComplete) {
            const targetId = `tutor-${msg.turnId}`;
            const analysis = msg.turnAnalysis as TurnAnalysis;
            updateActiveSession(messages =>
              messages.map(m => (m.id === targetId ? { ...m, ...parseTutorTurn(m.text || '', analysis) } : m))
            );
          }
          if (msg.interrupted) {
            stopAllAudio();
            tutorTranscriptRef.current = '';
            setCurrentTranscript('');
            setInterimSpeech('');
          }
        } catch (e) {
          console.error("Error processing websocket message", e);
        }
      };

      ws.onerror = (e: Event) => {
        console.error("WebSocket Error Event:", e);
        const errDetails = {
          isTrusted: e.isTrusted,
          type: e.type,
          readyState: ws.readyState,
          url: ws.url ? ws.url.split('?')[0] : 'unknown'
        };
        logger.addLog('error', `WebSocket Error event received! Details: ${JSON.stringify(errDetails)}. State: ${ws.readyState}`);
        setErrorMessage("Connection error to live tutor. Tap Settings -> Diagnostics Panel -> Backend Server Logs to investigate.");
        cleanupLiveSession();
      };

      ws.onclose = (e: CloseEvent) => {
        console.log("WebSocket Closed. Code:", e.code, "Reason:", e.reason);
        
        let troubleshootHint = "";
        if (e.code === 1006) {
          const isAIStudioDomain = wsUrl.includes("ais-dev-") || wsUrl.includes("ais-pre-");
          if (isAIStudioDomain) {
            troubleshootHint = " (Abnormal closure: AI Studio development/shared URLs are protected by strict session authentication. Connections from external devices like native mobile apps will be blocked and redirected to a login page. For mobile testing, please deploy your backend to a public, unauthenticated cloud hosting provider.)";
          } else {
            troubleshootHint = " (Abnormal closure: Typically means secure WebSocket handshake failed, or connection was blocked by network/proxy. Check Backend Server Logs under Diagnostics!)";
          }
        } else if (e.code === 1008 || e.code === 4001) {
          troubleshootHint = " (Policy violation/Auth: Gemini API key invalid or rejected.)";
        }

        logger.addLog('info', `WebSocket connection closed. Code: ${e.code}, Reason: ${e.reason || 'No reason specified'}${troubleshootHint}`);
        
        if (e.code === 1000 || e.code === 1005) {
          // Normal, intentional closure when user ends the session or navigates away. No error to show.
          setErrorMessage(null);
        } else if (e.code === 4001 || e.code === 1008) {
          setErrorMessage(`API Key Error: ${e.reason || 'Gemini API key is invalid or not configured.'}`);
        } else if (e.code === 1006 && (wsUrl.includes("ais-dev-") || wsUrl.includes("ais-pre-"))) {
          setErrorMessage(`Session closed (Code: 1006). AI Studio preview URLs require active browser authentication. For external/mobile testing, deploy your backend publicly!`);
        } else {
          setErrorMessage(`Session closed (Code: ${e.code}). Tap Settings -> Diagnostics Panel to inspect logs.`);
        }
        cleanupLiveSession();
      };
    } catch (e: any) {
      console.error(e);
      logger.addLog('error', `Session Initialization Failed: ${e.message || e}`, e.stack);
      setErrorMessage(e.message || "Could not access microphone or connect to tutor.");
      setIsConnecting(false);
    }
  };

  const cleanupLiveSession = () => {
    stopAllAudio();
    if (processorRef.current && inputAudioCtxRef.current) {
      processorRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsMicrophoneActive(false);
  };

  const endTopic = () => {
    cleanupLiveSession();
    onSetActiveSessionId(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupLiveSession();
  }, []);

  // Re-connect if activeSessionId is set but ws is not connected
  useEffect(() => {
    if (activeSessionId && activeSession && !isConnected && !isConnecting) {
      startLiveSession(activeSession.topic);
    }
  }, [activeSessionId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* 1. TOPIC SELECTION / HOME SCREEN */}
      {!activeSessionId && (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 no-scrollbar">
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-semibold rounded-full border border-indigo-100 dark:border-indigo-900/50">
              <Sparkles className="w-3.5 h-3.5" />
              Live Voice Tutor
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-slate-50">
              Practice Japanese
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Have a real-time voice conversation. Speak in English, and the tutor will teach you how to say it in Japanese!
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex flex-col gap-2 text-left animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-800 dark:text-rose-300">Connection Failed</h4>
                  <p className="text-[11px] leading-relaxed">{errorMessage}</p>
                </div>
              </div>
              {onOpenLogs && (
                <button
                  onClick={onOpenLogs}
                  className="mt-1 self-start px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/55 dark:hover:bg-rose-900/55 text-rose-700 dark:text-rose-300 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  View Diagnostic Logs
                </button>
              )}
            </div>
          )}

          {!settings.apiKey && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Gemini API Key Required
                </h4>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                  A personal Gemini API Key is required to practice. Please configure and save your API Key in the **Settings** menu.
                </p>
              </div>
            </div>
          )}

          {!isServerConfigured() && (
            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40 rounded-2xl flex items-start gap-3 animate-in fade-in duration-200">
              <Wifi className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                  Backend Server Required
                </h4>
                <p className="text-[11px] text-sky-700/90 dark:text-sky-400/90 leading-relaxed">
                  To use this app on your phone, you need a backend server running. Go to <strong>Settings → Backend Server Endpoint</strong> and enter your server's URL (e.g. <code className="bg-sky-100 dark:bg-sky-900/40 px-1 rounded">http://192.168.1.x:3000</code>).
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Suggested Scenarios
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {SUGGESTED_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => startLiveSession(topic.label)}
                  disabled={isConnecting || !settings.apiKey}
                  className="flex items-start text-left gap-4 p-4 bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all group duration-250 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-3xl p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform">
                    {topic.emoji}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                      {topic.label}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {topic.detail}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                Custom Study Topic
              </h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customTopic.trim() && !isConnecting && settings.apiKey) {
                  startLiveSession(customTopic.trim());
                  setCustomTopic('');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Type a topic..."
                disabled={isConnecting || !settings.apiKey}
                className="flex-1 text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!customTopic.trim() || isConnecting || !settings.apiKey}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                Start
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. ACTIVE LIVE SESSION */}
      {activeSessionId && activeSession && (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950/10">
          
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <button 
                onClick={endTopic}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold uppercase tracking-wider">
                  Live Voice Topic
                </span>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                  {activeSession.topic}
                </h2>
              </div>
            </div>
            <button
              onClick={endTopic}
              className="text-xs px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-full font-semibold border border-rose-100 dark:border-rose-900/50 transition-colors cursor-pointer"
            >
              End Session
            </button>
          </div>

          <div className="flex flex-col items-center justify-center p-6 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/80">
            <div className="relative">
              <div className={`absolute inset-0 bg-indigo-500 rounded-full opacity-20 ${isMicrophoneActive ? 'animate-ping' : ''}`} style={{ animationDuration: '2s' }}></div>
              <div className={`absolute -inset-4 bg-indigo-500 rounded-full opacity-10 ${isMicrophoneActive ? 'animate-ping' : ''}`} style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
              
              <div className="relative w-20 h-20 bg-indigo-50 dark:bg-indigo-900/40 rounded-full shadow-md border-2 border-indigo-100 dark:border-indigo-800 flex items-center justify-center">
                <span className="text-3xl">🇯🇵</span>
              </div>
            </div>

            <div className="text-center mt-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isConnecting ? "Connecting to Tutor..." : isConnected ? "Tutor is Listening" : "Session Ended"}
              </h3>
              
              <div className="flex items-center justify-center gap-2 mt-2">
                {isConnected ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-wider">
                    <Wifi className="w-3.5 h-3.5" />
                    Live Active
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    <WifiOff className="w-3.5 h-3.5" />
                    Disconnected
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {isConnected && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => setIsMicMuted(!isMicMuted)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs transition-colors cursor-pointer ${
                      isMicMuted 
                        ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-900/60" 
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                    }`}
                  >
                    {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isMicMuted ? "Mic Muted" : "Mic Active"}
                  </button>
                  
                  <button
                    onClick={() => {
                      stopAllAudio();
                      setCurrentTranscript('');
                      tutorTranscriptRef.current = '';
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ interrupt: true }));
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Interrupt
                  </button>
                </div>
              )}
            </div>
          </div>

          <div 
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
            className="flex-1 overflow-y-auto px-4 py-6 space-y-4 no-scrollbar bg-slate-50 dark:bg-slate-950 relative"
          >
            {interimSpeech && (
              <div className="w-full bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl shadow-sm border border-dashed border-indigo-300 dark:border-indigo-800 animate-pulse">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                  You are speaking...
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic font-sans">
                  "{interimSpeech}"
                </p>
              </div>
            )}

            {currentTranscript && (
              <div className="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Tutor is speaking...
                </span>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                  {currentTranscript}
                </p>
              </div>
            )}

            {activeSession.messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`w-full p-4 rounded-2xl shadow-sm border flex flex-col gap-2 ${
                  msg.role === 'user' 
                    ? "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100/70 dark:border-indigo-900/40" 
                    : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      msg.role === 'user' ? "text-indigo-600 dark:text-indigo-300" : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {msg.role === 'user' ? "You" : "Tutor"}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.role === 'tutor' && msg.japanese && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakJapanese(msg.japanese!, settings.voiceRate, settings.voiceURI, settings.apiKey, settings.cardVoice);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer"
                        title="Speak aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSaveToFlashcards(msg.japanese!, msg.romaji || '', msg.english || '')}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          flashcards.some(fc => fc.japanese.trim() === msg.japanese!.trim())
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 scale-105'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                        }`}
                        title={flashcards.some(fc => fc.japanese.trim() === msg.japanese!.trim()) ? "Saved to Flashcards" : "Save to Flashcards"}
                      >
                        <Bookmark className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  )}
                </div>
                {msg.japanese && msg.japanese !== msg.text ? (
                  <>
                    <div className="flex flex-wrap items-center gap-x-0.5 text-lg font-bold text-slate-900 dark:text-white leading-relaxed select-text">
                      {segmentJapanese(msg.japanese).map((word, wIdx) => {
                        const isPunctuation = /^[、。？！「」\s]+$/.test(word);
                        if (isPunctuation) {
                          return <span key={wIdx}>{word}</span>;
                        }
                        return (
                          <span 
                            key={wIdx}
                            onClick={() => handleOpenAddCardModal(word, '', '')}
                            className="underline decoration-dotted decoration-indigo-300 hover:decoration-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-300 px-0.5 rounded transition-all cursor-pointer"
                            title="Click to save word to flashcards"
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>
                    {msg.romaji && (
                      <p className="text-xs font-mono text-indigo-500 dark:text-indigo-300 tracking-wide select-text">
                        {msg.romaji}
                      </p>
                    )}
                    {msg.english && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 italic border-l-2 border-indigo-500/30 pl-2 mt-1 select-text">
                        {msg.english}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-0.5 text-base text-slate-800 dark:text-slate-200 leading-relaxed select-text">
                    {segmentJapanese(msg.text).map((word, wIdx) => {
                      const isPunctuationOrAscii = /^[a-zA-Z0-9\s.,?!'"/\\<>;:()+=-]+$/.test(word);
                      if (isPunctuationOrAscii) {
                        return <span key={wIdx}>{word}</span>;
                      }
                      return (
                        <span 
                          key={wIdx}
                          onClick={() => handleOpenAddCardModal(word, '', '')}
                          className="underline decoration-dotted decoration-indigo-300 hover:decoration-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-300 px-0.5 rounded transition-all cursor-pointer font-bold"
                          title="Click to save word to flashcards"
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Selection detection FAB */}
            {selectedText && (
              <div className="absolute bottom-4 left-4 right-4 bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between z-30 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex-1 min-w-0 pr-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 block">Selection detected</span>
                  <p className="text-xs font-bold truncate">"{selectedText}"</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      handleOpenAddCardModal(selectedText, '', '');
                      setSelectedText('');
                    }}
                    className="px-3 py-1.5 bg-white text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer"
                  >
                    Create Card
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedText('');
                      window.getSelection()?.removeAllRanges();
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg text-white/80 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Add Custom Card modal */}
      {showAddCardModal && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-6 z-40 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
                Create Flashcard
              </h3>
              <button
                onClick={() => {
                  setShowAddCardModal(false);
                  setSelectedText('');
                  window.getSelection()?.removeAllRanges();
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomCard} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 block">
                  Japanese (Kanji / Kana)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. お会計をお願いします"
                  value={modalJapanese}
                  onChange={(e) => setModalJapanese(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 block">
                  Romaji Reading (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Okaikei wo onegai shimasu"
                  value={modalRomaji}
                  onChange={(e) => setModalRomaji(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 block">
                  English Translation
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Check, please / Bill, please"
                  value={modalEnglish}
                  onChange={(e) => setModalEnglish(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Save Flashcard
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
