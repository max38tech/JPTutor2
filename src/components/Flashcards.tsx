/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Flashcard, UserSettings } from '../types';
import { 
  Sparkles, 
  Layers, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Bookmark,
  Shuffle,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { speakJapanese } from '../utils/speak';

interface FlashcardsProps {
  flashcards: Flashcard[];
  settings: UserSettings;
  onUpdateFlashcards: (cards: Flashcard[]) => void;
}

export default function Flashcards({
  flashcards,
  settings,
  onUpdateFlashcards,
}: FlashcardsProps) {
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [newJapanese, setNewJapanese] = useState('');
  const [newRomaji, setNewRomaji] = useState('');
  const [newEnglish, setNewEnglish] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unlearned' | 'learned'>('all');

  // Filter flashcards
  const filteredCards = flashcards.filter(card => {
    if (filterMode === 'learned') return card.learned;
    if (filterMode === 'unlearned') return !card.learned;
    return true;
  });

  const currentPracticeCard = activeCardIndex !== null && filteredCards[activeCardIndex] ? filteredCards[activeCardIndex] : null;

  const handleStartPractice = () => {
    if (filteredCards.length > 0) {
      setActiveCardIndex(0);
      setIsFlipped(false);
    }
  };

  const handleShuffle = () => {
    if (filteredCards.length > 0) {
      const shuffled = [...filteredCards].sort(() => Math.random() - 0.5);
      const remainingUnmatched = flashcards.filter(c => !filteredCards.includes(c));
      onUpdateFlashcards([...shuffled, ...remainingUnmatched]);
      setActiveCardIndex(0);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleMarkLearned = (id: string, learned: boolean) => {
    // 1. Calculate the next index BEFORE updating parent state to prevent stale filter offsets.
    const currentIndex = activeCardIndex;
    let nextIndex = currentIndex;
    
    if (currentIndex !== null) {
      if (filterMode !== 'all') {
        // In filtered mode, the current card disappears from the filtered list.
        if (filteredCards.length > 1) {
          if (currentIndex >= filteredCards.length - 1) {
            nextIndex = 0; // Wrap around
          } else {
            nextIndex = currentIndex; // The next card shifts into the current index
          }
        } else {
          nextIndex = null; // No more cards left under this filter
        }
      } else {
        // In 'all' mode, the current card stays. Simply advance the index.
        if (filteredCards.length > 1) {
          if (currentIndex >= filteredCards.length - 1) {
            nextIndex = 0;
          } else {
            nextIndex = currentIndex + 1;
          }
        }
      }
    }

    // 2. Clear flip state so we display the front of the next card
    setIsFlipped(false);

    // 3. Update the active card index atomically
    setActiveCardIndex(nextIndex);

    // 4. Update the parent flashcard list
    const updated = flashcards.map(c => c.id === id ? { ...c, learned } : c);
    onUpdateFlashcards(updated);
    if (activeCardIndex !== null && activeCardIndex < filteredCards.length - 1) {
      setActiveCardIndex(activeCardIndex);
    } else if (filteredCards.length <= 1) {
      setActiveCardIndex(null);
    }
  };

  const handleDeleteCard = (id: string) => {
    const updated = flashcards.filter(c => c.id !== id);
    onUpdateFlashcards(updated);
    if (filteredCards.length <= 1) {
      setActiveCardIndex(null);
    } else if (activeCardIndex !== null && activeCardIndex >= filteredCards.length - 1) {
      setActiveCardIndex(filteredCards.length - 2);
    }
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJapanese.trim() || !newEnglish.trim()) return;

    const newCard: Flashcard = {
      id: `fc-${Date.now()}`,
      japanese: newJapanese.trim(),
      romaji: newRomaji.trim(),
      english: newEnglish.trim(),
      topic: 'Custom',
      createdAt: Date.now(),
      learned: false,
    };

    onUpdateFlashcards([newCard, ...flashcards]);
    setNewJapanese('');
    setNewRomaji('');
    setNewEnglish('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 space-y-4 max-w-lg mx-auto w-full">
      
      {/* Header section */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-slate-50">
            Flashcards Review
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Study essential phrases from your tutor conversations offline.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
          title="Add Flashcard"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs & Toggle */}
      <div className="flex items-center justify-between shrink-0 gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
        {(['all', 'unlearned', 'learned'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setFilterMode(mode);
              setActiveCardIndex(null);
              setIsFlipped(false);
            }}
            className={`flex-1 text-center py-2 text-xs font-semibold capitalize rounded-lg transition-all cursor-pointer ${
              filterMode === mode
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {mode === 'all' ? 'All' : mode === 'unlearned' ? 'Reviewing' : 'Mastered'}
            <span className="ml-1 text-[10px] bg-slate-200/50 dark:bg-slate-950 px-1.5 py-0.5 rounded font-mono font-bold">
              {flashcards.filter(c => {
                if (mode === 'learned') return c.learned;
                if (mode === 'unlearned') return !c.learned;
                return true;
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* Main Flashcards Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2 flex flex-col items-center justify-center">
        
        {/* If Active Practice Mode is active */}
        {currentPracticeCard ? (
          <div className="w-full flex flex-col items-center gap-4">
            
            {/* Card Index tracker */}
            <div className="flex items-center justify-between w-full max-w-sm px-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-[10px] bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-full">
                Topic: {currentPracticeCard.topic}
              </span>
              <span className="font-mono">
                {activeCardIndex! + 1} / {filteredCards.length}
              </span>
            </div>

            {/* Flip Card Container */}
            <div 
              onClick={handleFlip}
              className="relative w-full max-w-sm min-h-[260px] h-[290px] cursor-pointer select-none perspective-1000"
            >
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                isFlipped ? 'rotate-y-180' : ''
              }`}>
                
                {/* FRONT FACE (Japanese / Romaji) */}
                <div className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between backface-hidden shadow-md">
                  <div className="flex justify-between items-center text-slate-400">
                    <Bookmark className={`w-4 h-4 ${currentPracticeCard.learned ? 'text-indigo-500 fill-indigo-500' : ''}`} />
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-md">
                      Front Side
                    </span>
                  </div>

                  <div className="text-center space-y-3 my-auto relative max-h-[170px] overflow-y-auto no-scrollbar px-1">
                    {(() => {
                      const cleanJap = currentPracticeCard.japanese;
                      const cleanRom = currentPracticeCard.romaji;
                      const fontSize = cleanJap.length > 25 ? 'text-base' : cleanJap.length > 12 ? 'text-xl' : 'text-2xl';
                      return (
                        <>
                          <p className={`${fontSize} font-bold font-sans text-slate-900 dark:text-white leading-snug break-words`}>
                            {cleanJap}
                          </p>
                          {cleanRom && (
                            <p className="text-xs font-semibold font-mono text-indigo-500 dark:text-indigo-300 tracking-wide break-words">
                              {cleanRom}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    
                    {/* Speak / Listen Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Stop propagation to prevent card flipping
                        const cleanJap = currentPracticeCard.japanese;
                        speakJapanese(cleanJap, settings.voiceRate, settings.voiceURI, settings.apiKey, settings.cardVoice);
                      }}
                      className="mx-auto mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-full transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-indigo-100 dark:border-slate-700 shadow-xs"
                      title="Listen to pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Listen
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
                    Tap anywhere else to flip
                  </div>
                </div>

                {/* BACK FACE (English translation) */}
                <div className="absolute inset-0 w-full h-full bg-indigo-50 dark:bg-slate-950 border-2 border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-5 flex flex-col justify-between rotate-y-180 backface-hidden shadow-md">
                  <div className="flex justify-between items-center text-indigo-500 dark:text-indigo-300">
                    <Bookmark className={`w-4 h-4 ${currentPracticeCard.learned ? 'fill-indigo-500 dark:fill-indigo-400' : ''}`} />
                    <span className="text-[10px] uppercase font-bold tracking-wider font-mono bg-indigo-100 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                      Back Side (English)
                    </span>
                  </div>

                  <div className="text-center space-y-2 my-auto max-h-[170px] overflow-y-auto no-scrollbar px-1">
                    {(() => {
                      const cleanEng = currentPracticeCard.english || 'Meaning';
                      const fontSize = cleanEng.length > 30 ? 'text-sm' : 'text-lg';
                      return (
                        <p className={`${fontSize} font-bold text-indigo-950 dark:text-indigo-300 leading-relaxed font-sans break-words`}>
                          {cleanEng}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Meaning
                    </p>

                    {/* Speak Japanese from back of the card too */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Stop propagation to prevent card flipping
                        const cleanJap = currentPracticeCard.japanese;
                        speakJapanese(cleanJap, settings.voiceRate, settings.voiceURI, settings.apiKey, settings.cardVoice);
                      }}
                      className="mx-auto mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-full transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-indigo-100 dark:border-slate-700 shadow-xs"
                      title="Listen to Japanese pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Hear Japanese
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-300 font-medium">
                    <RotateCw className="w-3.5 h-3.5" />
                    Tap anywhere else to flip
                  </div>
                </div>

              </div>
            </div>

            {/* Assessment Button Row */}
            <div className="flex items-center gap-3 w-full max-w-sm shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCard(currentPracticeCard.id);
                }}
                className="flex-1 py-3 text-xs font-bold border border-rose-200 hover:bg-rose-50 dark:border-rose-950 dark:hover:bg-rose-950/20 text-rose-500 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>

              {currentPracticeCard.learned ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkLearned(currentPracticeCard.id, false);
                  }}
                  className="flex-[2] py-3 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800"
                >
                  <AlertCircle className="w-4 h-4" />
                  Review Again
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkLearned(currentPracticeCard.id, true);
                  }}
                  className="flex-[2] py-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mastered
                </button>
              )}
            </div>

            {/* Exit practice controls */}
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeCardIndex > 0) setActiveCardIndex(activeCardIndex - 1);
                  setIsFlipped(false);
                }}
                disabled={activeCardIndex === 0}
                className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold disabled:text-slate-300 dark:disabled:text-slate-700 cursor-pointer"
              >
                ← Prev
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                  setActiveCardIndex(null);
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
              >
                Exit Session
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeCardIndex < filteredCards.length - 1) setActiveCardIndex(activeCardIndex + 1);
                  setIsFlipped(false);
                }}
                disabled={activeCardIndex === filteredCards.length - 1}
                className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold disabled:text-slate-300 dark:disabled:text-slate-700 cursor-pointer"
              >
                Next →
              </button>
            </div>

          </div>
        ) : (
          /* Empty or Preview state (showing options to start) */
          <div className="w-full flex flex-col items-center text-center space-y-6">
            
            {/* Visual representation */}
            <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-300 rounded-full relative">
              <Layers className="w-12 h-12" />
              <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center border-2 border-slate-50 dark:border-slate-900">
                {filteredCards.length}
              </span>
            </div>

            <div className="space-y-2 max-w-[280px]">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                {filterMode === 'all' ? 'Study Practice Deck' : filterMode === 'unlearned' ? 'Review Deck' : 'Mastered Collection'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {filteredCards.length === 0 
                  ? "No flashcards fit this filter right now. Chat with the Japanese tutor to collect phrases!"
                  : `You have ${filteredCards.length} phrase cards ready for study. Run an offline flip session.`}
              </p>
            </div>

            {filteredCards.length > 0 && (
              <div className="flex flex-col gap-3 w-full max-w-xs shrink-0">
                <button
                  onClick={handleStartPractice}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  Start Deck Session
                </button>
                
                <button
                  onClick={handleShuffle}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2 border border-slate-200/50 dark:border-slate-800"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle & Practice
                </button>
              </div>
            )}

            {filteredCards.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                 className="text-xs px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 dark:text-indigo-300 rounded-xl font-bold transition-all border border-indigo-100/50 dark:border-indigo-900/50 cursor-pointer"
              >
                Add Manual Flashcard
              </button>
            )}

          </div>
        )}

      </div>

      {/* 3. ADD FLASHCARD DIALOG MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-6 z-40">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
                  Create Flashcard
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCard} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 block">
                    Japanese (Kanji / Kana)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. お会計をお願いします"
                    value={newJapanese}
                    onChange={(e) => setNewJapanese(e.target.value)}
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
                    value={newRomaji}
                    onChange={(e) => setNewRomaji(e.target.value)}
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
                    value={newEnglish}
                    onChange={(e) => setNewEnglish(e.target.value)}
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
