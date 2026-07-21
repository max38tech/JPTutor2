/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserProgress, Flashcard, TopicSession } from '../types';
import { 
  Flame, 
  Sparkles, 
  BookOpen, 
  Trophy, 
  GraduationCap, 
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

interface DashboardProps {
  progress: UserProgress;
  flashcards: Flashcard[];
  sessions: TopicSession[];
  onSwitchToTab: (tab: 'practice' | 'topics' | 'cards') => void;
}

export default function Dashboard({
  progress,
  flashcards,
  sessions,
  onSwitchToTab,
}: DashboardProps) {
  
  // Calculate mastered cards count
  const masteredCards = flashcards.filter(c => c.learned).length;
  const totalCards = flashcards.length;
  const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  // Render last 7 days of calendar activity
  const getPast7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    return days;
  };

  const past7Days = getPast7Days();

  // Simple Level calculation based on XP
  const userLevel = Math.floor(progress.xp / 100) + 1;
  const levelXPProgress = progress.xp % 100;

  return (
    <div className="flex flex-col h-full overflow-hidden px-5 py-6 space-y-5">
      
      {/* Header section */}
      <div className="space-y-1 shrink-0">
        <h1 className="text-2xl font-bold font-sans tracking-tight text-slate-900 dark:text-slate-50">
          Personal Progress
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Monitor your metrics, fluency goals, and daily streak.
        </p>
      </div>

      {/* Main dashboard content */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 no-scrollbar">

        {/* Level & Streak Stats Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          
          {/* Level Block */}
          <div className="p-4 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] opacity-15">
              <GraduationCap className="w-24 h-24 rotate-12" />
            </div>
            <div className="flex justify-between items-center text-indigo-100 font-bold text-xs uppercase tracking-wider">
              <span>Fluency Rank</span>
              <Trophy className="w-4 h-4 text-amber-300" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-extrabold font-sans">
                Lvl {userLevel}
              </p>
              <p className="text-[10px] text-indigo-100 font-medium">
                {progress.xp} Total XP earned
              </p>
            </div>
            
            {/* Level progress bar */}
            <div className="space-y-1">
              <div className="w-full bg-indigo-900/40 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-300"
                  style={{ width: `${levelXPProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] text-indigo-100/80 font-bold uppercase tracking-wider">
                <span>{levelXPProgress}/100 XP</span>
                <span>Next Lvl</span>
              </div>
            </div>
          </div>

          {/* Daily Streak Block */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] opacity-5 text-orange-500">
              <Flame className="w-24 h-24 rotate-12" />
            </div>
            <div className="flex justify-between items-center text-slate-400 font-bold text-xs uppercase tracking-wider">
              <span>Daily Streak</span>
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            </div>
            <div className="space-y-1 mt-3">
              <p className="text-3xl font-extrabold font-sans text-slate-800 dark:text-white">
                {progress.streak} Day{progress.streak !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Practice daily to stay sharp!
              </p>
            </div>
            
            {progress.lastActiveDate === new Date().toISOString().split('T')[0] ? (
              <div className="text-[9px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1 self-start mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Streak is Active!
              </div>
            ) : (
              <div className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-flex items-center gap-1 self-start mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Practice today to keep your streak!
              </div>
            )}
          </div>

        </div>

        {/* 7-Day Activity Heatmap Track */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-3.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                Study Calendar
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Past 7 Days
            </span>
          </div>

          {/* Grid row */}
          <div className="grid grid-cols-7 gap-2">
            {past7Days.map((day, idx) => {
              const dateStr = day.toISOString().split('T')[0];
              const count = progress.activityLog[dateStr] || 0;
              const hasActivity = count > 0;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <div key={idx} className="flex flex-col items-center gap-1.5">
                  <div 
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs transition-all ${
                      hasActivity 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-400 border border-slate-200/40 dark:border-slate-800/40'
                    } ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                    title={`${count} messages on ${day.toLocaleDateString()}`}
                  >
                    {day.getDate()}
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Practice Metrics Overview Row */}
        <div className="grid grid-cols-2 gap-3">
          
          <button
            onClick={() => onSwitchToTab('topics')}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl text-left hover:border-indigo-500 transition-all cursor-pointer group space-y-1.5"
          >
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl w-fit">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {sessions.length}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Topics Studied
              </p>
            </div>
          </button>

          <button
            onClick={() => onSwitchToTab('cards')}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl text-left hover:border-indigo-500 transition-all cursor-pointer group space-y-1.5"
          >
            <div className="p-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-500 rounded-xl w-fit">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {totalCards}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Phrase Flashcards
              </p>
            </div>
          </button>

        </div>

        {/* Mastered Flashcards Progress Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                Vocabulary Mastery
              </h3>
            </div>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {masteryPercentage}% Mastered
            </span>
          </div>

          <div className="space-y-2">
            {/* ProgressBar */}
            <div className="w-full bg-slate-100 dark:bg-slate-950 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${masteryPercentage}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>{masteredCards} cards mastered</span>
              <span>{totalCards - masteredCards} to review</span>
            </div>
          </div>
        </div>

        {/* Offline Practice Badge Indicator */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex items-start gap-3">
          <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0 text-xs">
            ✨
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
              Offline Study Mode Active
            </h4>
            <p className="text-[10px] text-emerald-600/90 dark:text-emerald-500/90 leading-relaxed">
              All flashcards, past dialogue transcripts, feedback tips, and mastery scores are cached locally on your device for seamless offline practice.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
