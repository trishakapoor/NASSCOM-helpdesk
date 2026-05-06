import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === "clear_history") {
      if (!supabase) throw new Error("Supabase not initialized");
      
      const { error } = await supabase
        .from("live_tickets")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
      
      revalidatePath("/admin");
      return NextResponse.json({ success: true, message: "History cleared" });
    }

    if (action === "clear_cache") {
      // In this context, clear cache will remove master incidents and anomalies
      if (!supabase) throw new Error("Supabase not initialized");
      
      const { error } = await supabase
        .from("master_incidents")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
      
      revalidatePath("/admin");
      return NextResponse.json({ success: true, message: "Cache/Incidents cleared" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Admin action error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
