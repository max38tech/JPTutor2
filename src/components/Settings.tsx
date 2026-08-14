/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserSettings, SyncData } from '../types';
import { 
  Key, 
  Settings as SettingsIcon, 
  Sliders, 
  Volume2, 
  RefreshCw, 
  Smartphone, 
  Check, 
  Trash2, 
  Eye, 
  EyeOff, 
  Info,
  Sun,
  Moon,
  Monitor,
  AlertCircle,
  Globe,
  Bug,
  Lightbulb
} from 'lucide-react';
import { motion } from 'motion/react';
import { getServerBaseUrl } from '../utils/api';
import { speakJapanese } from '../utils/speak';

const TUTOR_STYLES: {
  id: 'efficient' | 'balanced' | 'interactive';
  label: string;
  description: string;
  costLabel: string;
  costClass: string;
}[] = [
  {
    id: 'efficient',
    label: 'Efficient',
    description: 'Short replies, strict grading, moves fast. The default.',
    costLabel: 'Lowest cost',
    costClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'A bit more context and warmth alongside the same strict grading. Roughly 1.5-2x the reply length of Efficient.',
    costLabel: 'Moderate cost',
    costClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  },
  {
    id: 'interactive',
    label: 'Interactive',
    description: 'Fuller explanations, example sentences, and back-and-forth conversation. Can be 3x+ the reply length of Efficient.',
    costLabel: 'Highest cost',
    costClass: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  },
];

interface SettingsProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  onSyncTrigger: (action: 'upload' | 'download', code: string) => Promise<SyncData | null>;
  onClearAllData: () => void;
  onOpenLogs: () => void;
  onOpenReport: (mode: 'bug' | 'feature') => void;
}

export default function Settings({
  settings,
  onUpdateSettings,
  onSyncTrigger,
  onClearAllData,
  onOpenLogs,
  onOpenReport,
}: SettingsProps) {
  const [showKey, setShowKey] = useState(false);
  const [syncCode, setSyncCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'loading'; msg?: string }>({ type: 'idle' });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [localApiKey, setLocalApiKey] = useState(settings.apiKey);
  const [isSaved, setIsSaved] = useState(false);

  // Custom Backend Server state
  const [localServerUrl, setLocalServerUrl] = useState(settings.customServerUrl || '');
  const [isServerUrlSaved, setIsServerUrlSaved] = useState(false);

  useEffect(() => {
    setLocalApiKey(settings.apiKey);
  }, [settings.apiKey]);

  useEffect(() => {
    setLocalServerUrl(settings.customServerUrl || '');
  }, [settings.customServerUrl]);

  const handleSaveApiKey = () => {
    onUpdateSettings({ ...settings, apiKey: localApiKey.trim() });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSaveServerUrl = () => {
    onUpdateSettings({ ...settings, customServerUrl: localServerUrl.trim() });
    setIsServerUrlSaved(true);
    setTimeout(() => setIsServerUrlSaved(false), 3000);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const jaVoices = allVoices.filter(v => 
        v.lang.toLowerCase().includes('ja-jp') || 
        v.lang.toLowerCase().startsWith('ja')
      );
      setAvailableVoices(jaVoices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ ...settings, voiceURI: e.target.value });
  };

  const handleLiveVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ ...settings, liveVoice: e.target.value });
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    onUpdateSettings({ ...settings, voiceRate: rate });
  };

  const handleToggleAutoSpeak = () => {
    onUpdateSettings({ ...settings, autoSpeak: !settings.autoSpeak });
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    onUpdateSettings({ ...settings, theme });
    // Root class is updated in App.tsx
  };

  // Sync helpers
  const handleGenerateCode = async () => {
    setSyncStatus({ type: 'loading' });
    try {
      const res = await fetch(`${getServerBaseUrl()}/api/sync/new-code`);
      const data = await res.json();
      setGeneratedCode(data.syncCode);
      setSyncStatus({ type: 'idle' });
    } catch (e) {
      setSyncStatus({ type: 'error', msg: 'Failed to generate sync code.' });
    }
  };

  const handleUpload = async () => {
    if (!generatedCode) return;
    setSyncStatus({ type: 'loading' });
    try {
      await onSyncTrigger('upload', generatedCode);
      setSyncStatus({ type: 'success', msg: 'Device data successfully synced to Cloud!' });
    } catch (e: any) {
      setSyncStatus({ type: 'error', msg: e.message || 'Cloud backup failed.' });
    }
  };

  const handleDownload = async () => {
    const codeToUse = syncCode.trim().toUpperCase();
    if (!codeToUse) return;
    setSyncStatus({ type: 'loading' });
    try {
      const result = await onSyncTrigger('download', codeToUse);
      if (result) {
        setSyncStatus({ type: 'success', msg: 'Synced successfully! Retrieved sessions & flashcards.' });
        setSyncCode('');
      } else {
        setSyncStatus({ type: 'error', msg: 'No sync data found or server issue.' });
      }
    } catch (e: any) {
      setSyncStatus({ type: 'error', msg: e.message || 'Download sync failed.' });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden px-5 py-6 space-y-6">
      
      {/* View Header */}
      <div className="space-y-1 shrink-0">
        <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-slate-50">
          Tutor Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure API credentials, audio synthesis voice, and cross-device syncing.
        </p>
      </div>

      {/* Main Settings Panel */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 no-scrollbar text-xs">

        {/* 1. API Key Setup */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-300" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Gemini API Authorization
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
            A personal Gemini API Key is required to practice with the Japanese language tutor. Enter your key below to activate all features of the application.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={localApiKey}
                onChange={(e) => {
                  setLocalApiKey(e.target.value);
                  setIsSaved(false);
                }}
                placeholder="Enter Gemini API Key (e.g. AIzaSy...)"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveApiKey}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
              {isSaved ? 'Saved!' : 'Save Key'}
            </button>
          </div>
          {isSaved && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1 animate-in fade-in duration-200">
              <Check className="w-3.5 h-3.5 text-emerald-500" /> API Key saved and activated successfully!
            </p>
          )}
        </div>

        {/* 2. Text to Speech Slider */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-300" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Voice & Audio Settings
            </h3>
          </div>
          
          {/* Auto speak toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Auto-Speak Dialogue
              </span>
              <p className="text-[10px] text-slate-400">
                Read tutor replies automatically when they generate
              </p>
            </div>
            
            <button
              onClick={handleToggleAutoSpeak}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${
                settings.autoSpeak ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                settings.autoSpeak ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {/* Voice Selection Dropdown */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-300">Tutor Voice Accent</span>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-300 font-bold font-mono">
                {availableVoices.length} detected
              </span>
            </div>
            {availableVoices.length === 0 ? (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                Using system default Japanese voice. (Connect to the internet or check device settings to load additional TTS voices).
              </p>
            ) : (
              <select
                value={settings.voiceURI || ''}
                onChange={handleVoiceChange}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold text-xs cursor-pointer"
              >
                <option value="">System Default Japanese Voice</option>
                {availableVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} {voice.localService ? '(On-Device)' : '(Cloud)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Gemini Live AI Voice Selection Dropdown */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-300">Live Practice Voice & Persona</span>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-300 font-bold font-mono">
                Gemini Live API
              </span>
            </div>
            <select
              value={settings.liveVoice || 'Aoede'}
              onChange={handleLiveVoiceChange}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold text-xs cursor-pointer"
            >
              <optgroup label="Featured">
                <option value="Aoede">Aoede (Hana-sensei - Clear Female)</option>
                <option value="Kore">Kore (Yuki-sensei - Soft Female)</option>
                <option value="Puck">Puck (Ken-sensei - Friendly Male)</option>
                <option value="Fenrir">Fenrir (Hiro-sensei - Energetic Male)</option>
                <option value="Charon">Charon (Taro-sensei - Deep Male)</option>
              </optgroup>
              <optgroup label="More Voices">
                <option value="Achernar">Achernar (Mei-sensei - Soft Female)</option>
                <option value="Achird">Achird (Sora-sensei - Friendly Male)</option>
                <option value="Algenib">Algenib (Ryo-sensei - Gravelly Male)</option>
                <option value="Algieba">Algieba (Daiki-sensei - Smooth Male)</option>
                <option value="Alnilam">Alnilam (Kaito-sensei - Firm Male)</option>
                <option value="Autonoe">Autonoe (Sakura-sensei - Bright Female)</option>
                <option value="Callirrhoe">Callirrhoe (Yui-sensei - Easy-going Female)</option>
                <option value="Despina">Despina (Nana-sensei - Smooth Female)</option>
                <option value="Enceladus">Enceladus (Kai-sensei - Breathy)</option>
                <option value="Erinome">Erinome (Akari-sensei - Clear Female)</option>
                <option value="Gacrux">Gacrux (Rin-sensei - Mature Female)</option>
                <option value="Iapetus">Iapetus (Shun-sensei - Clear Male)</option>
                <option value="Laomedeia">Laomedeia (Miku-sensei - Upbeat Female)</option>
                <option value="Leda">Leda (Emi-sensei - Youthful Female)</option>
                <option value="Orus">Orus (Takumi-sensei - Firm Male)</option>
                <option value="Pulcherrima">Pulcherrima (Nozomi-sensei - Forward Female)</option>
                <option value="Rasalgethi">Rasalgethi (Kenji-sensei - Informative Male)</option>
                <option value="Sadachbia">Sadachbia (Ren-sensei - Lively Male)</option>
                <option value="Sadaltager">Sadaltager (Yuto-sensei - Knowledgeable Male)</option>
                <option value="Schedar">Schedar (Sota-sensei - Even Male)</option>
                <option value="Sulafat">Sulafat (Aya-sensei - Warm Female)</option>
                <option value="Umbriel">Umbriel (Riku-sensei - Easy-going Male)</option>
                <option value="Vindemiatrix">Vindemiatrix (Riko-sensei - Gentle Female)</option>
                <option value="Zephyr">Zephyr (Sayuri-sensei - Bright Female)</option>
                <option value="Zubenelgenubi">Zubenelgenubi (Jin-sensei - Casual Male)</option>
              </optgroup>
            </select>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Gender for the Featured voices is deliberate; for the rest it's a best-effort guess from third-party sources. If one sounds off, let us know via Report Bug and we'll fix the label.
            </p>
          </div>

          {/* Tutor Style Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-700 dark:text-slate-300">Tutor Style</span>
            <div className="space-y-2">
              {TUTOR_STYLES.map((style) => {
                const isActive = (settings.tutorStyle || 'efficient') === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, tutorStyle: style.id })}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold text-xs ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {style.label}
                      </span>
                      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${style.costClass}`}>
                        {style.costLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {style.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Grading stays just as strict in every style — only the tutor's reply length and chattiness change.
            </p>
          </div>

          {/* Voice rate speed slider - kept directly above the voice picker
              below since both settings control the same Flashcards & Log
              audio and belong together. */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="font-bold">Flashcards & Log Audio Speed</span>
              <span className="font-mono font-bold text-indigo-500 dark:text-indigo-300">{settings.voiceRate}x</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-1">
              Only affects Flashcards & Log playback. Live tutor audio always plays at natural speed.
            </p>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.voiceRate}
              onChange={handleRateChange}
              className="w-full accent-indigo-600 cursor-pointer bg-slate-100 dark:bg-slate-800 rounded-lg h-2"
            />
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>Slower</span>
              <span>Default (1.0x)</span>
              <span>Faster</span>
            </div>
          </div>

          {/* Card & Log Speech Voice Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-300">Flashcards & Log Audio Voice</span>
              <button
                type="button"
                onClick={() => {
                  speakJapanese(
                    "こんにちは。日本語の練習をはじめましょう！", 
                    settings.voiceRate, 
                    settings.voiceURI, 
                    settings.apiKey, 
                    settings.cardVoice || 'ja-JP-NanamiNeural'
                  );
                }}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-lg transition-all text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-indigo-100 dark:border-slate-700 active:scale-95"
                title="Test current card voice audio"
              >
                <Volume2 className="w-3 h-3" />
                Test Voice
              </button>
            </div>
            <select
              value={settings.cardVoice || 'ja-JP-NanamiNeural'}
              onChange={(e) => onUpdateSettings({ ...settings, cardVoice: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold text-xs cursor-pointer"
            >
              <option value="ja-JP-NanamiNeural">Nanami (Natural Female - Edge HD)</option>
              <option value="ja-JP-KeitaNeural">Keita (Natural Male - Edge HD)</option>
              <option value="gtx">Hana (Google Mobile HD Voice)</option>
            </select>
          </div>
        </div>

        {/* 3. Theme Configuration Selection */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-3.5">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            App theme
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((mode) => {
              const isActive = settings.theme === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleThemeChange(mode)}
                  className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition-all capitalize cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200/60 dark:border-slate-800/60 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode === 'light' && <Sun className="w-4 h-4" />}
                  {mode === 'dark' && <Moon className="w-4 h-4" />}
                  {mode === 'system' && <Monitor className="w-4 h-4" />}
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Cross-Device Syncing Panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-300" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Sync Data Across Devices
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Generate a secure sync code on this device to backup your dialogue history and flashcards to the cloud, or enter a code to retrieve progress.
          </p>

          {/* Sync status alert */}
          {syncStatus.type !== 'idle' && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 ${
              syncStatus.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                : syncStatus.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 text-slate-500'
            }`}>
              {syncStatus.type === 'loading' ? (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{syncStatus.msg || 'Processing Sync...'}</span>
            </div>
          )}

          {/* SECTION A: Generate Code and Upload */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                1. Back Up This Device
              </span>
              <button
                onClick={handleGenerateCode}
                className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline font-bold cursor-pointer"
              >
                {generatedCode ? 'Generate New PIN' : 'Get Sync PIN'}
              </button>
            </div>

            {generatedCode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 text-center text-sm font-mono font-extrabold text-slate-800 dark:text-white rounded-lg select-all">
                    {generatedCode}
                  </div>
                  <button
                    onClick={handleUpload}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Upload Data
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Copy this PIN and input it on your other iOS/Android device to sync.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Click "Get Sync PIN" to generate a secure PIN and back up this device to our server.
              </p>
            )}
          </div>

          {/* SECTION B: Input code and pull/download */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-3">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">
              2. Download from Sync Code
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Sync PIN (e.g. JP-A3D9X)..."
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 font-mono text-center text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
              />
              <button
                onClick={handleDownload}
                disabled={!syncCode.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
              >
                Sync Down
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Caution: Pulling sync data from another device will merge with your local logs. Duplicates are resolved seamlessly.
            </p>
          </div>
        </div>

        {/* 4.2 Custom Backend Server URL */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-300" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Backend Server Endpoint
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
            To test your build on standard mobile devices or release it to the market, set your custom backend Express + WebSocket server URL below.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={localServerUrl}
              onChange={(e) => {
                setLocalServerUrl(e.target.value);
                setIsServerUrlSaved(false);
              }}
              placeholder="https://jp-tutor-backend-638340504989.asia-east1.run.app"
              className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono text-xs"
            />
            <button
              onClick={handleSaveServerUrl}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              {isServerUrlSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
              {isServerUrlSaved ? 'Saved!' : 'Save URL'}
            </button>
          </div>
          <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-900/30 rounded-xl text-[10px] text-slate-500 dark:text-slate-400 leading-normal space-y-1">
            <span className="font-bold text-indigo-600 dark:text-indigo-300">💡 Backend Service URL:</span>
            <p>
              Default production backend server URL:
            </p>
            <p className="font-mono bg-white dark:bg-slate-950 p-1 border border-indigo-100 dark:border-indigo-900 select-all rounded text-[9px] text-indigo-600 dark:text-indigo-300">
              https://jp-tutor-backend-638340504989.asia-east1.run.app
            </p>
          </div>
        </div>

        {/* 4.5 Diagnostics & Logs */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-300" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              App Logs & Diagnostics
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
            Troubleshoot device-specific issues like microphone capture, audio playback, network synchronization, or WebSocket connectivity errors.
          </p>
          <button
            onClick={onOpenLogs}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <AlertCircle className="w-4 h-4" />
            View Diagnostics Logs
          </button>
        </div>

        {/* 4.6 Feedback: bug reports & feature requests */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-300" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Feedback
            </h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
            Found something broken, or have an idea for the app? Let us know directly.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenReport('bug')}
              className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Bug className="w-4 h-4" />
              Report Bug
            </button>
            <button
              onClick={() => onOpenReport('feature')}
              className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Lightbulb className="w-4 h-4" />
              Feature Idea
            </button>
          </div>
        </div>

        {/* 5. Clear application data button */}
        <div className="p-4 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-bold text-rose-800 dark:text-rose-400 text-sm block">
              Danger Zone
            </span>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-500/80 leading-relaxed">
              Permanently clear all saved dialogues and flashcards.
            </p>
          </div>
          
          <button
            onClick={onClearAllData}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset App
          </button>
        </div>

      </div>

    </div>
  );
}
