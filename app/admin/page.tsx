import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">IT Triage Dashboard</h1>
          <p className="text-slate-400 mt-2">Elite Enterprise Helpdesk View</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* NEEDS HUMAN */}
          <section>
            <div className="flex items-center space-x-2 mb-4">
              <h2 className="font-semibold text-lg text-rose-500">Needs Human</h2>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                {needsHuman.length}
              </Badge>
            </div>
            <ScrollArea className="h-[75vh] pe-4">
              <div className="space-y-4">
                {needsHuman.map((ticket, i) => (
                  <TicketCard key={ticket.id || i} ticket={ticket} />
                ))}
                {needsHuman.length === 0 && <p className="text-slate-500 text-sm">No critical tickets.</p>}
              </div>
            </ScrollArea>
          </section>

          {/* AUTO RESOLVED */}
          <section>
             <div className="flex items-center space-x-2 mb-4">
              <h2 className="font-semibold text-lg text-emerald-400">Auto-Resolved</h2>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                {autoResolved.length}
              </Badge>
            </div>
            <ScrollArea className="h-[75vh] pe-4">
               <div className="space-y-4">
                {autoResolved.map((ticket, i) => (
                  <TicketCard key={ticket.id || i} ticket={ticket} />
                ))}
                {autoResolved.length === 0 && <p className="text-slate-500 text-sm">No resolved tickets.</p>}
              </div>
            </ScrollArea>
          </section>

          {/* AUTOMATION CANDIDATES */}
          <section>
             <div className="flex items-center space-x-2 mb-4">
              <h2 className="font-semibold text-lg text-cyan-500">Automation Candidates</h2>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                {automationCandidates.length}
              </Badge>
            </div>
            <ScrollArea className="h-[75vh] pe-4">
               <div className="space-y-4">
                {automationCandidates.map((ticket, i) => (
                  <TicketCard key={ticket.id || i} ticket={ticket} />
                ))}
                {automationCandidates.length === 0 && <p className="text-slate-500 text-sm">No candidates.</p>}
              </div>
            </ScrollArea>
          </section>

        </div>
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: any }) {
  const isDanger = ticket.status === "NEEDS_HUMAN";
  return (
    <Card className="bg-slate-900 border-slate-800 shadow-sm text-slate-200">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <Badge className={isDanger ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 shadow-none border-none" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 shadow-none border-none"}>
          {ticket.category}
        </Badge>
        <span className="text-xs text-slate-500">
          Confidence: {ticket.confidence_score?.toFixed(2) || '0.00'}
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-mono text-slate-300 line-clamp-3">
          {ticket.original_redacted_text}
        </p>
      </CardContent>
    </Card>
  );
}
