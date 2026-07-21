/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { logger, LogEntry } from '../utils/logger';
import { getServerBaseUrl } from '../utils/api';
import { 
  X, 
  Trash2, 
  Copy, 
  Send, 
  Check, 
  AlertCircle, 
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Terminal,
  Smartphone
} from 'lucide-react';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LogTab = 'client' | 'server';

export default function LogsModal({ isOpen, onClose }: LogsModalProps) {
  const [activeTab, setActiveTab] = useState<LogTab>('client');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Server logs state
  const [serverLogs, setServerLogs] = useState<string>('');
  const [isLoadingServerLogs, setIsLoadingServerLogs] = useState(false);
  const [serverLogsError, setServerLogsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Subscribe to live log updates
    const unsubscribe = logger.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });

    return unsubscribe;
  }, [isOpen]);

  // Fetch server logs when tab switches to server or modal opens
  const fetchServerLogs = async () => {
    setIsLoadingServerLogs(true);
    setServerLogsError(null);
    try {
      const res = await fetch(`${getServerBaseUrl()}/api/debug/logs`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      setServerLogs(data.logs || '');
    } catch (err: any) {
      setServerLogsError(err.message || 'Failed to fetch server logs');
    } finally {
      setIsLoadingServerLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'server') {
      fetchServerLogs();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    let formatted = '';
    if (activeTab === 'client') {
      formatted = logs.map(l => {
        const date = new Date(l.timestamp).toISOString();
        const levelStr = l.level.toUpperCase().padEnd(5);
        let logStr = `[${date}] [${levelStr}] ${l.message}`;
        if (l.stack) {
          logStr += `\nStack:\n${l.stack}`;
        }
        return logStr;
      }).join('\n\n');
    } else {
      formatted = serverLogs;
    }

    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy logs', err);
    });
  };

  const handleSendToSupport = async () => {
    let latestServer = serverLogs;
    if (!latestServer) {
      try {
        const res = await fetch(`${getServerBaseUrl()}/api/debug/logs`);
        if (res.ok) {
          const data = await res.json();
          latestServer = data.logs || '';
          setServerLogs(latestServer);
        }
      } catch (e) {
        console.error('Failed to fetch server logs for email:', e);
      }
    }

    // Take the last 100 client logs to cover full current session
    const recentClientLogs = logs.slice(-100);
    const formattedClient = recentClientLogs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    
    // Take the last 5000 characters of server logs
    let formattedServer = latestServer || '';
    if (formattedServer.length > 5000) {
      formattedServer = `... (older logs truncated for size) ...\n` + formattedServer.substring(formattedServer.length - 5000);
    }
    if (!formattedServer.trim()) {
      formattedServer = "(Server logs empty or not loaded.)";
    }

    const compiledLogs = `=========================================\nCLIENT-SIDE DIAGNOSTIC LOGS\n=========================================\n${formattedClient}\n\n=========================================\nSERVER-SIDE WEB-SOCKET LOGS\n=========================================\n${formattedServer}`;
    
    const subject = encodeURIComponent("JP Tutor App - Diagnostics & Debug Logs");
    const body = encodeURIComponent(
      `Hello Support,\n\nI encountered an issue using the JP Tutor App.\n\n${compiledLogs}\n\n---\nDevice/App Info:\nUser Agent: ${navigator.userAgent}\nPlatform: ${navigator.platform}`
    );
    
    window.location.href = `mailto:shawn.shiobara@gmail.com?subject=${subject}&body=${body}`;
  };

  const handleClearLogs = async () => {
    if (activeTab === 'client') {
      if (confirm('Are you sure you want to clear all client-side diagnostic logs?')) {
        logger.clearLogs();
      }
    } else {
      if (confirm('Are you sure you want to clear server-side WebSocket logs?')) {
        try {
          const res = await fetch(`${getServerBaseUrl()}/api/debug/logs/clear`, { method: 'POST' });
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          await fetchServerLogs();
        } catch (err: any) {
          alert(`Failed to clear server logs: ${err.message}`);
        }
      }
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-xl animate-pulse">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                Diagnostics Panel & Logs
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Track client-side audio/webview status and server-side WebSocket handshakes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Segments */}
        <div className="px-5 pt-3 pb-1.5 border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-950/10 flex items-center justify-between shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'client'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Client Logs
            </button>
            <button
              onClick={() => setActiveTab('server')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'server'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Backend Server Logs
            </button>
          </div>

          {activeTab === 'server' && (
            <button
              onClick={fetchServerLogs}
              disabled={isLoadingServerLogs}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerLogs ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-950/20 flex justify-between items-center text-xs shrink-0 gap-2">
          <span className="text-[10px] text-slate-400 font-mono font-medium">
            {activeTab === 'client' 
              ? `${logs.length} entries (max 100)` 
              : `${serverLogs.split('\n').length} lines captured`
            }
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleSendToSupport}
              className="px-2.5 py-1.5 bg-indigo-550 dark:bg-indigo-950 hover:bg-indigo-600 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer border border-indigo-100 dark:border-indigo-900"
            >
              <Send className="w-3.5 h-3.5" />
              Email Dev
            </button>
            <button
              onClick={handleClearLogs}
              disabled={activeTab === 'client' ? logs.length === 0 : !serverLogs}
              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Log Viewer Scroll Panel */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 text-slate-300 font-mono text-[10px] leading-relaxed no-scrollbar">
          {activeTab === 'client' ? (
            logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-500 space-y-2">
                <Info className="w-8 h-8 stroke-1" />
                <p>No client log events captured yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const isError = log.level === 'error';
                  const isWarn = log.level === 'warn';
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <div 
                      key={log.id} 
                      className={`p-2.5 rounded-lg border flex flex-col gap-1 transition-all ${
                        isError 
                          ? 'bg-rose-950/20 border-rose-900/40 text-rose-400' 
                          : isWarn 
                            ? 'bg-amber-950/20 border-amber-900/40 text-amber-400' 
                            : 'bg-slate-900/60 border-slate-800/40 text-slate-400'
                      }`}
                    >
                      <div 
                        className="flex items-start justify-between gap-3 cursor-pointer select-text"
                        onClick={() => log.stack && toggleExpand(log.id)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[9px] text-slate-500 shrink-0 font-medium select-none">
                            {formatTime(log.timestamp)}
                          </span>
                          <span className={`text-[8px] px-1 rounded uppercase font-bold select-none shrink-0 ${
                            isError 
                              ? 'bg-rose-900/40 text-rose-300' 
                              : isWarn 
                                ? 'bg-amber-900/40 text-amber-300' 
                                : 'bg-slate-800 text-slate-400'
                          }`}>
                            {log.level}
                          </span>
                          <p className="font-mono text-[11px] whitespace-pre-wrap select-text break-all">
                            {log.message}
                          </p>
                        </div>
                        {log.stack && (
                          <button className="text-slate-500 hover:text-slate-300 p-0.5 rounded shrink-0">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      
                      {isExpanded && log.stack && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-slate-500 overflow-x-auto whitespace-pre select-text font-sans text-[9px] bg-slate-950/80 p-2 rounded-md leading-normal">
                          {log.stack}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Server tab content
            isLoadingServerLogs ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="text-xs">Fetching logs from development backend...</p>
              </div>
            ) : serverLogsError ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center text-rose-500 space-y-2">
                <AlertCircle className="w-8 h-8" />
                <p className="font-bold">Error loading server logs</p>
                <p className="text-slate-500 max-w-sm text-[9px] font-mono">{serverLogsError}</p>
                <button 
                  onClick={fetchServerLogs}
                  className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <div className="whitespace-pre-wrap font-mono text-[11px] select-text selection:bg-indigo-500/30 break-all leading-normal">
                {serverLogs || '[System] Connection OK. No backend logs recorded.'}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
