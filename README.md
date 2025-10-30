# FlowForge Demo

> A low-friction studio for composing LLM flows with agents, memory, and durable workflows.

## 🎯 What is This?

FlowForge is a prototype demonstrating how to build AI-powered applications with:
- **Streaming AI chat** using Vercel AI SDK
- **Durable background workflows** using Inngest
- **Persistent memory** for context-aware conversations

This demo shows the core loop:
1. User sends a message
2. AI responds with streaming (using memory context)
3. Conversation is saved asynchronously via Inngest
4. Memory persists across sessions

## 🏗️ Architecture

```
User → Chat UI → /api/chat → OpenAI (streaming)
                    ↓
                Inngest Event (memory.save)
                    ↓
                Background Function
                    ↓
                memory.json (persistent storage)
```

## 📦 Tech Stack

- **Frontend & Server**: Next.js 15 (App Router)
- **AI SDK**: Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- **Background Jobs**: Inngest (durable functions)
- **Memory**: JSON file (upgradeable to vector DB)
- **Runtime**: Edge runtime for chat API

## 🚀 Getting Started

> **📖 Detailed Setup Instructions**: See [docs/setup/SETUP_GUIDE.md](docs/setup/SETUP_GUIDE.md) for complete step-by-step setup with troubleshooting.

### Quick Start

1. **Install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-key-here
```

3. **Run the development server:**

```bash
npm run dev
```

4. **In a separate terminal, start Inngest Dev Server:**

```bash
npx inngest-cli@latest dev
```

This will:
- Start Inngest dev server at http://localhost:8288
- Automatically discover your functions at http://localhost:3000/api/inngest
- Provide a UI to view function runs and logs

5. **Open the app:**

Navigate to http://localhost:3000

## 📁 Backend Structure

```
├── app/
│   └── api/
│       ├── chat/
│       │   └── route.ts          # Chat API with AI streaming
│       └── inngest/
│           └── route.ts          # Inngest function endpoint
├── lib/
│   ├── inngest/
│   │   ├── client.ts            # Inngest client initialization
│   │   └── functions.ts         # Inngest durable functions
│   └── memory/
│       └── store.ts             # Memory persistence layer
└── memory.json                  # Auto-generated storage file
```

## 🔧 Backend Components

### 1. Memory Store (`lib/memory/store.ts`)

Handles persistent storage of conversation history:

```typescript
// Get memory (with optional filtering)
getMemory(query?: string): string[]

// Add new memory item
addMemory(item: { text: string, metadata?: any }): MemoryItem

// Get all memory
getAllMemory(): MemoryItem[]
```

### 2. Inngest Client (`lib/inngest/client.ts`)

Initializes the Inngest client for the app.

### 3. Inngest Functions (`lib/inngest/functions.ts`)

Defines durable background functions:

- **`saveMemoryFunction`**: Listens to `memory.save` events and persists conversation data

### 4. Chat API (`app/api/chat/route.ts`)

Main chat endpoint that:
1. Reads relevant memory context
2. Streams AI responses using AI SDK
3. Fires Inngest events on completion
4. Handles errors gracefully

## 🧪 Testing the Backend

### Test Chat API

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, what is FlowForge?"}
    ]
  }'
```

### Test Inngest Function

Send a test event:

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

Check `memory.json` - you should see a new entry.

### View Inngest Dashboard

Open http://localhost:8288 to:
- View function runs
- See execution logs
- Debug failures
- Retry failed runs

## 🎯 How It Works

### Memory Context Flow

1. User asks: "My name is Alice"
2. AI responds and conversation is saved
3. User asks: "What's my name?"
4. Chat API reads memory, finds "Alice"
5. AI uses context to respond correctly

### Inngest Durable Execution

- **Automatic retries**: If saving fails, Inngest retries automatically
- **Step functions**: Multi-step workflows with guaranteed execution
- **Observability**: Full logs and traces in Inngest dashboard
- **Local dev**: Test background jobs without cloud deployment

## 🔑 Key Features

✅ **Streaming responses** - Real-time AI chat with `streamText()`
✅ **Memory persistence** - Context-aware conversations
✅ **Durable workflows** - Inngest handles retries and failures
✅ **Edge runtime** - Fast, globally distributed API
✅ **Type-safe** - Full TypeScript support
✅ **Local development** - Test everything locally

## 📊 Memory Format

Memory is stored in `memory.json` as newline-delimited JSON:

```json
{"id":"1234567890","timestamp":1234567890,"text":"Hello","metadata":{"role":"user"}}
{"id":"1234567891","timestamp":1234567891,"text":"Hi there!","metadata":{"role":"assistant"}}
```

## 🚀 Next Steps

1. **Add frontend** - Build chat UI with `useChat()` hook
2. **Vector DB** - Replace JSON with Pinecone/Weaviate for semantic search
3. **More functions** - Add summarization, extraction workflows
4. **Visual flow editor** - Drag-drop interface for composing flows
5. **Deploy** - Ship to Vercel + Inngest Cloud

## 📚 Documentation

### Setup & Getting Started
- [Setup Guide](docs/setup/SETUP_GUIDE.md) - Complete setup instructions
- [Quick Start](docs/setup/QUICK_START.md) - Fast setup for experienced devs

### Technical Documentation
- [Backend Complete](docs/technical/BACKEND_COMPLETE.md) - Technical overview
- [Improvements](docs/technical/IMPROVEMENTS.md) - Recent fixes and updates
- [Verification](docs/technical/VERIFICATION_COMPLETE.md) - Code quality verification

### Reference
- [Quick Reference](docs/reference/QUICK_REFERENCE.md) - Commands and URLs cheat sheet
- [API Tests](docs/reference/API_TESTS.md) - Comprehensive curl test suite
- [Final Test Results](docs/reference/FINAL_TEST_RESULTS.md) - Complete test verification (all passing ✅)

### External Resources
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [Inngest Docs](https://www.inngest.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)

## 🤝 Contributing

This is a demo project. Feel free to fork and experiment!

## 📄 License

MIT
