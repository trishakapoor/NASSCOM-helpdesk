import Groq from "groq-sdk";
import "dotenv/config";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Output a JSON object with key 'status'." }],
      model: "llama3-70b-8192",
      response_format: { type: "json_object" }
    });
    console.log("Success:", completion.choices[0].message.content);
  } catch (err) {
    console.error("Groq Error:", err.message || err);
  }
}

main();
