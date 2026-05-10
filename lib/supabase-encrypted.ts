// lib/supabase-encrypted.ts
import { createClient } from "@supabase/supabase-js";
import { encryptFields, decryptFields } from "./encryption";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIVE_TICKET_SENSITIVE_FIELDS = ["original_redacted_text"];
const HISTORICAL_TICKET_SENSITIVE_FIELDS = ["sanitized_query", "resolution_steps"];
const MASTER_INCIDENT_SENSITIVE_FIELDS = [
  "triggering_ticket_text",
  "incident_summary",
  "mass_communication_draft",
  "remediation_runbook",
];

export async function insertLiveTicket(ticket: Record<string, unknown>) {
  const encrypted = await encryptFields(ticket, LIVE_TICKET_SENSITIVE_FIELDS);
  const { data, error } = await supabase
    .from("live_tickets")
    .insert(encrypted)
    .select()
    .single();
  if (error) throw error;
  return decryptFields(data, LIVE_TICKET_SENSITIVE_FIELDS);
}

export async function getLiveTicket(id: string) {
  const { data, error } = await supabase
    .from("live_tickets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return decryptFields(data, LIVE_TICKET_SENSITIVE_FIELDS);
}

export async function getAllLiveTickets() {
  const { data, error } = await supabase
    .from("live_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    data.map((row) => decryptFields(row, LIVE_TICKET_SENSITIVE_FIELDS))
  );
}

export async function insertHistoricalTicket(ticket: Record<string, unknown>) {
  const encrypted = await encryptFields(ticket, HISTORICAL_TICKET_SENSITIVE_FIELDS);
  const { data, error } = await supabase
    .from("historical_tickets")
    .insert(encrypted)
    .select()
    .single();
  if (error) throw error;
  return decryptFields(data, HISTORICAL_TICKET_SENSITIVE_FIELDS);
}

export async function getHistoricalTicket(id: string) {
  const { data, error } = await supabase
    .from("historical_tickets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return decryptFields(data, HISTORICAL_TICKET_SENSITIVE_FIELDS);
}

export async function insertMasterIncident(incident: Record<string, unknown>) {
  const encrypted = await encryptFields(incident, MASTER_INCIDENT_SENSITIVE_FIELDS);
  const { data, error } = await supabase
    .from("master_incidents")
    .insert(encrypted)
    .select()
    .single();
  if (error) throw error;
  return decryptFields(data, MASTER_INCIDENT_SENSITIVE_FIELDS);
}

export async function getMasterIncident(id: string) {
  const { data, error } = await supabase
    .from("master_incidents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return decryptFields(data, MASTER_INCIDENT_SENSITIVE_FIELDS);
}

export async function getAllMasterIncidents() {
  const { data, error } = await supabase
    .from("master_incidents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    data.map((row) => decryptFields(row, MASTER_INCIDENT_SENSITIVE_FIELDS))
  );
}