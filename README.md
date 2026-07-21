# 🌸 Nihongo Voice Tutor (JP-Tutor)

<div align="center">
  <img src="docs/screenshots/app_icon.jpg" width="120" height="120" style="border-radius: 24px;" alt="JP Tutor Icon" />
  <h3>Real-Time Multimodal Voice AI Japanese Language Learning Platform</h3>
  <p>Interactive 1-on-1 Japanese voice lessons powered by Gemini Multimodal Live Audio & Microsoft Edge Neural TTS.</p>

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
  [![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite)](https://vitejs.dev/)
  [![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
  [![Capacitor](https://img.shields.io/badge/Capacitor-6.0-119EFF?logo=capacitor)](https://capacitorjs.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs)](https://nodejs.org/)
  [![Google Cloud Run](https://img.shields.io/badge/Deployed-Cloud_Run-4285F4?logo=googlecloud)](https://cloud.google.com/run)
</div>

---

## 📖 Overview

**Nihongo Voice Tutor (JP-Tutor)** is an advanced, real-time AI-powered language tutor designed to conduct spoken 1-on-1 Japanese lessons. Built on top of Google's **Gemini Multimodal Live Audio WebSocket API** and **Microsoft Edge Neural Speech**, the application allows students to engage in natural, zero-latency spoken conversations, receive immediate pronunciation feedback, explore custom scenarios, and build an interactive flashcard library automatically parsed from turn-by-turn dialogue.

---

## ✨ Key Features

- 🎙️ **Real-Time 1-on-1 Spoken Lessons**: Low-latency, full-duplex WebSocket streaming audio powered by `gemini-2.0-flash-exp` / `gemini-3.1-flash-live-preview`.
- 🧠 **Smart Turn Analysis & Parsing**: Intelligent post-turn transcript extraction into structured Japanese (Kanji/Kana), Romaji, and English translations.
- 🗣️ **Microsoft Edge Neural TTS (`ja-JP-NanamiNeural`)**: 24kHz HD Japanese speech synthesis for flashcard practice and vocabulary audio playback (100% free, zero quota limits).
- 🎴 **Interactive SRS Flashcards**: Clickable word segmentation, custom flashcard creation, and study deck reviews with flip animations.
- 🗂️ **Topic & Scenario Selection**: Pre-configured lessons (Ordering at a Restaurant, Asking Directions, Hotel Check-in) plus custom student-prompted scenarios.
- 🔄 **Multi-Device Data Syncing**: End-to-end PIN-encrypted cloud synchronization for flashcards and topic histories across Android, iOS, and Web.
- 📊 **Comprehensive Diagnostic Logging**: Built-in client and server log viewer with direct developer error reporting.

---

## 🖼️ Screenshots & App Gallery

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <b>Live Spoken Voice Tutor</b><br/><br/>
        <img src="docs/screenshots/voice_tutor_session.png" width="320" alt="Live Tutor Session"/>
      </td>
      <td align="center" width="50%">
        <b>Interactive Topics & Scenarios</b><br/><br/>
        <img src="docs/screenshots/topics_list.png" width="320" alt="Topics List"/>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <b>SRS Flashcard Practice</b><br/><br/>
        <img src="docs/screenshots/flashcards_practice.jpg" width="320" alt="Flashcards Practice"/>
      </td>
      <td align="center" width="50%">
        <b>Japanese Character & Audio Details</b><br/><br/>
        <img src="docs/screenshots/flashcards_card.jpg" width="320" alt="Flashcard Card Details"/>
      </td>
    </tr>
  </table>
</div>

---

## 🛠️ Architecture & Technology Stack

```
                     ┌────────────────────────────────────────────────────────┐
                     │            Capacitor 6 Android / iOS App               │
                     │                 React 18 + Vite SPA                    │
                     └──────────────────────────┬─────────────────────────────┘
                                                │
                                    (WebSocket / HTTP REST API)
                                                │
                                                ▼
                     ┌────────────────────────────────────────────────────────┐
                     │             Express Node.js Backend Gateway            │
                     │                 (Google Cloud Run)                     │
                     └─────────────┬────────────────────────────┬─────────────┘
                                   │                            │
                     (Bidirectional Realtime WS)       (High-Res 24kHz Neural TTS)
                                   │                            │
                                   ▼                            ▼
                     ┌──────────────────────────┐  ┌──────────────────────────┐
                     │ Gemini Live Audio Engine │  │ Microsoft Edge Speech    │
                     │  (Google AI Studio API)  │  │   (ja-JP-NanamiNeural)   │
                     └──────────────────────────┘  └──────────────────────────┘
```

### Technical Specs

| Component | Technology | Description |
|---|---|---|
| **Frontend UI** | React 18, Vite 6, Tailwind CSS, Lucide Icons | Responsive glassmorphism interface with dark mode and mobile frames |
| **Mobile Native** | Capacitor 6, Android SDK 34+, iOS SPM | Native webview wrapper for Android APK & iOS IPA deployment |
| **Backend Service** | Express 4.x, Node.js 22.x, `ws` WebSocket | Express server hosted on Google Cloud Run with containerized Docker build |
| **Voice AI Engine** | Google GenAI Multimodal Live API | Low-latency WebSockets streaming PCM 16kHz audio in / 24kHz out |
| **Speech Synthesizer** | `node-edge-tts` (Microsoft Edge Neural) | `ja-JP-NanamiNeural` 24kHz HD MP3 voice generation |
| **Cloud Sync** | PIN-authenticated JSON Data Store | Encrypted device-to-device sync endpoint (`/api/sync`) |

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js 20.x or 22.x
- Google AI Studio API Key (for Gemini Live Audio)

### 1. Local Development Setup

```bash
# Clone repository
git clone https://github.com/max38tech/jptutor.git
cd jptutor

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
```

Set your Gemini API key in `.env`:
```env
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
PORT=3000
```

Start the combined dev server and backend:
```bash
npm run dev
```

Visit `http://localhost:3000` in your web browser.

---

### 2. Native Android APK Build

```bash
# Build production web bundle
npx vite build

# Sync web assets to Capacitor Android project
npx cap sync android

# Compile Android Debug APK
cd android
.\gradlew.bat assembleDebug
```

The compiled APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

### 3. Containerized Deployment (Google Cloud Run / Docker)

Build and run locally with Docker:
```bash
docker build -t jp-tutor-backend .
docker run -p 3000:3000 -e GEMINI_API_KEY="AIzaSy..." jp-tutor-backend
```

Deploy to Google Cloud Run:
```bash
gcloud run deploy jp-tutor-backend \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated
```

---

## 📚 User Documentation

For complete usage instructions, feature guides, and troubleshooting steps, please refer to our dedicated documentation:

📄 **[Comprehensive User Manual & Operating Guide](docs/USER_MANUAL.md)**  
🌐 **[Interactive Web User Manual (HTML)](docs/USER_MANUAL.html)**

---

## 📜 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.