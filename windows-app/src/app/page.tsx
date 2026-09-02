"use client";

import { useEffect, useState, useCallback } from "react";
import { App as CapacitorApp } from "@capacitor/app";

interface Note {
  id: string;
  text: string;
  audioUrl: string | null;
  timestamp: string;
}

// ── Mock credits (replace with real API call when endpoint is available) ──────
const MOCK_CREDITS_BASE = 1250;

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<"Cloud" | "Wi-Fi" | "Bluetooth">("Cloud");
  const [isRecording, setIsRecording] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Credits state
  const [credits, setCredits] = useState(MOCK_CREDITS_BASE);
  const [creditsRefreshing, setCreditsRefreshing] = useState(false);
  const [creditsError, setCreditsError] = useState(false);

  useEffect(() => {
    const storedNotes = localStorage.getItem("iwrite_notes");
    if (storedNotes) setNotes(JSON.parse(storedNotes));
    setLoading(false);

    // Subscribe to auto-refreshing credits from Electron main process
    let unsubscribeCredits = () => {};
    if (window.electronAPI) {
      window.electronAPI.fetchCredits(); // Initial fetch
      unsubscribeCredits = window.electronAPI.onCreditsUpdate((val: number) => {
        setCredits(val);
      });
    }

    CapacitorApp.addListener("appUrlOpen", (data) => {
      if (data.url.includes("iwrite://record")) {
        setTimeout(() => setIsRecording(true), 500);
      }
    });

    return () => {
      CapacitorApp.removeAllListeners();
      unsubscribeCredits();
    };
  }, []);

  // ── Sync handler ────────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    // Simulate network round-trip
    await new Promise((r) => setTimeout(r, 1800));
    setLastSynced(new Date());
    setIsSyncing(false);
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 3000);
  }, [isSyncing]);

  // ── Credits refresh ─────────────────────────────────────────────────────────
  const handleCreditsRefresh = useCallback(async () => {
    if (creditsRefreshing) return;
    setCreditsRefreshing(true);
    setCreditsError(false);
    if (window.electronAPI) {
      await window.electronAPI.fetchCredits();
    } else {
      await new Promise((r) => setTimeout(r, 1200));
      setCredits(MOCK_CREDITS_BASE - Math.floor(Math.random() * 80));
    }
    setCreditsRefreshing(false);
  }, [creditsRefreshing]);

  // ── Note helpers ─────────────────────────────────────────────────────────────
  const handleExportTxt = (note: Note) => {
    const element = document.createElement("a");
    const file = new Blob([note.text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `note_${note.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleBookWriter = () => {
    if (window.electronAPI) {
      window.electronAPI.creditsConsumed(25); // Consume 25 credits for Book Writer mode!
    }
    alert("Book Writer Mode activated! 25 credits consumed. Analyzing your notes to write a novel...");
  };

  const addMockNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      text:
        "This is a new captured thought sent from your Android device. It synced flawlessly via " +
        syncMode +
        ".",
      audioUrl: null,
      timestamp: new Date().toISOString(),
    };
    const newNotes = [newNote, ...notes];
    setNotes(newNotes);
    localStorage.setItem("iwrite_notes", JSON.stringify(newNotes));
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (isRecording) addMockNote();
  };

  // ── Credit bar width ─────────────────────────────────────────────────────────
  const creditPct = Math.min(100, Math.round((credits / 2000) * 100));

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans overflow-hidden relative selection:bg-blue-500/30">
      {/* Animated Mesh Gradients Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-60">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-cyan-600/15 rounded-full mix-blend-screen filter blur-[150px]" />
        <div
          className="absolute top-[40%] left-[60%] w-[40vw] h-[40vw] bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* ── ANTIGRAVITY CREDITS TOP BAR ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-6 z-10 relative">
        <div className="bg-white/5 backdrop-blur-2xl border border-cyan-500/20 rounded-2xl px-6 py-4 flex flex-wrap items-center gap-6 shadow-lg shadow-cyan-500/5">
          {/* Label + pulsing dot */}
          <div className="flex items-center gap-2 min-w-fit">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
            </span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Antigravity Credits</span>
          </div>

          {/* Big number */}
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-blue-400 transition-opacity duration-300 ${
                creditsRefreshing ? "opacity-30" : "opacity-100"
              }`}
            >
              {credits.toLocaleString()}
            </span>
            <span className="text-gray-500 text-sm">remaining</span>
          </div>

          {/* Progress bar */}
          <div className="flex-1 min-w-[120px] flex flex-col gap-1">
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${creditPct}%`,
                  background:
                    creditPct > 50
                      ? "linear-gradient(90deg, #0A84FF, #00D4FF)"
                      : creditPct > 20
                      ? "linear-gradient(90deg, #F59E0B, #FBBF24)"
                      : "linear-gradient(90deg, #EF4444, #F87171)",
                }}
              />
            </div>
            <p className="text-[10px] text-gray-600">{creditPct}% of 2,000 · Resets monthly</p>
          </div>

          {/* Refresh button */}
          <button
            id="credits-refresh-btn"
            onClick={handleCreditsRefresh}
            disabled={creditsRefreshing}
            title="Refresh credits"
            className="ml-auto p-2 rounded-xl hover:bg-white/10 text-gray-500 hover:text-cyan-300 border border-transparent hover:border-cyan-500/20 transition-all duration-200 active:scale-90 flex items-center gap-1.5 text-xs font-semibold"
          >
            <svg
              className={`w-3.5 h-3.5 ${ creditsRefreshing ? "animate-spin" : "" }`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {creditsRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-8">

        {/* ── Left Column ──────────────────────────────────────────────────── */}
        <div className="xl:w-1/3 flex flex-col gap-6 z-10">

          {/* Header Glass Panel */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl">
            <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-400 tracking-tight">
              iwrite
            </h1>
            <p className="text-gray-300 mt-2 text-sm font-light">
              Cross-platform companion dashboard.
            </p>

            {/* Sync Layer selector */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">
                Sync Layer
              </p>
              <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5">
                {(["Cloud", "Wi-Fi", "Bluetooth"] as const).map((mode) => (
                  <button
                    key={mode}
                    id={`sync-mode-${mode.toLowerCase()}`}
                    onClick={() => setSyncMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
                      syncMode === mode
                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Sync Now Button ───────────────────────────────────────── */}
            <div className="mt-5">
              <button
                id="sync-now-btn"
                onClick={handleSync}
                disabled={isSyncing}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 border ${
                  syncSuccess
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-lg shadow-emerald-500/10"
                    : isSyncing
                    ? "bg-blue-600/20 border-blue-400/30 text-blue-300 cursor-wait"
                    : "bg-gradient-to-r from-blue-600/80 to-cyan-500/80 border-blue-400/30 text-white hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95"
                }`}
              >
                {isSyncing ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Syncing via {syncMode}…
                  </>
                ) : syncSuccess ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Synced!{" "}
                    {lastSynced &&
                      lastSynced.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Sync Now
                  </>
                )}
              </button>
              {lastSynced && !syncSuccess && (
                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  Last synced:{" "}
                  {lastSynced.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Credits card removed from sidebar – now in top bar above */}

          {/* AI Features Glass Panel */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/40 transition-colors duration-500 pointer-events-none" />
            <h3 className="text-xl font-bold mb-2">Book Writer AI</h3>
            <p className="text-sm text-gray-400 mb-6 font-light">
              Transform your scattered notes into a structured, cohesive novel using
              advanced AI processing.
            </p>
            <button
              id="book-writer-btn"
              onClick={handleBookWriter}
              className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl shadow-lg transition-all duration-300 font-semibold text-sm tracking-wide flex items-center justify-center gap-2 group-hover:border-purple-500/50 group-hover:shadow-purple-500/20"
            >
              <svg
                className="w-4 h-4 text-purple-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              Generate Novel
            </button>
          </div>

          {/* Android Simulator / Widget Sim Panel */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl mt-auto">
            <div className="flex items-center gap-4">
              <button
                id="record-toggle-btn"
                onClick={toggleRecording}
                className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ${
                  isRecording
                    ? "bg-blue-600 shadow-blue-500/60 scale-95"
                    : "bg-white/10 hover:bg-white/20 border border-white/10 hover:scale-105"
                }`}
              >
                {isRecording && (
                  <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75" />
                )}
                <svg
                  className={`w-6 h-6 ${isRecording ? "text-white" : "text-cyan-400"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
              <div>
                <h3 className="font-bold text-sm text-gray-200">Widget Simulator</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isRecording ? "🔴 Recording… tap to stop" : "Tap mic to capture voice"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Notes Grid ─────────────────────────────────────── */}
        <div className="xl:w-2/3 flex flex-col z-10">
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-bold tracking-tight">Your Library</h2>
            <div className="text-xs font-medium text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
              {notes.length} Records
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <svg
                  className="w-10 h-10 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-300">Awaiting Sync</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-md">
                Your dashboard is empty. Use the widget simulator or connect your Android
                device to start syncing your captured thoughts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl hover:bg-white/10 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase bg-blue-500/10 px-2 py-1 rounded-md">
                        {new Date(note.timestamp).toLocaleDateString()} &middot;{" "}
                        {new Date(note.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    </div>
                    <p className="text-gray-300 leading-relaxed text-sm">{note.text}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={() => handleExportTxt(note)}
                      className="flex-1 text-[11px] uppercase tracking-wider px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 font-semibold transition-colors"
                    >
                      TXT
                    </button>
                    <button className="flex-1 text-[11px] uppercase tracking-wider px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 font-semibold transition-colors">
                      Audio
                    </button>
                    <button className="flex-1 text-[11px] uppercase tracking-wider px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 font-semibold transition-colors">
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
