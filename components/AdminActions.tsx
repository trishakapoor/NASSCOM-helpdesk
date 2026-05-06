"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminActions() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleAction = async (action: "clear_history" | "clear_cache") => {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Action failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error performing action");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => handleAction("clear_cache")}
        disabled={loading !== null}
        className="bg-white text-slate-600 border-zinc-200 hover:bg-slate-50 transition-all rounded-xl h-9"
      >
        {loading === "clear_cache" ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <RotateCcw className="w-4 h-4 mr-2" />
        )}
        Clear Cache
      </Button>

      <Button 
        variant="destructive" 
        size="sm"
        onClick={() => {
          if (confirm("Are you sure you want to delete all ticket history? This cannot be undone.")) {
            handleAction("clear_history");
          }
        }}
        disabled={loading !== null}
        className="bg-rose-500 hover:bg-rose-600 text-white border-none transition-all rounded-xl h-9 shadow-sm shadow-rose-200"
      >
        {loading === "clear_history" ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4 mr-2" />
        )}
        Clear History
      </Button>
    </div>
  );
}
