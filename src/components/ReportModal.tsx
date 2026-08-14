/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Bug, Lightbulb, Send, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { logger } from '../utils/logger';
import { getServerBaseUrl } from '../utils/api';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'bug' | 'feature';
}

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string; issueUrl?: string };

const MAX_SCREENSHOTS = 3;

const deviceInfo = () =>
  typeof navigator !== 'undefined' ? `${navigator.userAgent} | ${navigator.platform}` : 'unknown';

// Downscales and re-encodes as JPEG so a full-resolution phone screenshot
// doesn't balloon the request - a few hundred KB is plenty to read a bug report.
function resizeImageToDataUrl(file: File, maxDim = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read the selected image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas is not supported on this device.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ReportModal({ isOpen, onClose, initialMode = 'bug' }: ReportModalProps) {
  const [mode, setMode] = useState<'bug' | 'feature'>(initialMode);
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setDescription('');
      setScreenshots([]);
      setScreenshotError(null);
      setSubmit({ status: 'idle' });
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (submit.status === 'submitting') return;
    onClose();
  };

  const handleScreenshotSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-selecting the same file
    if (!files.length) return;

    setScreenshotError(null);
    const room = MAX_SCREENSHOTS - screenshots.length;
    if (files.length > room) {
      setScreenshotError(`Only ${MAX_SCREENSHOTS} screenshots per report — added the first ${Math.max(room, 0)}.`);
    }

    try {
      const resized = await Promise.all(files.slice(0, room).map(f => resizeImageToDataUrl(f)));
      setScreenshots(prev => [...prev, ...resized]);
    } catch (err: any) {
      setScreenshotError(err.message || 'Could not process one of the selected images.');
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed || submit.status === 'submitting') return;

    setSubmit({ status: 'submitting' });

    try {
      if (mode === 'bug') {
        const clientLogs = logger
          .getLogs()
          .slice(0, 100)
          .map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`)
          .join('\n');

        let serverLogs = '';
        try {
          const res = await fetch(`${getServerBaseUrl()}/api/debug/logs`);
          if (res.ok) serverLogs = (await res.json()).logs || '';
        } catch {
          // Best-effort; the bug report still goes through without server logs.
        }

        const res = await fetch(`${getServerBaseUrl()}/api/report/bug`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: trimmed, clientLogs, serverLogs, deviceInfo: deviceInfo(), screenshots }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit bug report.');
        setSubmit({ status: 'success', issueUrl: data.issueUrl, message: `Filed as issue #${data.issueNumber}.` });
      } else {
        const res = await fetch(`${getServerBaseUrl()}/api/report/feature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: trimmed, deviceInfo: deviceInfo(), screenshots }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit feature request.');
        setSubmit({ status: 'success', message: "Thanks! It's logged for review." });
      }
    } catch (err: any) {
      setSubmit({ status: 'error', message: err.message || 'Something went wrong. Please try again.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
            {mode === 'bug' ? 'Report a Bug' : 'Request a Feature'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submit.status === 'success' ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{submit.message}</p>
            {submit.issueUrl && (
              <a
                href={submit.issueUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 dark:text-indigo-300 font-bold underline"
              >
                View on GitHub
              </a>
            )}
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('bug')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'bug'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                Bug
              </button>
              <button
                type="button"
                onClick={() => setMode('feature')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'feature'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Feature Idea
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-600 dark:text-slate-400 block">
                {mode === 'bug' ? 'What went wrong?' : 'What would you like to see?'}
              </label>
              <textarea
                required
                rows={5}
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  mode === 'bug'
                    ? "e.g. The tutor's audio cut out when I pressed Interrupt during..."
                    : 'e.g. It would help if the flashcard deck could be filtered by topic...'
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {mode === 'bug'
                  ? 'Recent client & server diagnostic logs are attached automatically. No personal data beyond your device type is included.'
                  : "This goes straight to the developer for review — it won't be posted publicly."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-600 dark:text-slate-400 block">
                Screenshots (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {screenshots.map((src, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <img src={src} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeScreenshot(i)}
                      className="absolute top-0 right-0 bg-slate-950/70 hover:bg-rose-600 text-white p-0.5 rounded-bl-lg cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {screenshots.length < MAX_SCREENSHOTS && (
                  <label className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 cursor-pointer transition-colors">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleScreenshotSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {screenshotError && (
                <p className="text-[10px] text-rose-500">{screenshotError}</p>
              )}
            </div>

            {submit.status === 'error' && (
              <div className="flex items-start gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{submit.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!description.trim() || submit.status === 'submitting'}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              {submit.status === 'submitting' ? 'Sending...' : mode === 'bug' ? 'Report Bug' : 'Send Idea'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
