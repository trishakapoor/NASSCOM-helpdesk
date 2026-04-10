import { createClient } from '@supabase/supabase-js';
import { pipeline, env } from '@xenova/transformers';
import 'dotenv/config';

env.allowLocalModels = true;
env.useBrowserCache = false;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dummyTickets = [
  {
    category: "Database",
    sanitized_query: "The production DB is locking up, my IP is [REDACTED_IP].",
    resolution_steps: "1. Terminated long-running analytics queries.\n2. Scaled read replicas.\n3. Verified instance vitals."
  },
  {
    category: "Access Management",
    sanitized_query: "I need access to the AWS billing dashboard. My manager is [REDACTED_NAME].",
    resolution_steps: "1. Verified [REDACTED_NAME] approval.\n2. Added user to IAM 'Billing_ReadOnly' group.\n3. Verified access via SSO."
  },
  {
    category: "Network",
    sanitized_query: "VPN is disconnecting every 5 minutes from [REDACTED_IP].",
    resolution_steps: "1. Checked VPN Gateway logs for [REDACTED_IP].\n2. Found MTU size mismatch.\n3. Updated client VPN profile with correct MTU and TLS options."
  },
  {
    category: "Application",
    sanitized_query: "The internal CRM is throwing a 500 error when saving leads for [REDACTED_EMAIL].",
    resolution_steps: "1. Traced 500 error to a null pointer in the LeadController.\n2. Restarted the secondary CRM pod.\n3. Cleared user cache for [REDACTED_EMAIL]."
  },
  {
    category: "Security",
    sanitized_query: "My antivirus caught a suspicious executable downloaded from a spear-phishing email.",
    resolution_steps: "1. Executable quarantined automatically.\n2. Triggered a full system malware scan via CrowdStrike.\n3. Reset Active Directory password."
  },
  {
    category: "Infrastructure",
    sanitized_query: "Jenkins build node 14 is out of disk space.",
    resolution_steps: "1. Pruned old Docker images (`docker image prune -a`).\n2. Deleted orphaned workspace directories.\n3. Expanded EBS volume by 50GB."
  }
];

async function seed() {
  console.log("Loading embedding model...");
  const embed = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { quantized: true });
  console.log("Model loaded.");

  for (const ticket of dummyTickets) {
    console.log(`Processing ticket: ${ticket.sanitized_query}`);
    const output = await embed(ticket.sanitized_query, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    const { error } = await supabase.from('historical_tickets').insert({
      category: ticket.category,
      sanitized_query: ticket.sanitized_query,
      resolution_steps: ticket.resolution_steps,
      embedding: embedding
    });

    if (error) {
      console.error("Error inserting:", error);
    } else {
      console.log("Inserted successfully!");
    }
  }

  console.log("Seeding complete. Inserted mock variations.");
}

seed().catch(console.error);
