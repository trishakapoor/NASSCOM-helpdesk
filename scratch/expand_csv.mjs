import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => row[h.trim()] = values[idx]);
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function generateVariations(tickets) {
  const userPrefixes = [
    "Hi, I need help with this: ",
    "Urgent issue: ",
    "Can someone look into this? ",
    "We're experiencing: ",
    "Please help - ",
    "Production issue: ",
    "Need assistance with: ",
    "",
  ];

  const envPrefixes = [
    "In our staging environment, ",
    "On the production server, ",
    "In the dev cluster, ",
    "On the QA environment, ",
    "In our cloud infrastructure, ",
    "On the main datacenter, ",
    "",
  ];

  const expanded = [];

  for (const ticket of tickets) {
    // Add original
    expanded.push(ticket);

    // Generate variations
    const numVariations = Math.min(7, Math.ceil(1000 / tickets.length));
    for (let v = 0; v < numVariations; v++) {
      const userP = userPrefixes[Math.floor(Math.random() * userPrefixes.length)];
      const envP = envPrefixes[Math.floor(Math.random() * envPrefixes.length)];

      expanded.push({
        ...ticket,
        title: `${ticket.title} (v${v + 1})`,
        description: `${userP}${envP}${ticket.description}`,
      });
    }
  }

  // Shuffle
  for (let i = expanded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [expanded[i], expanded[j]] = [expanded[j], expanded[i]];
  }

  return expanded.slice(0, 1000); // exactly 1000
}

function escapeCSV(str) {
  if (typeof str !== 'string') return str;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function expand() {
  const csvPath = join(__dirname, '..', 'data', 'synthetic_tickets.csv');
  const csvText = readFileSync(csvPath, 'utf-8');
  const baseTickets = parseCSV(csvText);
  const allTickets = generateVariations(baseTickets);

  const headers = ['title', 'description', 'category', 'resolution', 'priority'];
  let newCsv = headers.join(',') + '\n';
  
  for (const ticket of allTickets) {
    newCsv += headers.map(h => escapeCSV(ticket[h])).join(',') + '\n';
  }

  writeFileSync(csvPath, newCsv);
  console.log(`Generated ${allTickets.length} tickets and saved to synthetic_tickets.csv`);
}

expand().catch(console.error);
