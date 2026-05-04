import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Setup Discord Client
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const LOCAL_API_URL = 'http://localhost:3000/api/process-ticket';

client.on('ready', () => {
    console.log(`🤖 Omnichannel Discord Agent logged in as ${client.user.tag}!`);
    console.log(`Listening for IT Helpdesk complaints...`);
});

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Trigger word: !ticket or just listening to a specific channel
    if (message.content.startsWith('!ticket ')) {
        const userComplaint = message.content.replace('!ticket ', '');
        
        // Let the user know the AI is processing
        const loadingMsg = await message.reply('🧠 Analyzing issue and searching runbooks...');

        try {
            // Forward the raw text to our local Next.js AI pipeline
            const response = await fetch(LOCAL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: userComplaint })
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();

            // Construct an Enterprise-grade Discord Embed
            const embed = new EmbedBuilder()
                .setTitle(`Ticket Processed: ${data.category}`)
                .setColor(data.status === 'AUTO_RESOLVED' ? '#10b981' : '#f59e0b')
                .addFields(
                    { name: 'Priority', value: data.priority || 'Medium', inline: true },
                    { name: 'Confidence Score', value: `${(data.confidenceScore * 100).toFixed(1)}%`, inline: true },
                    { name: 'Status', value: data.status, inline: true },
                    { name: 'PII Redacted Input', value: `> ${data.sanitizedText.substring(0, 200)}...` }
                )
                .setTimestamp()
                .setFooter({ text: 'AI Powered Helpdesk Agent' });

            if (data.status === 'AUTO_RESOLVED' && data.resolution) {
                // Discord limits embed fields to 1024 chars, so we truncate if necessary
                const resolutionText = data.resolution.length > 1000 
                    ? data.resolution.substring(0, 1000) + '...' 
                    : data.resolution;
                embed.addFields({ name: 'Automated Runbook', value: resolutionText });
            } else {
                embed.addFields({ name: 'Human Escalation Required', value: 'This issue was too complex or ambiguous. Routing to the L2 queue.' });
            }

            // Check for Agentic Anomaly Detection
            if (data.automationSuggested) {
                embed.addFields({ 
                    name: '⚠️ Widespread Outage Detected', 
                    value: `Vector search identified ${data.repeatCount} similar tickets recently. A Master Incident has been drafted.` 
                });
            }

            await loadingMsg.edit({ content: `<@${message.author.id}> Your ticket has been processed.`, embeds: [embed] });

        } catch (err) {
            console.error("Discord Bot API Error:", err);
            await loadingMsg.edit('❌ Core ML Pipeline is down or unreachable. Make sure `npm run dev` is running on port 3000.');
        }
    }
});

if (!DISCORD_TOKEN) {
    console.warn("⚠ DISCORD_BOT_TOKEN not found in .env.local. Bot will not start.");
} else {
    client.login(DISCORD_TOKEN);
}
