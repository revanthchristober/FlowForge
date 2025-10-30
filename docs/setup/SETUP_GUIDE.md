# FlowForge Demo - Complete Setup Guide

> **Verified against official documentation via Context7 MCP** ✅

## 🎯 Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** installed
- **npm** or **pnpm** package manager
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))

## 📦 Step 1: Install Dependencies

```bash
# Navigate to project directory
cd flowforge-demo

# Install all dependencies
npm install
```

**Expected output:**
```
added 311 packages
```

**What gets installed:**
- `next` - Next.js framework
- `ai` - Vercel AI SDK core
- `@ai-sdk/openai` - OpenAI provider for AI SDK
- `inngest` - Inngest SDK for durable workflows
- `react` & `react-dom` - React framework
- TypeScript types and tools

---

## 🔑 Step 2: Configure Environment Variables

### Create `.env.local` File

According to official AI SDK docs, create a `.env.local` file in the project root:

```bash
touch .env.local
```

### Add Your OpenAI API Key

Open `.env.local` and add:

```env
# Required: OpenAI API Key
# Get yours at: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-actual-openai-key-here

# Optional: Inngest Keys (not needed for local development)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

**Important Notes:**
- ✅ **DO**: Replace `sk-your-actual-openai-key-here` with your real OpenAI API key
- ❌ **DON'T**: Commit `.env.local` to git (already in `.gitignore`)
- ✅ **DO**: Keep your API keys secret
- ❌ **DON'T**: Share your `.env.local` file

### Where to Get API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Paste it in `.env.local`

**Inngest Keys (Optional for Local Dev):**
- For local development, you **don't need** Inngest keys
- Inngest Dev Server runs without authentication
- For production deployment, get keys at https://app.inngest.com

---

## 🚀 Step 3: Start Development Servers

You need to run **TWO servers** simultaneously:

### Terminal 1: Next.js Development Server

```bash
npm run dev
```

**Expected output:**
```
▲ Next.js 15.1.0
- Local:        http://localhost:3000
- Environments: .env.local

✓ Starting...
✓ Ready in 2.3s
```

**What this does:**
- Starts Next.js on http://localhost:3000
- Serves API routes:
  - `/api/chat` - Chat endpoint with AI streaming
  - `/api/inngest` - Inngest function endpoint
- Hot-reloads on file changes

### Terminal 2: Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

**Expected output:**
```
Inngest Dev Server
  http://localhost:8288

Discovering functions...
  ✓ Found 1 function from http://localhost:3000/api/inngest

  saveMemoryFunction - Listening for: memory.save

Dev server ready! 🎉
```

**What this does:**
- Starts Inngest Dev Server on http://localhost:8288
- Provides UI dashboard for monitoring functions
- Auto-discovers functions from Next.js
- Shows execution logs and traces
- Enables local testing without cloud deployment

---

## 🧪 Step 4: Verify Setup

### Method 1: Check Server Status

**Check Next.js:**
```bash
curl http://localhost:3000
```
Should return HTML or Next.js response.

**Check Inngest Dashboard:**
Open browser: http://localhost:8288

You should see:
- Inngest Dev Server UI
- "Functions" tab showing `saveMemoryFunction`
- Event logs (initially empty)

### Method 2: Test Chat API

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, what is FlowForge?"}
    ]
  }'
```

**Expected behavior:**
1. ✅ Streaming response from OpenAI
2. ✅ Console log: `💬 Chat completed`
3. ✅ Console log: `📤 Memory save events sent to Inngest`
4. ✅ New file created: `memory.json`
5. ✅ Inngest dashboard shows function runs

### Method 3: Check Memory Storage

```bash
cat memory.json
```

**Expected output:**
```json
{"id":"1730000000000","timestamp":1730000000000,"text":"Hello, what is FlowForge?","metadata":{"role":"user","timestamp":"2025-10-29T..."}}
{"id":"1730000000001","timestamp":1730000000001,"text":"FlowForge is a...","metadata":{"role":"assistant","timestamp":"2025-10-29T..."}}
```

---

## 🔍 Step 5: Verify Inngest Integration

### Open Inngest Dashboard

Navigate to: http://localhost:8288

### Check Functions Tab

You should see:
- **Function Name**: `Save Memory`
- **Event**: `memory.save`
- **Status**: Active

### Trigger a Test Event

Click on "Functions" → "Save Memory" → "Test"

Or send via curl:
```bash
curl -X POST http://localhost:8288/e/flowforge-demo \
  -H "Content-Type: application/json" \
  -d '{
    "name": "memory.save",
    "data": {
      "text": "Test memory item",
      "role": "user"
    }
  }'
```

**Expected:**
1. Event appears in dashboard
2. Function executes
3. New line in `memory.json`
4. Success status in dashboard

---

## 📊 Understanding the Environment

### Environment Variables Explained

According to official docs:

**`OPENAI_API_KEY`** (Required)
- Used by: `@ai-sdk/openai` provider
- Purpose: Authenticate with OpenAI API
- Auto-detected: AI SDK automatically reads this variable
- Format: Starts with `sk-`

**`INNGEST_EVENT_KEY`** (Optional for local dev)
- Used by: Inngest SDK for production
- Purpose: Authenticate event sending to Inngest Cloud
- Not needed: Local dev server doesn't require authentication
- Get it at: https://app.inngest.com

**`INNGEST_SIGNING_KEY`** (Optional for local dev)
- Used by: Inngest SDK for production
- Purpose: Verify function endpoints
- Not needed: Local dev mode auto-generates keys
- Get it at: https://app.inngest.com

### Inngest Dev Server Configuration

The Inngest dev server uses these defaults (from official docs):

```text
API Origin: http://localhost:8288
Event ingestion endpoint: http://localhost:8288/e/:event_key
```

You can override with environment variables:
```bash
# Custom dev server URL
INNGEST_DEV=http://example.com

# Custom API endpoint
INNGEST_API_ORIGIN=http://localhost:8288
```

---

## 🐛 Troubleshooting

### Issue: "OPENAI_API_KEY is not defined"

**Solution:**
1. Check `.env.local` exists in project root
2. Verify the key starts with `sk-`
3. Restart Next.js server: `npm run dev`
4. Ensure no typos in variable name (exact: `OPENAI_API_KEY`)

### Issue: "Cannot connect to Inngest"

**Solution:**
1. Start Inngest dev server: `npx inngest-cli@latest dev`
2. Check http://localhost:8288 loads
3. Verify Next.js is running on port 3000
4. Check firewall settings

### Issue: "Inngest functions not discovered"

**Solution:**
1. Ensure Next.js is running BEFORE starting Inngest
2. Check `/api/inngest` route exists
3. Visit http://localhost:3000/api/inngest in browser
4. Restart Inngest dev server
5. Look for discovery logs in Inngest terminal

### Issue: "Module not found"

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Port 3000 already in use"

**Solution:**
```bash
# Option 1: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use different port
PORT=3001 npm run dev
```

### Issue: "memory.json not created"

**Solution:**
1. Check Inngest dev server is running
2. Send a test chat message
3. Check Inngest dashboard for function execution
4. Look for errors in terminal logs
5. Verify file permissions in project directory

---

## 🎓 Configuration Best Practices

Based on official documentation:

### ✅ DO:
- Store sensitive keys in `.env.local`
- Use different keys for dev/staging/production
- Restart servers after changing `.env.local`
- Keep `.env.local` in `.gitignore`
- Use `.env.example` for team documentation

### ❌ DON'T:
- Commit `.env.local` to version control
- Share API keys in public repos
- Hardcode keys in source files
- Use production keys in development
- Store keys in frontend code

---

## 📋 Setup Checklist

Before proceeding to frontend development:

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` created
- [ ] OpenAI API key added to `.env.local`
- [ ] Next.js running on http://localhost:3000
- [ ] Inngest running on http://localhost:8288
- [ ] Chat API test successful
- [ ] `memory.json` file created
- [ ] Inngest dashboard shows functions
- [ ] No errors in terminal logs

---

## 🚀 Next Steps

Once setup is complete:

1. **Build Frontend** - Create chat UI with `useChat()` hook
2. **Test End-to-End** - Send messages, verify streaming
3. **Explore Inngest** - View function runs in dashboard
4. **Add Features** - Implement more workflows
5. **Deploy** - Ship to Vercel + Inngest Cloud

---

## 📚 Official Documentation References

This guide is verified against:

- **AI SDK Setup**: https://sdk.vercel.ai/docs/getting-started
- **Inngest Local Dev**: https://www.inngest.com/docs/local-development
- **Next.js Environment Variables**: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables

**Verified via Context7 MCP** ✅

---

## 🆘 Need Help?

If you encounter issues:

1. Check error messages in both terminal windows
2. Review this guide's troubleshooting section
3. Visit Inngest dashboard for function logs
4. Check OpenAI API key validity
5. Ensure all servers are running

---

**Setup complete!** You're ready to build with FlowForge! 🎉
