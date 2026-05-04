"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, ShieldAlert, CheckCircle2, Terminal, Network, Sun, Moon, Trash2, Wand2 } from "lucide-react";

export default function SubmissionPortal() {
  const [issueText, setIssueText] = useState("");
  const [logText, setLogText] = useState("");
  const [isAirGapped, setIsAirGapped] = useState(false);
  const [isDark, setIsDark] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [thoughtProcess, setThoughtProcess] = useState<string[]>([]);
  const [finalResolution, setFinalResolution] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  // Initialize theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const examplePrompts = [
    { label: "Network Outage", text: "The VPN is down! I am working remotely and my Cisco AnyConnect keeps failing to authenticate." },
    { label: "DB Deadlock", text: "The production PostgreSQL database is throwing deadlock errors when I try to run the monthly payroll query." },
    { label: "Password Reset", text: "I can't log in to my email. I think my password expired over the weekend." },
    { label: "Software Crash", text: "I cannot open Microsoft Outlook. Every time I click the app, it instantly crashes and throws an Error Code 0x8004010F." }
  ];

  function loadExample(text: string) {
    setIssueText(text);
  }

  function clearForm() {
    setIssueText("");
    setLogText("");
    setTicketStatus(null);
    setThoughtProcess([]);
    setFinalResolution(null);
    setConfidenceScore(null);
  }

  async function submitTicket() {
    if (!issueText.trim()) return;
    setLoading(true);
    setTicketStatus(null);
    setThoughtProcess([]);
    setFinalResolution(null);
    setConfidenceScore(null);

    setThoughtProcess(["System initialized. Opening secure pipeline..."]);

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          setThoughtProcess(prev => [...prev, `Re-establishing secure connection... (${attempt}/${MAX_RETRIES})`]);
          await new Promise(r => setTimeout(r, 3000));
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const res = await fetch("/api/process-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: issueText, logContent: logText, useLLM: !isAirGapped }),
          signal: controller.signal
        });

        clearTimeout(timeout);
        const data = await res.json();
        
        if (res.ok) {
          setThoughtProcess(data.thoughtProcess || []);
          if (data.status === "SUCCESS") {
            setTicketStatus("AUTO_RESOLVED");
            setFinalResolution(data.resolution);
            setConfidenceScore(data.confidenceScore);
          } else {
            setTicketStatus("ESCALATED");
            setFinalResolution("Complexity exceeds safe autonomous limits. Priority routed to human L2 engineering team.");
            setConfidenceScore(data.confidenceScore);
          }
          setLoading(false);
          return;
        } else {
          setThoughtProcess(prev => [...prev, "Connection severed. Packet loss detected."]);
          setTicketStatus("ESCALATED");
          setFinalResolution("Error connecting to neural cluster. Routed to human queue.");
          setLoading(false);
          return;
        }
      } catch(err) {
        if (attempt === MAX_RETRIES) {
          setTicketStatus("ESCALATED");
          setFinalResolution("Neural cluster unresponsive. Forced routing to human queue.");
        }
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen transition-colors duration-500 bg-slate-50 dark:bg-[#030303] text-slate-900 dark:text-slate-200 font-sans p-4 sm:p-8 overflow-x-hidden relative">
      
      {/* Background Ambient Orbs (Only visible in dark mode for premium feel) */}
      <div className="hidden dark:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="hidden dark:block absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center space-x-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)] dark:shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)] border border-slate-200 dark:border-white/10">
              <Network className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                Captain Obvious <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-[10px] uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-mono border border-cyan-200 dark:border-cyan-500/20">L1 Agent</span>
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-wide mt-1">Zero-Trust Enterprise Triage</p>
            </div>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Theme Toggle */}
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              onClick={() => setIsDark(!isDark)}
              className="p-3 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </motion.button>

            {/* Air-Gapped Toggle Switch */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center space-x-4 bg-white dark:bg-white/[0.03] backdrop-blur-xl px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-md dark:shadow-xl"
            >
              <div className="flex flex-col items-end mr-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${!isAirGapped ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'}`}>Cloud Sync</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors mt-1 ${isAirGapped ? 'text-rose-600 dark:text-rose-400 dark:drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]' : 'text-slate-400 dark:text-slate-600'}`}>Air-Gapped</span>
              </div>
              
              <button 
                onClick={() => setIsAirGapped(!isAirGapped)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all focus:outline-none ${isAirGapped ? 'bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/50 shadow-inner' : 'bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/50 shadow-inner'}`}
              >
                <span className="sr-only">Toggle Security Mode</span>
                <span
                  className={`inline-block h-6 w-6 transform rounded-full transition-all duration-300 shadow-sm ${isAirGapped ? 'translate-x-7 bg-rose-500 dark:bg-rose-400 dark:shadow-[0_0_10px_rgba(251,113,133,0.8)]' : 'translate-x-1 bg-cyan-500 dark:bg-cyan-400 dark:shadow-[0_0_10px_rgba(6,182,212,0.8)]'}`}
                />
              </button>
            </motion.div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COMPONENT: Submission Form */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-5 flex flex-col space-y-6"
          >
            <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl p-7 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl relative overflow-hidden group">
              
              {/* Subtle hover gradient inside card (Dark mode only) */}
              <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative z-10 space-y-6">
                
                {/* Feature: Quick Fill Chips */}
                <div>
                   <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Secure Input
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="w-full text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <Wand2 className="w-3 h-3" /> Quick Examples
                    </span>
                    {examplePrompts.map((p, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/30 hover:border-cyan-200 dark:hover:border-cyan-500/50 transition-colors py-1.5 text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                        onClick={() => loadExample(p.text)}
                      >
                        {p.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3 ml-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Issue Description</label>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{issueText.length} chars</span>
                  </div>
                  <textarea
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none h-32 placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner custom-scrollbar"
                    placeholder="E.g. The production DB is locking up, my IP is 192.168.1.5..."
                    value={issueText}
                    onChange={e => setIssueText(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3 ml-1 flex items-center justify-between">
                    <span>System Logs</span>
                    <span className="text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-full text-[8px]">OPTIONAL</span>
                  </label>
                  <textarea
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 border-dashed rounded-2xl p-4 font-mono text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none h-24 placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-inner custom-scrollbar"
                    placeholder="Paste stack traces or raw logs here..."
                    value={logText}
                    onChange={e => setLogText(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={submitTicket} 
                    disabled={loading || !issueText.trim()}
                    className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold tracking-wide transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] dark:shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] dark:hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.6)] disabled:opacity-50 disabled:cursor-not-allowed border border-transparent dark:border-white/10 group overflow-hidden relative"
                  >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    {loading ? (
                      <span className="flex items-center space-x-3 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-cyan-200" />
                        <span className="font-mono uppercase tracking-widest text-cyan-50">Processing...</span>
                      </span>
                    ) : (
                      <span className="uppercase tracking-widest text-sm text-white">Engage Pipeline</span>
                    )}
                  </Button>
                  <Button
                    onClick={clearForm}
                    variant="outline"
                    className="h-14 px-4 rounded-2xl border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 dark:hover:border-rose-900/50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* RIGHT COMPONENT: AI Observability UI */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-7 flex flex-col h-[650px] lg:h-[700px]"
          >
            <div className="h-full bg-slate-900 dark:bg-[#09090b] border border-slate-800 dark:border-white/10 shadow-2xl dark:shadow-black/50 flex flex-col rounded-[2rem] overflow-hidden relative">
              
              {/* Terminal Header */}
              <div className="px-6 py-4 border-b border-slate-800 dark:border-white/5 bg-slate-950/50 dark:bg-white/[0.01] flex items-center justify-between backdrop-blur-md z-20">
                <div className="flex items-center space-x-3">
                  <Terminal className="w-4 h-4 text-cyan-400 dark:text-cyan-500 opacity-80" />
                  <h2 className="font-mono text-slate-200 dark:text-slate-300 text-xs uppercase tracking-widest font-bold">Neural Core Telemetry</h2>
                </div>
                {ticketStatus && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Badge className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border-0 shadow-lg ${
                      ticketStatus === 'AUTO_RESOLVED' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/20' 
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-rose-500/20'
                    }`}>
                      {ticketStatus.replace("_", " ")}
                    </Badge>
                  </motion.div>
                )}
              </div>
              
              {/* Terminal Output */}
              <ScrollArea className="flex-1 bg-transparent p-6 font-mono text-[13px] text-slate-400 custom-scrollbar relative z-10">
                <AnimatePresence>
                  {thoughtProcess.length === 0 && !loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-600 dark:text-slate-600 flex items-center space-x-2">
                      <span className="w-2 h-4 bg-cyan-500/50 animate-pulse block" />
                      <span>Awaiting telemetry stream...</span>
                    </motion.div>
                  )}
                  {thoughtProcess.map((step, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mb-4 flex items-start group"
                    >
                      <span className="text-cyan-500 mr-3 mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity">$&gt;</span> 
                      <span className={`leading-relaxed ${step.includes('✅') ? 'text-emerald-400' : step.includes('⚠') || step.includes('Error') ? 'text-rose-400' : step.includes('⚡') ? 'text-amber-400' : 'text-slate-300'}`}>
                        {step}
                      </span>
                    </motion.div>
                  ))}
                  {loading && thoughtProcess.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center space-x-2 text-cyan-500">
                       <span className="w-2 h-4 bg-cyan-500 animate-pulse block" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </ScrollArea>

              {/* Resolution Panel */}
              <AnimatePresence>
                {finalResolution && (
                  <motion.div 
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className={`p-6 border-t backdrop-blur-2xl relative z-20 ${
                      ticketStatus === 'AUTO_RESOLVED' 
                        ? 'bg-emerald-950/40 border-emerald-500/20' 
                        : 'bg-rose-950/40 border-rose-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {ticketStatus === 'AUTO_RESOLVED' ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                          </div>
                        )}
                        <h3 className={`text-sm uppercase tracking-widest font-bold ${
                          ticketStatus === 'AUTO_RESOLVED' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>Diagnostic Result</h3>
                      </div>
                      
                      {confidenceScore !== null && (
                         <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 flex items-center space-x-2">
                           <span className="text-[9px] uppercase font-bold text-slate-500 tracking-[0.2em]">Conf</span>
                           <span className={`text-xs font-mono font-bold ${confidenceScore >= 0.8 ? 'text-emerald-400' : confidenceScore >= 0.5 ? 'text-amber-400' : 'text-rose-400'}`}>
                             {(confidenceScore * 100).toFixed(1)}%
                           </span>
                         </div>
                      )}
                    </div>
                    
                    <div className={`text-sm leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar pr-2 font-mono ${
                      ticketStatus === 'AUTO_RESOLVED' ? 'text-emerald-100/90' : 'text-rose-100/90'
                    }`}>
                      {/* Very simple markdown rendering (just splitting newlines) for the demo */}
                      {finalResolution.split('\n').map((line, i) => (
                        <p key={i} className="mb-2">{line}</p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.section>

        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
