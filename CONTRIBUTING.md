# Contributing to NASSCOM Helpdesk

First off, thank you for considering contributing to the AI IT Helpdesk Agent! It's people like you that make open-source software such a great community.

## 1. Getting Started

- Make sure you have a [GitHub account](https://github.com/join).
- Fork the repository on GitHub.
- Clone your fork locally:
  ```bash
  git clone https://github.com/YOUR_USERNAME/NASSCOM-helpdesk.git
  ```
- Install dependencies:
  ```bash
  npm install
  ```

## 2. Setting Up Your Environment

You will need the following API keys to run the full application:
1. **Groq API Key**: For the LLM inference (Llama 3 70B).
2. **Supabase**: URL and Service Role Key for RAG vector storage.

Copy `.env.example` to `.env.local` and populate it:
```bash
cp .env.example .env.local
```

You must also set up the pgvector schema by executing `supabase/schema.sql` in your Supabase SQL editor.

## 3. Making Changes

- Create a new branch: `git checkout -b my-feature-branch`
- Make your changes in the codebase.
- We use Jest for testing. If you make logic changes, please include tests!
  ```bash
  npm run test
  ```
- Make sure your changes follow our coding style. We use Prettier for code formatting.

## 4. Submitting a Pull Request (PR)

- Push your branch to your fork: `git push origin my-feature-branch`
- Open a Pull Request from your branch to our `main` branch.
- Include a descriptive title and a detailed description of your changes.
- Ensure all CI tests pass.

## 5. Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Need Help?

If you're stuck, feel free to open an issue with the `question` label. We are happy to help!
