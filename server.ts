/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, ActivityHandling } from "@google/genai";
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

// Devices Sync API Endpoints
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

// In-app bug/feature reporting. Both endpoints are unauthenticated like the
// rest of this API, so each gets a small per-IP cooldown against accidental
// double-submits or trivial spam - not a substitute for real abuse defenses,
// but proportionate to a personal-scale app with no user accounts.
const lastReportByIp = new Map<string, number>();
const REPORT_COOLDOWN_MS = 20_000;

function checkReportCooldown(req: any, type: "bug" | "feature"): string | null {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const key = `${ip}:${type}`;
  const last = lastReportByIp.get(key);
  const now = Date.now();
  if (last && now - last < REPORT_COOLDOWN_MS) {
    return `Please wait a moment before submitting another report.`;
  }
  lastReportByIp.set(key, now);
  return null;
}

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

// Uploads data-URL screenshots to Supabase Storage and returns their public
// URLs, so they can be embedded as markdown images in the GitHub issue body.
// Best-effort: screenshot upload failures are logged but never block the bug
// report itself from going through, and if Supabase isn't configured at all
// this just returns an empty list.
async function uploadScreenshots(screenshots: string[]): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey || !screenshots?.length) return [];

  const urls: string[] = [];
  for (const [i, dataUrl] of screenshots.slice(0, MAX_SCREENSHOTS).entries()) {
    try {
      const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
      if (!match) continue;
      const [, mimeType, base64] = match;
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > MAX_SCREENSHOT_BYTES) continue;

      const ext = mimeType.split("/")[1] || "jpg";
      const path = `bug-reports/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const upRes = await fetch(`${supabaseUrl}/storage/v1/object/bug-report-screenshots/${path}`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": mimeType,
        },
        body: buffer,
      });

      if (upRes.ok) {
        urls.push(`${supabaseUrl}/storage/v1/object/public/bug-report-screenshots/${path}`);
      } else {
        wsLog(`[Report] Screenshot upload failed: ${upRes.status} ${await upRes.text()}`);
      }
    } catch (err: any) {
      wsLog(`[Report] Screenshot upload error: ${err.message || err}`);
    }
  }
  return urls;
}

// Bugs become GitHub issues so they can be triaged and fixed quickly.
// Requires GITHUB_ISSUE_TOKEN: a fine-grained PAT scoped to Issues:write on
// this repo only. GITHUB_REPO defaults to this project's own repo.
app.post("/api/report/bug", async (req, res) => {
  try {
    const cooldownError = checkReportCooldown(req, "bug");
    if (cooldownError) return res.status(429).json({ error: cooldownError });

    const token = process.env.GITHUB_ISSUE_TOKEN;
    if (!token) {
      return res.status(501).json({ error: "Bug reporting is not configured on the server yet." });
    }

    const { description, clientLogs, serverLogs, deviceInfo, screenshots } = req.body || {};
    const cleanDescription = String(description || "").trim().slice(0, 3000);
    if (!cleanDescription) {
      return res.status(400).json({ error: "A description of the bug is required." });
    }

    const repo = process.env.GITHUB_REPO || "max38tech/JPTutor";
    const truncate = (s: any, max: number) => {
      const str = String(s || "").trim();
      if (!str) return "(none captured)";
      return str.length > max ? `... (truncated) ...\n${str.slice(-max)}` : str;
    };

    const screenshotUrls = await uploadScreenshots(Array.isArray(screenshots) ? screenshots : []);
    const screenshotsSection = screenshotUrls.length
      ? ["", "---", ...screenshotUrls.map((url, i) => `![screenshot ${i + 1}](${url})`)]
      : [];

    const body = [
      cleanDescription,
      ...screenshotsSection,
      "",
      "---",
      `**Device:** ${truncate(deviceInfo, 300)}`,
      "",
      "<details><summary>Client logs</summary>\n\n```",
      truncate(clientLogs, 4000),
      "```\n</details>",
      "",
      "<details><summary>Server logs</summary>\n\n```",
      truncate(serverLogs, 4000),
      "```\n</details>",
      "",
      "_Reported from the app's in-app bug report form._",
    ].join("\n");

    const title = cleanDescription.split("\n")[0].slice(0, 80) || "Bug report from app";

    const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ title, body, labels: ["bug", "in-app-report"] }),
    });

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      wsLog(`[Report] GitHub issue creation failed: ${ghRes.status} ${errText}`);
      return res.status(502).json({ error: "Failed to file the bug report. Please try again later." });
    }

    const issue = await ghRes.json();
    wsLog(`[Report] Bug report filed as issue #${issue.number}`);
    return res.json({ success: true, issueNumber: issue.number, issueUrl: issue.html_url });
  } catch (error: any) {
    wsLog(`[Report] Bug report error: ${error.message || error}`);
    return res.status(500).json({ error: "Failed to file the bug report." });
  }
});

// Feature requests are logged for manual review rather than turned into
// issues automatically - they need a product judgment call, not a fix.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only,
// never sent to the client). The table has RLS enabled with no policies, so
// only the service-role key can read or write it.
app.post("/api/report/feature", async (req, res) => {
  try {
    const cooldownError = checkReportCooldown(req, "feature");
    if (cooldownError) return res.status(429).json({ error: cooldownError });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(501).json({ error: "Feature requests are not configured on the server yet." });
    }

    const { description, deviceInfo, appVersion } = req.body || {};
    const cleanDescription = String(description || "").trim().slice(0, 2000);
    if (!cleanDescription) {
      return res.status(400).json({ error: "A description of the feature is required." });
    }

    const sbRes = await fetch(`${supabaseUrl}/rest/v1/feature_requests`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        description: cleanDescription,
        device_info: String(deviceInfo || "").slice(0, 300),
        app_version: String(appVersion || "").slice(0, 50),
      }),
    });

    if (!sbRes.ok) {
      const errText = await sbRes.text();
      wsLog(`[Report] Supabase insert failed: ${sbRes.status} ${errText}`);
      return res.status(502).json({ error: "Failed to log the feature request. Please try again later." });
    }

    wsLog(`[Report] Feature request logged.`);
    return res.json({ success: true });
  } catch (error: any) {
    wsLog(`[Report] Feature request error: ${error.message || error}`);
    return res.status(500).json({ error: "Failed to log the feature request." });
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

    // Speech rate as a multiplier (1.0 = normal), clamped to what sounds usable,
    // converted to the SSML prosody percentage node-edge-tts expects.
    const requestedRate = parseFloat(req.query.rate as string);
    const rateMultiplier = Number.isFinite(requestedRate) ? Math.min(2, Math.max(0.5, requestedRate)) : 1;
    const ssmlRate = `${rateMultiplier >= 1 ? '+' : ''}${Math.round((rateMultiplier - 1) * 100)}%`;

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
        // Google's translate_tts proxy has no rate control; tell the client to
        // approximate it client-side instead of silently ignoring the setting.
        res.setHeader("X-TTS-Rate-Applied", "false");
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
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        rate: ssmlRate
      });

      await tts.ttsPromise(cleanText, tmpFilePath);

      if (fs.existsSync(tmpFilePath)) {
        const audioBuffer = fs.readFileSync(tmpFilePath);
        fs.unlinkSync(tmpFilePath); // Clean up temp file
        
        console.log(`[TTS API] Microsoft Edge Neural TTS (${edgeVoice}) generated successfully (${audioBuffer.length} bytes)`);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("X-TTS-Rate-Applied", "true");
        return res.send(audioBuffer);
      }
    } catch (err: any) {
      console.warn(`[TTS API] Microsoft Edge Neural TTS failed: ${err.message || err}, falling back to gtx proxy`);
      // Fallback proxy logic if Edge fails. Same rate caveat as the explicit gtx path above.
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=gtx&q=${encodeURIComponent(cleanText)}`;
      https.get(ttsUrl, { headers: { "User-Agent": "AndroidTranslate/7.16.0" } }, (proxyResponse) => {
        res.setHeader("Content-Type", proxyResponse.headers["content-type"] || "audio/mpeg");
        res.setHeader("X-TTS-Rate-Applied", "false");
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

// Models used to turn a spoken tutor turn into structured Japanese/Romaji/English.
// Override with TURN_ANALYSIS_MODELS="model-a,model-b" if the defaults are
// retired; the chain is tried in order and the first model that answers is
// reused for the rest of the process.
const TURN_ANALYSIS_MODELS = (process.env.TURN_ANALYSIS_MODELS || "gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite")
  .split(",")
  .map(m => m.trim())
  .filter(Boolean);

let workingAnalysisModel: string | null = null;

const HAS_JAPANESE_SCRIPT = /[぀-ヿ㐀-䶿一-鿿]/;
const HAS_KANJI = /[㐀-䶿一-鿿]/;

// NOTE: this deliberately does NOT use responseSchema. An earlier version
// added one (with a boolean field) and it was never actually verified against
// a live call - the only end-to-end confirmation this endpoint ever had was
// from the older, schema-less version. responseMimeType + a precisely
// specified prompt is the proven-working pattern; don't reintroduce a schema
// here without testing it against a real API key first.
async function analyzeTurnTranscript(ai: GoogleGenAI, transcriptText: string) {
  if (!transcriptText || transcriptText.trim().length < 5) return null;
  if (!HAS_JAPANESE_SCRIPT.test(transcriptText) && !/[a-z]{3}/i.test(transcriptText)) return null;

  const prompt = `You are a Japanese language analysis assistant. A live Japanese tutor just spoke the turn below to a beginner student. Extract the single Japanese phrase the student is meant to learn or respond to.

Spoken tutor turn: "${transcriptText}"

Return ONLY a JSON object with exactly these four string fields, nothing else:
{
  "japanese": "the target phrase in Kanji/Kana script only, e.g. お支払いはどうされますか？ - no English, no Romaji",
  "kana": "the full reading of the phrase in Hiragana only (no Kanji), one space between each word and particle, e.g. おしはらい は どう されます か",
  "romaji": "the complete Hepburn Romaji reading of the ENTIRE phrase, spaced by word, e.g. Oshiharai wa dou saremasu ka? - never truncate, never put English here",
  "english": "natural English translation of the Japanese phrase only, e.g. How will you be paying? - not a summary of the whole turn"
}

Rules:
- If the turn contains no Japanese phrase at all (pure English chatter), return all four fields as empty strings: "".
- If the turn contains several Japanese phrases, pick the one the tutor is actively teaching.
- "kana" and "romaji" must be complete readings of the WHOLE phrase in "japanese" — never partial, never English.`;

  const chain = workingAnalysisModel
    ? [workingAnalysisModel, ...TURN_ANALYSIS_MODELS.filter(m => m !== workingAnalysisModel)]
    : TURN_ANALYSIS_MODELS;

  for (const modelName of chain) {
    try {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0
        }
      });

      if (!result.text) continue;
      workingAnalysisModel = modelName;

      const parsed = JSON.parse(result.text);
      const japanese = (parsed.japanese || "").trim();

      if (!HAS_JAPANESE_SCRIPT.test(japanese)) {
        wsLog(`[TurnAnalysis] ${modelName}: no Japanese phrase in this turn`);
        return null;
      }

      const kana = (parsed.kana || "").trim();
      const romaji = (parsed.romaji || "").trim();
      const english = (parsed.english || "").trim();

      wsLog(`[TurnAnalysis] ${modelName} -> "${japanese}" / "${romaji}"`);
      return {
        japanese,
        // A "reading" that still contains Kanji is not a reading.
        kana: kana && !HAS_KANJI.test(kana) ? kana : "",
        // Romaji must be Latin script; the client re-validates it as well.
        romaji: romaji && !HAS_JAPANESE_SCRIPT.test(romaji) ? romaji : "",
        english: english && !HAS_JAPANESE_SCRIPT.test(english) ? english : ""
      };
    } catch (err: any) {
      wsLog(`[TurnAnalysis] Model ${modelName} failed: ${err.message || err}`);
    }
  }

  wsLog(`[TurnAnalysis] All models failed. Set TURN_ANALYSIS_MODELS to a model your API key can reach.`);
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
    const userVoice = urlParams.get('voice') || 'Charon';
    const requestedStyle = urlParams.get('style') || 'efficient';
    const userStyle = (['efficient', 'balanced', 'interactive'] as const).includes(requestedStyle as any)
      ? (requestedStyle as 'efficient' | 'balanced' | 'interactive')
      : 'efficient';
    
    // Use user-provided API Key or fallback to container's GEMINI_API_KEY env variable
    const apiKey = userApiKey && userApiKey.trim() !== "" && userApiKey !== "undefined" && userApiKey !== "null" ? userApiKey.trim() : (process.env.GEMINI_API_KEY || null);

    if (!apiKey) {
      wsLog("[Connection] Connection rejected: No API key available.");
      clientWs.close(4001, "Gemini API key is not configured. Please set your personal Gemini API Key in Settings.");
      return;
    }

    const getTutorPersona = (voice: string) => {
      switch (voice) {
        case 'Charon': return { name: 'Taro-sensei', gender: 'male', title: 'a deep, low-pitched male Japanese tutor with a warm baritone voice' };
        case 'Fenrir': return { name: 'Hiro-sensei', gender: 'male', title: 'an energetic male Japanese tutor' };
        case 'Puck': return { name: 'Ken-sensei', gender: 'male', title: 'an encouraging male Japanese tutor' };
        case 'Kore': return { name: 'Yuki-sensei', gender: 'female', title: 'a gentle female Japanese tutor' };
        case 'Aoede':
        default:
          return { name: 'Hana-sensei', gender: 'female', title: 'an encouraging female Japanese tutor' };
      }
    };

    const persona = getTutorPersona(userVoice);

    // Verbosity/interactivity only. Grading honesty (below) never changes with style -
    // a chattier tutor that also inflates praise would undo the point of being strict.
    const STYLE_INSTRUCTIONS: Record<typeof userStyle, string> = {
      efficient: `STYLE - Efficient. Every extra word costs the student time and money.
- Two short sentences per turn, maximum. One is usually enough.
- No filler: no "Great question", no repeating back what the student said, no recaps, no announcing what you are about to do.
- Never offer a menu of options or ask what the student would like to practise. You are the teacher: choose the next phrase yourself and teach it.`,
      balanced: `STYLE - Balanced. The student accepts a bit more length for a bit more context.
- Up to three or four sentences per turn. One extra sentence of "why" is welcome - a note on a particle, a quick cultural aside - but don't pad further.
- A little warmth is fine (a short "Nice!", brief encouragement) but don't repeat the student's words back to them or recap what already happened.
- Choose the next phrase yourself. Only ask what to practise if the student says something that genuinely calls for it.`,
      interactive: `STYLE - Interactive. The student has chosen a richer, more expensive lesson.
- Take the space you need: explain the grammar behind a phrase, give an extra example sentence, or ask a short follow-up question to keep the conversation going.
- Be warm and conversational, like a human tutor who has time to chat.
- Checking in occasionally ("Want a harder version?") is fine, but keep driving the lesson yourself - don't just wait on the student.`,
    };

    wsLog(`[Connection] Connecting to Gemini Live with API Key: ${apiKey.substring(0, 6)}... (Voice: ${userVoice}, Persona: ${persona.name}, Style: ${userStyle})`);

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
    let turnCounter = 0;

    const baseConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: userVoice } },
      },
      systemInstruction: `You are ${persona.name}, ${persona.title}, teaching a live 1-on-1 voice lesson to a beginner.

IDENTITY
- Your name is ${persona.name} and you are ${persona.gender}. Asked your name, say "My name is ${persona.name}." Never give any other name.
- Speak Japanese with ${persona.gender === 'male' ? 'masculine' : 'feminine'} phrasing.
${persona.name === 'Taro-sensei' ? '- Use a deep, low-pitched male baritone voice.\n' : ''}
SCOPE
- Teach only Japanese language and the active lesson scenario. Decline anything else in one short sentence, then continue the lesson.
- The student speaks only English and Japanese. Interpret all incoming audio as one of those two languages.
- Exception: the exact message "[STUDENT_INTERRUPT]" is a button press, not something the student said. It is never off-topic. On seeing it, stop mid-thought, reply with only "Go ahead." and wait silently for the student to speak.

${STYLE_INSTRUCTIONS[userStyle]}

LESSON LOOP
1. Say one Japanese phrase aloud, clearly, then give its English meaning. Always speak the actual Japanese words, never only the Romaji.
2. Say "Your turn." and stop talking. Wait for the student's attempt.
3. Grade the attempt, then either drill it again or move to the next phrase. You decide which; do not ask permission.

GRADING - the student has explicitly asked you to be strict.
- Begin every reply to an attempt with one word: "Good." or "Close." or "Not yet."
- "Good." is only for an attempt a native speaker would understand effortlessly. Never say perfect, excellent or great unless it truly was. Praising a flawed attempt fails the student and teaches them wrong Japanese.
- After "Close." or "Not yet.", name the single biggest error in a few words - the exact mora, vowel length, particle or word order - then say the phrase correctly once and have them try again.
- Do not move on to a new phrase until the student produces the current one correctly.`,
      // Without a language hint the ASR is free to guess any language for
      // ambiguous audio, and has been observed transcribing English speech as
      // Korean. The lesson is strictly English/Japanese, so constrain it.
      inputAudioTranscription: { languageHints: { languageCodes: ["en-US", "ja-JP"] } },
      outputAudioTranscription: { languageHints: { languageCodes: ["en-US", "ja-JP"] } },
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

          // Close the turn straight away so the message shows up immediately,
          // then patch it once the (slower) analysis model answers.
          const turnId = `${Date.now()}-${++turnCounter}`;
          clientWs.send(JSON.stringify({ turnComplete: true, turnId }));

          if (fullText) {
            analyzeTurnTranscript(ai, fullText)
              .then((turnAnalysis) => {
                if (turnAnalysis && clientWs.readyState === clientWs.OPEN) {
                  clientWs.send(JSON.stringify({ turnId, turnAnalysis }));
                }
              })
              .catch((err: any) => wsLog(`[TurnAnalysis] Unexpected failure: ${err?.message || err}`));
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
                parts: [{ text: "[STUDENT_INTERRUPT]" }]
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
