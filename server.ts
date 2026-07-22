/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, LiveServerMessage, Modality, ActivityHandling } from "@google/genai";
import { EdgeTTS } from "node-edge-tts";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import https from "https";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS configuration to allow mobile/webview connections from localhost
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Ensure data directory exists for syncing
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const SYNC_FILE = path.join(DATA_DIR, "sync-store.json");

// Helper to read sync store
function readSyncStore(): Record<string, any> {
  if (fs.existsSync(SYNC_FILE)) {
    try {
      const data = fs.readFileSync(SYNC_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading sync store:", e);
      return {};
    }
  }
  return {};
}

// Helper to write sync store
function writeSyncStore(store: Record<string, any>) {
  try {
    fs.writeFileSync(SYNC_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing sync store:", e);
  }
}

// 1. Chat/Tutor API Endpoint
app.post("/api/tutor/chat", async (req, res) => {
  try {
    const { messages, topic, userApiKey } = req.body;

    // Require user-provided API key
    const apiKey = userApiKey && userApiKey.trim() !== "" ? userApiKey.trim() : null;

    if (!apiKey) {
      return res.status(400).json({
        error: "Gemini API key is not configured. Please set your personal Gemini API Key in the application settings to use the tutor."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Structure conversation history for Gemini API
    // We convert the custom Message structure to Gemini contents format.
    let chatContents = messages.map((m: any) => {
      if (m.role === 'user') {
        return {
          role: 'user',
          parts: [{ text: m.text || "" }]
        };
      } else {
        // Tutor messages
        const tutorCombinedText = `${m.japanese}\n(${m.romaji})\n[Translation: ${m.english}]`;
        return {
          role: 'model',
          parts: [{ text: tutorCombinedText }]
        };
      }
    });

    // If conversation history is empty, populate with an initial trigger message to start the topic
    if (chatContents.length === 0) {
      chatContents = [{
        role: 'user',
        parts: [{ text: `Hello tutor! Please initiate our study and start the lesson for the topic: "${topic}". Ask an engaging opening question in Japanese to begin.` }]
      }];
    }

    const systemInstruction = `You are an encouraging, experienced, and warm Japanese language tutor helping a language learner practice conversational Japanese. 
The learner is practicing the topic: "${topic}".
Your goal is to teach the student Japanese by topic, just like a supportive human language tutor.

- Keep your replies concise and easy to understand for a learner (around 1-3 natural sentences).
- If this is the start of the topic (or chat history is empty), kindly greet the user and ask an inviting open-ended question related to the topic.
- In your response, provide the exact Japanese Kanji/Kana, its Romaji reading, and its English translation.
- Analyze the user's input. If they made any mistakes (particles, vocabulary, grammar, pronounciation), provide a gentle, supportive correction in English inside the 'feedback' field. If their input is good, give a small tip or praise (e.g., "Great use of the particle に!").
- Extract key common phrases or vocabulary items from this exchange that are highly useful for flashcards.`;

    const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
    let responseText = "";
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting generateContent using model: ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: chatContents,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                japanese: { 
                  type: Type.STRING, 
                  description: "The tutor's Japanese response using appropriate Kanji and Kana." 
                },
                romaji: { 
                  type: Type.STRING, 
                  description: "The romaji representation of the tutor's Japanese response." 
                },
                english: { 
                  type: Type.STRING, 
                  description: "The natural English translation of the tutor's Japanese response." 
                },
                feedback: { 
                  type: Type.STRING, 
                  description: "Brief, gentle feedback in English about the user's Japanese, or a helpful Japanese learning tip." 
                },
                commonPhrases: {
                  type: Type.ARRAY,
                  description: "A list of 1 to 3 key phrases or vocabulary words from this turn to save as flashcards.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      japanese: { type: Type.STRING, description: "Japanese word or phrase." },
                      romaji: { type: Type.STRING, description: "Romaji pronunciation." },
                      english: { type: Type.STRING, description: "English meaning." }
                    },
                    required: ["japanese", "romaji", "english"]
                  }
                }
              },
              required: ["japanese", "romaji", "english", "feedback", "commonPhrases"]
            }
          }
        });

        if (response.text) {
          responseText = response.text.trim();
          console.log(`Successfully generated content using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed. Error:`, err.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error("All tutor model fallback options are temporarily unavailable. Please retry shortly.");
    }

    const tutorResponse = JSON.parse(responseText);
    return res.json(tutorResponse);

  } catch (error: any) {
    console.error("Tutor chat API error:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred while communicating with the tutor."
    });
  }
});

// 2. Devices Sync API Endpoints
// Generate a new sync pin
app.get("/api/sync/new-code", (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6-digit alphanumeric code
  return res.json({ syncCode: `JP-${code}` });
});

// Upload sync data
app.post("/api/sync/upload", (req, res) => {
  try {
    const { syncCode, syncData } = req.body;
    if (!syncCode) {
      return res.status(400).json({ error: "Sync code is required" });
    }

    const store = readSyncStore();
    store[syncCode] = {
      syncData,
      updatedAt: Date.now()
    };
    writeSyncStore(store);

    return res.json({ success: true, message: "Data uploaded successfully" });
  } catch (error: any) {
    console.error("Sync upload error:", error);
    return res.status(500).json({ error: "Failed to upload sync data" });
  }
});

// Download sync data
app.post("/api/sync/download", (req, res) => {
  try {
    const { syncCode } = req.body;
    if (!syncCode) {
      return res.status(400).json({ error: "Sync code is required" });
    }

    const store = readSyncStore();
    const entry = store[syncCode];

    if (!entry) {
      return res.status(404).json({ error: "Sync code not found. Please double-check the code and try again." });
    }

    return res.json({ syncData: entry.syncData, updatedAt: entry.updatedAt });
  } catch (error: any) {
    console.error("Sync download error:", error);
    return res.status(500).json({ error: "Failed to download sync data" });
  }
});

// Fetch server-side WS debug logs for client diagnostics
app.get("/api/debug/logs", (req, res) => {
  try {
    const logPath = path.join(process.cwd(), "data", "ws_debug.log");
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: `[${new Date().toISOString()}] No server logs recorded yet.` });
    }
    const logsText = fs.readFileSync(logPath, "utf-8");
    return res.json({ logs: logsText });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to read server logs: ${err.message}` });
  }
});

// Clear server-side WS debug logs
app.post("/api/debug/logs/clear", (req, res) => {
  try {
    const logPath = path.join(process.cwd(), "data", "ws_debug.log");
    fs.writeFileSync(logPath, `[${new Date().toISOString()}] Server-side logs cleared by client.\n`, "utf-8");
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to clear server logs: ${err.message}` });
  }
});

function createWavHeader(pcmData: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmData.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

// High Quality Japanese TTS endpoint
app.get("/api/tts", async (req, res) => {
  try {
    const text = req.query.text as string;
    const requestedVoice = (req.query.voice as string) || 'ja-JP-NanamiNeural';

    if (!text) {
      return res.status(400).send("Text query parameter is required");
    }

    const cleanText = text
      .replace(/^JAPANESE:\s*/i, '')
      .replace(/^ROMAJI:\s*/i, '')
      .replace(/^ENGLISH:\s*/i, '')
      .replace(/<\/?b>/gi, '')
      .trim();

    if (requestedVoice === 'gtx' || requestedVoice === 'ja-JP-gtx') {
      console.log(`[TTS API] Generating Google HD Mobile TTS for: "${cleanText}"`);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=gtx&q=${encodeURIComponent(cleanText)}`;
      const requestOptions = {
        headers: {
          "User-Agent": "AndroidTranslate/7.16.0 (Linux; U; Android 12; Pixel 6 Pro)"
        }
      };
      return https.get(ttsUrl, requestOptions, (proxyResponse) => {
        if (proxyResponse.statusCode !== 200) {
          console.error(`Google TTS proxy returned status ${proxyResponse.statusCode}`);
          return res.status(500).send("Failed to fetch speech from Google Translate");
        }
        res.setHeader("Content-Type", proxyResponse.headers["content-type"] || "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        proxyResponse.pipe(res);
      }).on("error", (e) => {
        console.error("TTS proxy network error:", e);
        res.status(500).send("TTS proxy network error");
      });
    }

    const edgeVoice = (requestedVoice === 'ja-JP-KeitaNeural' || requestedVoice.toLowerCase().includes('keita')) 
      ? 'ja-JP-KeitaNeural' 
      : 'ja-JP-NanamiNeural';

    // Primary High Quality Voice: Microsoft Edge Neural TTS
    try {
      console.log(`[TTS API] Generating Microsoft Edge Neural TTS (${edgeVoice}) for: "${cleanText}"`);
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const tmpFilePath = path.join(dataDir, `tts_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp3`);
      
      const tts = new EdgeTTS({
        voice: edgeVoice,
        lang: 'ja-JP',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
      });

      await tts.ttsPromise(cleanText, tmpFilePath);

      if (fs.existsSync(tmpFilePath)) {
        const audioBuffer = fs.readFileSync(tmpFilePath);
        fs.unlinkSync(tmpFilePath); // Clean up temp file
        
        console.log(`[TTS API] Microsoft Edge Neural TTS (${edgeVoice}) generated successfully (${audioBuffer.length} bytes)`);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(audioBuffer);
      }
    } catch (err: any) {
      console.warn(`[TTS API] Microsoft Edge Neural TTS failed: ${err.message || err}, falling back to gtx proxy`);
      // Fallback proxy logic if Edge fails
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=gtx&q=${encodeURIComponent(cleanText)}`;
      https.get(ttsUrl, { headers: { "User-Agent": "AndroidTranslate/7.16.0" } }, (proxyResponse) => {
        res.setHeader("Content-Type", proxyResponse.headers["content-type"] || "audio/mpeg");
        proxyResponse.pipe(res);
      });
    }
  } catch (error: any) {
    console.error("TTS endpoint error:", error);
    res.status(500).send("Internal server error");
  }
});

function wsLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.appendFileSync(path.join(dataDir, "ws_debug.log"), line);
  } catch (err) {
    // Ignore log writing errors
  }
}

async function analyzeTurnTranscript(ai: GoogleGenAI, transcriptText: string) {
  if (!transcriptText || transcriptText.trim().length < 5) return null;
  const prompt = `You are a Japanese language analysis assistant. Extract the target Japanese learning phrase from this spoken tutor turn statement.

Spoken Tutor Turn: "${transcriptText}"

Return a valid JSON object with:
- "japanese": The target phrase in Japanese Kanji/Kana script (e.g. "A4 サイズの封筒はありますか？" or "お会計をお願いします").
- "romaji": The Romaji reading of the Japanese phrase.
- "english": The English meaning of the phrase.`;

  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-2.0-flash"];

  for (const modelName of modelsToTry) {
    try {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      if (result.text) {
        const parsed = JSON.parse(result.text);
        if (parsed.japanese && parsed.japanese.trim()) {
          wsLog(`[TurnAnalysis] Successfully analyzed turn using model ${modelName}`);
          return {
            japanese: parsed.japanese.trim(),
            romaji: parsed.romaji ? parsed.romaji.trim() : "",
            english: parsed.english ? parsed.english.trim() : ""
          };
        }
      }
    } catch (err: any) {
      wsLog(`[TurnAnalysis] Model ${modelName} failed: ${err.message || err}`);
    }
  }

  return null;
}

// Serve frontend assets or mount Vite dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  function wsLog(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(line.trim());
    try {
      fs.appendFileSync(path.join(process.cwd(), "data", "ws_debug.log"), line);
    } catch (err) {
      // Ignore log writing errors
    }
  }

  // Listen to upgrade events on HTTP server directly to track ALL upgrade attempts
  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = req.url ? req.url.split('?')[0] : '';
    wsLog(`[HTTP Upgrade Event] Direct HTTP upgrade requested for URL: ${req.url} (Pathname: ${pathname})`);
    wsLog(`[HTTP Upgrade Event] Origin: ${req.headers.origin || 'none'}`);
    wsLog(`[HTTP Upgrade Event] Host: ${req.headers.host || 'none'}`);
    wsLog(`[HTTP Upgrade Event] Connection: ${req.headers.connection || 'none'}`);
    wsLog(`[HTTP Upgrade Event] Upgrade: ${req.headers.upgrade || 'none'}`);
    wsLog(`[HTTP Upgrade Event] User-Agent: ${req.headers['user-agent'] || 'none'}`);
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/live" });
  wsLog("[Server] WebSocket Server initialized on path /live");

  wss.on("headers", (headers, req) => {
    wsLog(`[WSS Headers] Upgrade request reached WS Server for URL: ${req.url}`);
    headers.forEach(h => {
      if (!h.toLowerCase().startsWith('set-cookie') && !h.toLowerCase().startsWith('authorization')) {
        wsLog(`  -> Header line: ${h}`);
      }
    });
  });

  wss.on("error", (err) => {
    wsLog(`[WSS Error] WebSocket Server Error: ${err.stack || err.message || err}`);
  });

  wss.on("connection", async (clientWs, req) => {
    wsLog(`[Connection] New client connection request from URL: ${req.url}`);
    
    // Parse url to get the apiKey or any params
    const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
    const userApiKey = urlParams.get('apiKey');
    const userVoice = urlParams.get('voice') || 'Aoede';
    
    // Use user-provided API Key or fallback to container's GEMINI_API_KEY env variable
    const apiKey = userApiKey && userApiKey.trim() !== "" && userApiKey !== "undefined" && userApiKey !== "null" ? userApiKey.trim() : (process.env.GEMINI_API_KEY || null);

    if (!apiKey) {
      wsLog("[Connection] Connection rejected: No API key available.");
      clientWs.close(4001, "Gemini API key is not configured. Please set your personal Gemini API Key in Settings.");
      return;
    }

    const getTutorPersona = (voice: string) => {
      switch (voice) {
        case 'Charon': return { name: 'Hiro-sensei', gender: 'male', title: 'a friendly male Japanese tutor' };
        case 'Fenrir': return { name: 'Taro-sensei', gender: 'male', title: 'a deep-voiced male Japanese tutor' };
        case 'Puck': return { name: 'Ken-sensei', gender: 'male', title: 'an encouraging male Japanese tutor' };
        case 'Kore': return { name: 'Yuki-sensei', gender: 'female', title: 'a gentle female Japanese tutor' };
        case 'Aoede':
        default:
          return { name: 'Hana-sensei', gender: 'female', title: 'an encouraging female Japanese tutor' };
      }
    };

    const persona = getTutorPersona(userVoice);

    wsLog(`[Connection] Connecting to Gemini Live with API Key: ${apiKey.substring(0, 6)}... (Voice: ${userVoice}, Persona: ${persona.name})`);

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let session: any;
    let connectedModel = "";
    const liveModelsChain = ["gemini-3.1-flash-live-preview", "gemini-2.0-flash-exp"];
    let lastError: any = null;
    let currentTurnTutorText = "";

    const baseConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: userVoice } },
      },
      systemInstruction: `You are ${persona.name}, ${persona.title} conducting a live 1-on-1 voice lesson for a beginner or intermediate student.

PERSONA & GENDER IDENTITY:
1. YOUR NAME IS ${persona.name.toUpperCase()}. You are a ${persona.gender} native Japanese language teacher.
2. NEVER introduce yourself as Hana or any other name if your name is ${persona.name}. When introducing yourself or asked your name, say: "My name is ${persona.name}!"
3. Use ${persona.gender === 'male' ? 'masculine/male-appropriate' : 'feminine/female-appropriate'} phrasing when speaking Japanese.

GUARDRAILS & TUTOR SCOPE:
1. STRICT TUTOR ROLE: You are STRICTLY a Japanese Language Tutor. You MUST ONLY discuss Japanese language learning, vocabulary, grammar, pronunciation, Japanese cultural etiquette for conversations, or the active lesson scenario (e.g. ordering food, hotel check-in, asking directions).
2. OFF-TOPIC REDIRECTION: If the student asks about off-topic subjects (e.g. quantum physics, general world news, software coding, non-Japanese trivia, or general chitchat unrelated to learning Japanese), politely decline in 1 short sentence and bring the conversation back to Japanese language practice. Example: "As your Japanese tutor, I can only help you practice Japanese! Let me teach you how to say...?"
3. STRICT LANGUAGE BOUNDARY: The student speaks ONLY English and Japanese. All incoming microphone audio MUST be recognized strictly as English or Japanese words. NEVER misidentify, transcribe, or respond in Korean, Chinese, or any other language.

PEDAGOGY & CONVERSATION RULES:
1. Speak warmly and naturally out loud like a real human tutor.
2. When the student speaks in English asking how to say something, teach them the phrase by saying it clearly out loud in Japanese (e.g. "You can say: お会計をお願いします。 Okaikei wo onegai shimasu. That means: Check, please.").
3. Immediately prompt the student to repeat it (e.g. "Now you try saying it!") and STOP speaking so the student can repeat the Japanese phrase. Do NOT keep speaking in English or move on automatically.
4. When the student attempts to speak the Japanese phrase, provide encouraging feedback on their attempt.
5. Always ask: "Are you ready to move on or would you like to practice more?" NEVER move on to a new topic until the student confirms they are ready.`,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig: {
        activityHandling: ActivityHandling.NO_INTERRUPTION
      }
    };

    const callbacks = {
      onmessage: (message: LiveServerMessage) => {
        let audio: string | undefined = undefined;
        let modelText: string | undefined = undefined;

        const parts = message.serverContent?.modelTurn?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              audio = part.inlineData.data;
            }
            if (part.text) {
              modelText = (modelText || '') + part.text;
            }
          }
        }

        const outputTranscript = message.serverContent?.outputTranscription?.text;
        const turnComplete = message.serverContent?.turnComplete;
        const userTranscript = message.serverContent?.inputTranscription?.text;
        const interimUserTranscript = message.serverContent?.interimInputTranscription?.text;
        
        if (audio) {
          clientWs.send(JSON.stringify({ audio }));
        }
        if (modelText) {
          currentTurnTutorText += modelText;
          clientWs.send(JSON.stringify({ textChunk: modelText, role: 'tutor' }));
        } else if (outputTranscript) {
          currentTurnTutorText += outputTranscript;
          clientWs.send(JSON.stringify({ textChunk: outputTranscript, role: 'tutor' }));
        }
        if (userTranscript) {
          wsLog(`[Gemini] Input Transcription: ${userTranscript}`);
          clientWs.send(JSON.stringify({ userTranscript, isInterim: false }));
        }
        if (interimUserTranscript) {
          clientWs.send(JSON.stringify({ userTranscript: interimUserTranscript, isInterim: true }));
        }
        if (turnComplete) {
          const fullText = currentTurnTutorText.trim();
          currentTurnTutorText = ""; // Reset for next turn

          if (fullText) {
            analyzeTurnTranscript(ai, fullText).then((turnAnalysis) => {
              clientWs.send(JSON.stringify({ turnComplete: true, turnAnalysis }));
            }).catch(() => {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            });
          } else {
            clientWs.send(JSON.stringify({ turnComplete: true }));
          }
        }
        if (message.serverContent?.interrupted) {
          wsLog("[Gemini] User interrupted active model turn");
          clientWs.send(JSON.stringify({ interrupted: true }));
        }
      },
    };

    try {
      for (const modelCandidate of liveModelsChain) {
        try {
          wsLog(`[Connection] Trying to connect to Gemini Live with model: ${modelCandidate}...`);
          session = await ai.live.connect({
            model: modelCandidate,
            config: baseConfig,
            callbacks: callbacks
          });
          connectedModel = modelCandidate;
          wsLog(`[Connection] Connected to Gemini Live API successfully using model: ${modelCandidate}`);
          break;
        } catch (err: any) {
          lastError = err;
          wsLog(`[Connection] Failed to connect using model ${modelCandidate}: ${err.stack || err.message || err}`);
        }
      }

      if (!session) {
        wsLog(`[Connection] All Live API models failed to connect.`);
        throw lastError || new Error("Failed to connect to any Gemini Live model");
      }

      clientWs.on("message", (data) => {
        try {
          const { audio, interrupt, text } = JSON.parse(data.toString());
          if (audio) {
            session.sendRealtimeInput({
              audio: { mimeType: "audio/pcm;rate=16000", data: audio },
            });
          }
          if (text) {
            wsLog(`[Client] Sending text content: ${text}`);
            session.sendClientContent({
              turns: [{
                role: "user",
                parts: [{ text }]
              }],
              turnComplete: true
            });
          }
          if (interrupt) {
            wsLog("[Client] Requesting interruption");
            session.sendClientContent({
              turns: [{
                role: "user",
                parts: [{ text: "Excuse me." }]
              }],
              turnComplete: true
            });
          }
        } catch (e: any) {
          wsLog(`[Connection] Error processing client websocket message: ${e.message}`);
        }
      });

      clientWs.on("close", (code, reason) => {
        wsLog(`[Connection] Client WebSocket closed. Code: ${code}, Reason: ${reason || 'none'}. Cleaning up Gemini session.`);
        try {
          session.close();
        } catch (err: any) {
          wsLog(`[Connection] Error closing Gemini session: ${err.message}`);
        }
      });
    } catch (e: any) {
      wsLog(`[Connection] Error connecting to Gemini Live: ${e.stack || e.message || e}`);
      clientWs.close(1011, e.message || "Failed to connect to Gemini Live");
    }
  });
}

startServer();
