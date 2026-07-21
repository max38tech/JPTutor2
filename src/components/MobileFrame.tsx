/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Smartphone, Wifi, Battery, Radio } from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  isConnected?: boolean;
}

export default function MobileFrame({ children, isConnected }: MobileFrameProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // key 0 to 12
      setTime(`${hours}:${minutes} ${ampm}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center p-0 md:p-6 transition-colors duration-300 font-sans">
      {/* Outer Mockup container - hidden on small mobile, elegant shadow frame on desktop */}
      <div className="relative w-full max-w-md md:h-[840px] h-screen bg-white dark:bg-slate-900 md:rounded-[40px] md:shadow-2xl overflow-hidden flex flex-col md:border-8 md:border-slate-800 dark:md:border-slate-800 transition-all duration-300">
        
        {/* Mobile Notch & Status Bar (visible only when in the framed viewport) */}
        <div className="bg-slate-100 dark:bg-slate-950/80 px-6 py-3 flex items-center justify-between text-xs font-semibold select-none shrink-0 border-b border-slate-200/50 dark:border-slate-800/40 z-10">
          <span className="font-medium tracking-tight text-slate-700 dark:text-slate-300">
            {time}
          </span>
          
          {/* Dynamic Notch Speaker block on desktop only */}
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-1.5 w-24 h-4 bg-slate-800 rounded-full border border-slate-700/50" />
          
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`} />
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider transition-colors duration-300 ${isConnected ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>LIVE</span>
            <Wifi className={`w-3.5 h-3.5 transition-colors duration-300 ${isConnected ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`} />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-50/50 dark:bg-slate-950/40">
          {children}
        </div>

        {/* Home Indicator bar on desktop */}
        <div className="hidden md:flex bg-slate-100 dark:bg-slate-950/90 py-2 items-center justify-center border-t border-slate-200/50 dark:border-slate-800/40 shrink-0">
          <div className="w-28 h-1 bg-slate-400 dark:bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}
