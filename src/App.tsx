/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TopicSession, Flashcard, UserProgress, UserSettings, SyncData } from './types';
import MobileFrame from './components/MobileFrame';
import VoiceTutor from './components/VoiceTutor';
import TopicsList from './components/TopicsList';
import Flashcards from './components/Flashcards';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import LogsModal from './components/LogsModal';
import { getServerBaseUrl } from './utils/api';

import { 
  MessageSquare, 
  BookOpen, 
  Layers, 
  BarChart3, 
  Settings as SettingsIcon 
} from 'lucide-react';

const LOCAL_STORAGE_SESSIONS_KEY = 'nihongo_tutor_sessions';
const LOCAL_STORAGE_FLASHCARDS_KEY = 'nihongo_tutor_flashcards';
const LOCAL_STORAGE_PROGRESS_KEY = 'nihongo_tutor_progress';
const LOCAL_STORAGE_SETTINGS_KEY = 'nihongo_tutor_settings';

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  theme: 'system',
  voiceRate: 0.75,
  autoSpeak: true,
  voiceGender: 'natural',
  voiceURI: '',
  liveVoice: 'Aoede',
  cardVoice: 'ja-JP-NanamiNeural',
  customServerUrl: 'https://jp-tutor-backend-638340504989.asia-east1.run.app',
};

const DEFAULT_PROGRESS: UserProgress = {
  streak: 0,
  lastActiveDate: '',
  totalConversations: 0,
  totalFlashcards: 0,
  xp: 0,
  activityLog: {},
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'practice' | 'topics' | 'cards' | 'dashboard' | 'settings'>('practice');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Core application states
  const [sessions, setSessions] = useState<TopicSession[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
      if (storedSessions) setSessions(JSON.parse(storedSessions));

      const storedFlashcards = localStorage.getItem(LOCAL_STORAGE_FLASHCARDS_KEY);
      if (storedFlashcards) setFlashcards(JSON.parse(storedFlashcards));

      const storedProgress = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
      if (storedProgress) setProgress(JSON.parse(storedProgress));

      const storedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (storedSettings) setSettings(JSON.parse(storedSettings));
    } catch (e) {
      console.error('Error loading data from localStorage', e);
    }
  }, []);

  // Sync to local storage on adjustments
  const handleUpdateSessions = (updated: TopicSession[]) => {
    setSessions(updated);
    localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(updated));
  };

  const handleUpdateFlashcards = (updated: Flashcard[]) => {
    setFlashcards(updated);
    localStorage.setItem(LOCAL_STORAGE_FLASHCARDS_KEY, JSON.stringify(updated));
  };

  const handleUpdateProgress = (updated: UserProgress) => {
    setProgress(updated);
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(updated));
  };

  const handleUpdateSettings = (updated: UserSettings) => {
    setSettings(updated);
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updated));
  };

  // Manage Dark / Light theme detecting system setting
  useEffect(() => {
    const handleThemeClass = () => {
      const isDarkTheme = 
        settings.theme === 'dark' || 
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDarkTheme) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    handleThemeClass();

    // Listen for system theme modifications if set to 'system'
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => handleThemeClass();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  // Sync / Upload / Download handler to trigger server endpoints
  const handleSyncTrigger = async (action: 'upload' | 'download', code: string): Promise<SyncData | null> => {
    if (action === 'upload') {
      const syncDataPayload: SyncData = {
        sessions,
        flashcards,
        progress,
        settings,
      };

      const res = await fetch(`${getServerBaseUrl()}/api/sync/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncCode: code,
          syncData: syncDataPayload,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to back up your data to the cloud.');
      }
      return null;
    } else {
      // Download
      const res = await fetch(`${getServerBaseUrl()}/api/sync/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode: code }),
      });

      if (!res.ok) {
        const errorMsg = await res.json();
        throw new Error(errorMsg.error || 'Invalid sync PIN or server issue.');
      }

      const { syncData } = await res.json();
      if (syncData) {
        // Merge downloaded sessions (by matching id)
        const mergedSessions = [...sessions];
        (syncData.sessions || []).forEach((dlSession: TopicSession) => {
          if (!mergedSessions.some(s => s.id === dlSession.id)) {
            mergedSessions.push(dlSession);
          }
        });

        // Merge downloaded flashcards
        const mergedFlashcards = [...flashcards];
        (syncData.flashcards || []).forEach((dlCard: Flashcard) => {
          if (!mergedFlashcards.some(fc => fc.id === dlCard.id)) {
            mergedFlashcards.push(dlCard);
          }
        });

        // Merge Progress XP and streak
        const dlProgress = syncData.progress || DEFAULT_PROGRESS;
        const mergedProgress: UserProgress = {
          streak: Math.max(progress.streak, dlProgress.streak),
          lastActiveDate: progress.lastActiveDate || dlProgress.lastActiveDate,
          totalConversations: Math.max(progress.totalConversations, dlProgress.totalConversations),
          totalFlashcards: Math.max(progress.totalFlashcards, dlProgress.totalFlashcards),
          xp: Math.max(progress.xp, dlProgress.xp),
          activityLog: { ...dlProgress.activityLog, ...progress.activityLog }, // merge activity calendar logs
        };

        // Merge API settings if empty
        const dlSettings = syncData.settings || DEFAULT_SETTINGS;
        const mergedSettings: UserSettings = {
          ...settings,
          apiKey: settings.apiKey || dlSettings.apiKey,
        };

        // Save
        handleUpdateSessions(mergedSessions);
        handleUpdateFlashcards(mergedFlashcards);
        handleUpdateProgress(mergedProgress);
        handleUpdateSettings(mergedSettings);

        return syncData;
      }
      return null;
    }
  };

  const handleClearAllData = () => {
    if (confirm("This will permanently clear all of your sessions, flashcards, settings, and progress metrics. Are you absolutely sure?")) {
      setSessions([]);
      setFlashcards([]);
      setProgress(DEFAULT_PROGRESS);
      setSettings(DEFAULT_SETTINGS);
      localStorage.clear();
      setActiveTab('practice');
      setActiveSessionId(null);
    }
  };

  // Switch specifically back to tabs from subcomponents
  const handleSwitchTabFromDashboard = (tab: 'practice' | 'topics' | 'cards') => {
    setActiveTab(tab);
  };

  return (
    <MobileFrame isConnected={isLiveConnected}>
      
      {/* 1. VIEW SCREEN ACCORDING TO ACTIVE TAB */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'practice' && (
          <VoiceTutor
            settings={settings}
            progress={progress}
            sessions={sessions}
            flashcards={flashcards}
            activeSessionId={activeSessionId}
            onUpdateSessions={handleUpdateSessions}
            onUpdateFlashcards={handleUpdateFlashcards}
            onUpdateProgress={handleUpdateProgress}
            onSetActiveSessionId={setActiveSessionId}
            onOpenLogs={() => setIsLogsOpen(true)}
            onConnectionStatusChange={setIsLiveConnected}
          />
        )}

        {activeTab === 'topics' && (
          <TopicsList
            sessions={sessions}
            flashcards={flashcards}
            progress={progress}
            settings={settings}
            onSetActiveSessionId={setActiveSessionId}
            onUpdateSessions={handleUpdateSessions}
            onUpdateFlashcards={handleUpdateFlashcards}
            onUpdateProgress={handleUpdateProgress}
            onSwitchToPractice={() => setActiveTab('practice')}
          />
        )}

        {activeTab === 'cards' && (
          <Flashcards
            flashcards={flashcards}
            settings={settings}
            onUpdateFlashcards={handleUpdateFlashcards}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            progress={progress}
            flashcards={flashcards}
            sessions={sessions}
            onSwitchToTab={handleSwitchTabFromDashboard}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onSyncTrigger={handleSyncTrigger}
            onClearAllData={handleClearAllData}
            onOpenLogs={() => setIsLogsOpen(true)}
          />
        )}
      </div>

      {/* 2. PREMIUM BOTTOM TAB BAR */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/80 px-4 py-2 flex items-center justify-between shrink-0 select-none shadow-md z-10">
        
        {/* Practice tab */}
        <button
          onClick={() => setActiveTab('practice')}
          className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === 'practice' 
              ? 'text-indigo-600 dark:text-indigo-300 font-bold' 
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Practice</span>
        </button>

        {/* Discussed Topics tab */}
        <button
          onClick={() => setActiveTab('topics')}
          className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer relative ${
            activeTab === 'topics' 
              ? 'text-indigo-600 dark:text-indigo-300 font-bold' 
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Topics</span>
          {sessions.length > 0 && (
            <span className="absolute top-1 right-5 bg-indigo-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono">
              {sessions.length}
            </span>
          )}
        </button>

        {/* Flashcards tab */}
        <button
          onClick={() => setActiveTab('cards')}
          className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer relative ${
            activeTab === 'cards' 
              ? 'text-indigo-600 dark:text-indigo-300 font-bold' 
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Cards</span>
          {flashcards.filter(fc => !fc.learned).length > 0 && (
            <span className="absolute top-1 right-5 bg-indigo-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold font-mono">
              {flashcards.filter(fc => !fc.learned).length}
            </span>
          )}
        </button>

        {/* Stats Dashboard tab */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'text-indigo-600 dark:text-indigo-300 font-bold' 
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Progress</span>
        </button>

        {/* Settings tab */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer ${
            activeTab === 'settings' 
              ? 'text-indigo-600 dark:text-indigo-300 font-bold' 
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Settings</span>
        </button>

      </div>

      {/* System Logs Diagnostic Modal overlay */}
      <LogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />

    </MobileFrame>
  );
}
