# Manual Steps (SELF.md)

1. **Create Accounts**: You will need to create free accounts for:
   - Supabase (for PostgreSQL database)
   - Groq (for LLM API)
   - Upstash (for Redis / Rate limiting)
2. **Setup Supabase Schema**: Inside your Supabase SQL Editor, you will need to run the SQL migration I provide.
3. **Environment Variables**: I will setup a `.env.example` file, but you will need to copy it to `.env.local` and add real keys.
