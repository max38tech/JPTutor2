/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
}

const LOCAL_STORAGE_LOGS_KEY = 'nihongo_tutor_system_logs';
const MAX_LOGS = 100;

class AppLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  constructor() {
    // Load existing logs from local storage if any
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      // Ignore
    }

    // Intercept window error events
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.addLog('error', `Uncaught exception: ${event.message}`, event.error?.stack);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;
        this.addLog('error', `Unhandled Promise Rejection: ${msg}`, stack);
      });

      // Wrap console methods
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        originalConsoleError.apply(console, args);
        const msg = args.map(arg => {
          if (arg instanceof Error) return arg.message;
          if (typeof arg === 'object') {
            try { return JSON.stringify(arg); } catch (e) { return String(arg); }
          }
          return String(arg);
        }).join(' ');
        this.addLog('error', msg);
      };

      const originalConsoleWarn = console.warn;
      console.warn = (...args: any[]) => {
        originalConsoleWarn.apply(console, args);
        const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
        this.addLog('warn', msg);
      };
    }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public addLog(level: 'info' | 'warn' | 'error', message: string, stack?: string) {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      level,
      message,
      stack,
    };

    this.logs = [newEntry, ...this.logs].slice(0, MAX_LOGS);

    try {
      localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(this.logs));
    } catch (e) {
      // Ignore storage errors (quota full etc)
    }

    this.notify();
  }

  public clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
    } catch (e) {}
    this.addLog('info', 'System logs cleared.');
    this.notify();
  }

  public subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.logs]);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb([...this.logs]));
  }
}

export const logger = new AppLogger();
