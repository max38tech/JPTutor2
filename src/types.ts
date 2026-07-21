/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  id: string;
  role: 'tutor' | 'user';
  japanese?: string;
  romaji?: string;
  english?: string;
  text?: string; // Raw input from user (text or voice-to-text)
  feedback?: string; // Grammar feedback on user speech
  timestamp: number;
}

export interface TopicSession {
  id: string;
  topic: string;
  messages: Message[];
  createdAt: number;
  lastActiveAt: number;
}

export interface Flashcard {
  id: string;
  japanese: string;
  romaji: string;
  english: string;
  topic: string;
  learned: boolean;
  createdAt: number;
}

export interface UserProgress {
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalConversations: number;
  totalFlashcards: number;
  xp: number;
  activityLog: Record<string, number>; // date string -> message count
}

export interface UserSettings {
  apiKey: string;
  theme: 'light' | 'dark' | 'system';
  voiceRate: number; // speed of TTS
  autoSpeak: boolean;
  voiceGender: 'female' | 'male' | 'natural';
  voiceURI?: string; // chosen WebSpeech API voice URI or name
  liveVoice?: string; // chosen Gemini Live AI voice (Aoede, Charon, Fenrir, Kore, Puck)
  customServerUrl?: string; // custom server URL for API & WebSockets
}

export interface SyncData {
  sessions: TopicSession[];
  flashcards: Flashcard[];
  progress: UserProgress;
  settings: UserSettings;
}
