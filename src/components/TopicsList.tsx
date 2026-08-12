/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TopicSession, Flashcard, UserProgress, Message, UserSettings } from '../types';
import { 
  MessageCircle, 
  Clock, 
  Trash2, 
  ArrowRight, 
  BookOpen, 
  ArrowLeft, 
  Bookmark, 
  Plus, 
  X, 
  Sparkles,
  Check,
  Volume2
} from 'lucide-react';
import { speakJapanese } from '../utils/speak';
import { segmentJapanese } from '../utils/transcript';

interface TopicsListProps {
  sessions: TopicSession[];
  flashcards: Flashcard[];
  progress: UserProgress;
  settings: UserSettings;
  onSetActiveSessionId: (id: string | null) => void;
  onUpdateSessions: (sessions: TopicSession[]) => void;
  onUpdateFlashcards: (flashcards: Flashcard[]) => void;
  onUpdateProgress: (progress: UserProgress) => void;
  onSwitchToPractice: () => void;
}

export default function TopicsList({
  sessions,
  flashcards,
  progress,
  settings,
  onSetActiveSessionId,
  onUpdateSessions,
  onUpdateFlashcards,
  onUpdateProgress,
  onSwitchToPractice,
}: TopicsListProps) {
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  // Flashcard creation modal states
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [modalJapanese, setModalJapanese] = useState('');
  const [modalRomaji, setModalRomaji] = useState('');
  const [modalEnglish, setModalEnglish] = useState('');

  const currentViewingSession = sessions.find(s => s.id === viewingSessionId);

  const handleResumeSession = (id: string) => {
    onSetActiveSessionId(id);
    onSwitchToPractice(); // Switch tab back to active conversation screen
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this topic discussion? All logs will be deleted.")) {
      const updated = sessions.filter(s => s.id !== id);
      onUpdateSessions(updated);
      if (viewingSessionId === id) {
        setViewingSessionId(null);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Toggle saving full tutor message to flashcards
  const handleSaveToFlashcards = (japanese: string, romaji: string, english: string, topicName: string) => {
    const trimmedJap = japanese.trim();
    if (flashcards.some(fc => fc.japanese.trim() === trimmedJap)) {
      // Remove card
      const updated = flashcards.filter(fc => fc.japanese.trim() !== trimmedJap);
      onUpdateFlashcards(updated);
      return;
    }

    const newCard: Flashcard = {
      id: `fc-logs-${Date.now()}`,
      japanese: trimmedJap,
      romaji: romaji.trim(),
      english: english.trim() || 'Meaning',
      topic: topicName || 'Conversation Log',
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
      id: `fc-logs-word-${Date.now()}`,
      japanese: modalJapanese.trim(),
      romaji: modalRomaji.trim(),
      english: modalEnglish.trim() || 'Meaning',
      topic: currentViewingSession ? currentViewingSession.topic : 'Conversation Log',
      learned: false,
      createdAt: Date.now()
    };

    onUpdateFlashcards([newCard, ...flashcards]);
    setShowAddCardModal(false);
    setModalJapanese('');
    setModalRomaji('');
    setModalEnglish('');

    // Reward XP
    const updatedProgress = {
      ...progress,
      xp: progress.xp + 5,
      totalFlashcards: progress.totalFlashcards + 1,
    };
    onUpdateProgress(updatedProgress);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      
      {/* =====================================
          VIEW 1: TOPIC REVIEWS LIST
          ===================================== */}
      {!viewingSessionId && (
        <div className="flex flex-col h-full overflow-hidden px-5 py-6 space-y-6">
          <div className="space-y-1 shrink-0">
            <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-slate-50">
              Discussed Topics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review your past tutor dialogues, tracking vocabulary and feedback.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-300 rounded-full">
                  <MessageCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-[260px]">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    No Discussions Yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Choose a conversation topic on the Practice tab to begin your learning journey.
                  </p>
                </div>
                <button
                  onClick={onSwitchToPractice}
                  className="mt-2 text-xs px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-colors cursor-pointer"
                >
                  Start New Topic
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const messagesCount = session.messages.length;
                  const lastMessage = session.messages[0];
                  const displaySnippet = lastMessage 
                    ? (lastMessage.role === 'tutor' ? lastMessage.japanese : lastMessage.text)
                    : 'No conversations exchanged yet.';

                  return (
                    <div
                      key={session.id}
                      onClick={() => setViewingSessionId(session.id)}
                      className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-900/60 transition-all shadow-xs cursor-pointer group flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-lg">
                              <BookOpen className="w-4 h-4" />
                            </span>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                              {session.topic}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {messagesCount} exchange{messagesCount !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(session.lastActiveAt)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* snippet */}
                      <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1 flex-1 font-sans">
                          "{displaySnippet}"
                        </p>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold shrink-0 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                          View logs
                          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================
          VIEW 2: CONVERSATION HISTORY LOGS BROWSER
          ===================================== */}
      {viewingSessionId && currentViewingSession && (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-950/10">
          
          {/* Header */}
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between shrink-0 shadow-xs z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewingSessionId(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Dialogue History
                </span>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                  {currentViewingSession.topic}
                </h2>
              </div>
            </div>
            
            <button
              onClick={() => handleResumeSession(currentViewingSession.id)}
              className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full font-bold border border-indigo-100 dark:border-indigo-900/40 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <Sparkles className="w-3 h-3" />
              Practice Again
            </button>
          </div>

          {/* Quick instructions bar */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 px-4 py-2 border-b border-indigo-100/40 dark:border-indigo-950/40 shrink-0 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <p className="text-[10px] text-indigo-700/90 dark:text-indigo-300 leading-snug">
              <strong>Tip:</strong> Tap any underlined Japanese word/segment below to edit and save it as a custom flashcard, or bookmark the whole phrase!
            </p>
          </div>

          {/* Log messages scroll space */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 no-scrollbar">
            {currentViewingSession.messages.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
                <MessageCircle className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs">No dialogue exchanged in this session yet.</p>
              </div>
            ) : (
              [...currentViewingSession.messages].reverse().map((msg: Message) => (
                <div 
                  key={msg.id} 
                  className={`w-full p-4 rounded-2xl shadow-xs border flex flex-col gap-2 ${
                    msg.role === 'user' 
                      ? "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-100/70 dark:border-indigo-900/40 ml-auto" 
                      : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 mr-auto"
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
                          onClick={() => handleSaveToFlashcards(msg.japanese!, msg.romaji || '', msg.english || '', currentViewingSession.topic)}
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
                      {/* Segmented clickable Japanese text */}
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
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed select-text">
                      {msg.text}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================
          MODAL: ADD CUSTOM CARD
          ===================================== */}
      {showAddCardModal && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-6 z-40 select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
                Create Flashcard
              </h3>
              <button
                onClick={() => setShowAddCardModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomCard} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 block">
                  Japanese Word / Phrase
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
                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Save to Flashcards
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
