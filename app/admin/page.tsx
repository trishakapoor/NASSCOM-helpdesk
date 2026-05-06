import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, AlertCircle, CheckCircle2, Zap } from "lucide-react";

import { AdminActions } from "@/components/AdminActions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let tickets = [];
  try {
    if (supabase) {
      const { data } = await supabase
        .from("live_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) tickets = data;
    }
  } catch (err) {
    console.error("Error fetching tickets array", err);
  }

  const autoResolved = tickets.filter(t => t.status === "AUTO_RESOLVED");
  const needsHuman = tickets.filter(t => t.status === "NEEDS_HUMAN" && t.confidence_score < 0.85);
  const automationCandidates = tickets.filter(t => t.status === "NEEDS_HUMAN" && t.confidence_score >= 0.85);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between pb-8 border-b border-slate-200">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
              <LayoutDashboard className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Neural Triage</h1>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                  Council Admin
                </Badge>
              </div>
              <p className="text-slate-500 mt-1 font-medium text-sm flex items-center">
                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                Live Network Monitoring · {tickets.length} total events
              </p>
            </div>
          </div>
          
          <div className="mt-6 md:mt-0">
            <AdminActions />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* NEEDS HUMAN */}
          <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200/60">
            <div className="flex items-center justify-between mb-5 px-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h2 className="font-bold text-slate-800">Needs Human</h2>
              </div>
              <Badge className="bg-white text-slate-800 shadow-sm border-zinc-200 px-2 py-0.5">
                {needsHuman.length}
              </Badge>
            </div>
            <ScrollArea className="h-[70vh] px-2 pb-6">
              <div className="space-y-4">
                {needsHuman.map((ticket, i) => (
                  <TicketCard key={ticket.id || i} ticket={ticket} type="danger" />
                ))}
                {needsHuman.length === 0 && (
                  <div className="bg-white/50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                    <p className="text-slate-500 text-sm font-medium">Clear queue. No critical tickets.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>

          {/* AUTO RESOLVED */}
          <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200/60">
             <div className="flex items-center justify-between mb-5 px-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-slate-800">Auto-Resolved</h2>
              </div>
              <Badge className="bg-white text-slate-800 shadow-sm border-zinc-200 px-2 py-0.5">
                {autoResolved.length}
              </Badge>
            </div>
            <ScrollArea className="h-[70vh] px-2 pb-6">
               <div className="space-y-4">
                {autoResolved.map((ticket, i) => (
                  <TicketCard key={ticket.id || i} ticket={ticket} type="success" />
                ))}
                {autoResolved.length === 0 && (
                  <div className="bg-white/50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                    <p className="text-slate-500 text-sm font-medium">No resolved tickets yet.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>

          {/* AUTOMATION CANDIDATES */}
          <section className="bg-slate-100/50 p-4 rounded-3xl border border-slate-200/60">
             <div className="flex items-center justify-between mb-5 px-2">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-slate-800">Automation Candidates</h2>
              </div>
              <Badge className="bg-white text-slate-800 shadow-sm border-zinc-200 px-2 py-0.5">
                {automationCandidates.length}
              </Badge>
            </div>
            <ScrollArea className="h-[70vh] px-2 pb-6">
               <div className="space-y-4">
                {automationCandidates.map((ticket, i) => (
                  <TicketCard key={ticket.id || i} ticket={ticket} type="candidate" />
                ))}
                {automationCandidates.length === 0 && (
                   <div className="bg-white/50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                     <p className="text-slate-500 text-sm font-medium">No candidates identified.</p>
                   </div>
                )}
              </div>
            </ScrollArea>
          </section>

        </div>
      </div>
    </div>
  );
}

function TicketCard({ ticket, type }: { ticket: any, type: "danger" | "success" | "candidate" }) {
  
  let badgeStyle = "";
  let glowStyle = "";
  if (type === "danger") {
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-100 group-hover:bg-rose-100 transition-colors";
    glowStyle = "border-l-4 border-l-rose-500";
  }
  if (type === "success") {
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:bg-emerald-100 transition-colors";
    glowStyle = "border-l-4 border-l-emerald-500";
  }
  if (type === "candidate") {
    badgeStyle = "bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-100 transition-colors";
    glowStyle = "border-l-4 border-l-blue-500";
  }

  return (
    <Card className={`group bg-white border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl ${glowStyle}`}>
      <CardHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between bg-slate-50/40">
        <div className="flex space-x-2">
          <Badge variant="outline" className={badgeStyle}>
            {ticket.category || "Uncategorized"}
          </Badge>
          {ticket.priority && (
            <Badge variant="outline" className="text-[9px] uppercase border-slate-200 bg-white font-bold text-slate-500 tracking-tighter">
              {ticket.priority}
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase tracking-widest font-black text-slate-300">Confidence</span>
          <span className={`text-sm font-mono font-black ${type === 'success' ? 'text-emerald-600' : 'text-slate-700'}`}>
            {(ticket.confidence_score * 100).toFixed(0)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 font-medium italic opacity-80">
          "{ticket.original_redacted_text}"
        </p>
        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <span>{ticket.created_at ? new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</span>
          <span>ID: {ticket.id?.slice(0, 8) || 'Temp'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

