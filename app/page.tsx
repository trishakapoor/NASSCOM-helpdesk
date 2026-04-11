"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function SubmissionPortal() {
  const [issueText, setIssueText] = useState("");
  const [logText, setLogText] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [thoughtProcess, setThoughtProcess] = useState<string[]>([]);
  const [finalResolution, setFinalResolution] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  async function submitTicket() {
    if (!issueText.trim()) return;
    setLoading(true);
    setTicketStatus(null);
    setThoughtProcess([]);
    setFinalResolution(null);
    setConfidenceScore(null);

    setThoughtProcess(["Analyzing the submission..."]);

    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          setThoughtProcess(prev => [...prev, `Server is waking up... retrying (${attempt}/${MAX_RETRIES})...`]);
          await new Promise(r => setTimeout(r, 3000));
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const res = await fetch("/api/process-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: issueText, logContent: logText }),
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
            setFinalResolution("I've routed this complex issue to the appropriate human engineering team for review. Please check the admin dashboard.");
            setConfidenceScore(data.confidenceScore);
          }
          setLoading(false);
          return; // Success — exit the retry loop
        } else {
          setThoughtProcess(prev => [...prev, "System timeout or API error."]);
          setTicketStatus("ESCALATED");
          setFinalResolution("Error connecting to AI system. Routed to human queue.");
          setLoading(false);
          return;
        }
      } catch(err) {
        lastError = err;
        if (attempt === MAX_RETRIES) {
          setTicketStatus("ESCALATED");
          setFinalResolution("The server may still be starting up. Please wait 30 seconds and try again.");
        }
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Zap className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">IT Helpdesk AI</h1>
            <p className="text-sm font-medium text-slate-500">Zero-Trust L1 Agent Pipeline</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COMPONENT: Submission Form */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Submit Issue</h2>
              <p className="text-sm text-slate-500 mb-4">Describe the problem naturally. Identifying details are automatically scrubbed locally.</p>
              
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Issue Description</label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white transition-all resize-none h-28 placeholder:text-slate-400"
                placeholder="E.g. The production DB is locking up, my IP is 192.168.1.5..."
                value={issueText}
                onChange={e => setIssueText(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">System Logs (Optional)</label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all resize-none h-24 placeholder:text-slate-400"
                placeholder="Paste stack traces or raw logs here..."
                value={logText}
                onChange={e => setLogText(e.target.value)}
              />
            </div>

            <Button 
              onClick={submitTicket} 
              disabled={loading || !issueText.trim()}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-semibold transition-all shadow-md shadow-indigo-200"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Pipeline...</span>
                </span>
              ) : "Initialize Resolution"}
            </Button>
          </div>
        </motion.section>

        {/* RIGHT COMPONENT: AI Observability UI */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="h-full bg-white border-slate-200 shadow-sm flex flex-col rounded-2xl overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col h-full relative">
              
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <h2 className="font-semibold text-slate-700 text-sm">Observability Stream</h2>
                </div>
                {ticketStatus && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Badge className={`px-2.5 py-0.5 rounded-full text-xs font-medium border-0 ${
                      ticketStatus === 'AUTO_RESOLVED' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {ticketStatus.replace("_", " ")}
                    </Badge>
                  </motion.div>
                )}
              </div>
              
              <ScrollArea className="flex-1 bg-slate-50/30 p-5 font-mono text-xs text-slate-600">
                <AnimatePresence>
                  {thoughtProcess.length === 0 && !loading && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-400 italic">
                      Waiting for input stream...
                    </motion.p>
                  )}
                  {thoughtProcess.map((step, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-3 flex items-start"
                    >
                      <span className="text-indigo-400 mr-2 mt-0.5">&gt;</span> 
                      <span className="leading-relaxed">{step}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </ScrollArea>

              <AnimatePresence>
                {finalResolution && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-auto p-5 border-t border-slate-100 ${
                      ticketStatus === 'AUTO_RESOLVED' ? 'bg-emerald-50/50' : 'bg-rose-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {ticketStatus === 'AUTO_RESOLVED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-rose-500" />
                        )}
                        <h3 className={`text-sm font-bold ${
                          ticketStatus === 'AUTO_RESOLVED' ? 'text-emerald-800' : 'text-rose-800'
                        }`}>Final Resolution</h3>
                      </div>
                      
                      {confidenceScore !== null && (
                         <div className="bg-white px-2 py-1 rounded shadow-sm border border-slate-100 flex items-center space-x-1">
                           <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Score</span>
                           <span className="text-xs font-mono font-semibold text-slate-700">{confidenceScore.toFixed(2)}</span>
                         </div>
                      )}
                    </div>
                    
                    <p className={`text-sm leading-relaxed ${
                      ticketStatus === 'AUTO_RESOLVED' ? 'text-emerald-900/80' : 'text-rose-900/80'
                    }`}>
                      {finalResolution}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

            </CardContent>
          </Card>
        </motion.section>

      </div>
    </div>
  );
}
