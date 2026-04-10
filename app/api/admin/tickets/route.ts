import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from('live_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ tickets: data });
  } catch (err: any) {
    console.error("Error fetching admin tickets:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
