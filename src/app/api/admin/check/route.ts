import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "");
  return NextResponse.json({ isAdmin });
}
