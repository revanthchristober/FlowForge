# FlowForge Backend - Quick Start Guide 🚀

## 🎯 What You Have

A **complete, production-ready backend** for FlowForge featuring:

- ✅ Streaming AI chat (OpenAI + AI SDK)
- ✅ Durable background jobs (Inngest)
- ✅ Persistent memory system
- ✅ Full TypeScript support
- ✅ Error handling & logging

## ⚡ Start in 3 Steps

### 1. Add Your OpenAI API Key

Edit `.env.local`:

```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

### 2. Start Both Servers

**Terminal 1** - Next.js:
```bash
npm run dev
```

**Terminal 2** - Inngest:
```bash
npx inngest-cli@latest dev
```

### 3. Test It

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## 📊 What Happens

1. **Chat API receives** your message
2. **Reads memory** for context
3. **Streams response** from OpenAI
4. **Fires Inngest event** when done
5. **Background function** saves to `memory.json`
6. **View logs** at http://localhost:8288

## 🔍 Check Results

**Memory saved?**
```bash
cat memory.json
```

**Inngest dashboard:**
Open http://localhost:8288

**Next.js logs:**
Check Terminal 1 for 💬 and 📤 emojis

## 🏗️ Architecture

```
POST /api/chat
     ↓
Read memory context
     ↓
Stream OpenAI response → User
     ↓
Fire Inngest event (async)
     ↓
Background function runs
     ↓
Save to memory.json
     ↓
✅ Done!
```

## 📁 Backend Files

```
app/api/
  ├── chat/route.ts       → Main chat endpoint
  └── inngest/route.ts    → Inngest function server

lib/
  ├── inngest/
  │   ├── client.ts       → Inngest initialization
  │   └── functions.ts    → saveMemoryFunction
  └── memory/
      └── store.ts        → Memory CRUD operations
```

## 🧪 Test Scenarios

### Scenario 1: First Message
```bash
# Send message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "My name is Alice"}]}'

# Check memory
cat memory.json
# Should see: {"text":"My name is Alice",...}
```

### Scenario 2: Memory Recall
```bash
# Send another message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is my name?"}]}'

# AI should use memory context to say "Alice"
```

### Scenario 3: View Inngest Logs
1. Open http://localhost:8288
2. Click on "Functions"
3. See "Save Memory" runs
4. Click any run to see step-by-step logs

## 🐛 Troubleshooting

### "OPENAI_API_KEY not found"
- Check `.env.local` has your key
- Restart `npm run dev`

### "Cannot connect to Inngest"
- Start Inngest dev server: `npx inngest-cli@latest dev`
- Check http://localhost:8288 loads

### "Module not found"
```bash
npm install
```

### "memory.json not created"
- Check Inngest is running
- Check Terminal 2 for function logs
- Inngest must discover functions from Next.js

## 🎓 Key Concepts

### AI SDK (`streamText`)
```typescript
const result = streamText({
  model: openai('gpt-4o-mini'),
  messages: [...],
  onFinish: async ({ text }) => {
    // Fire Inngest event here
  }
});
```

### Inngest Events
```typescript
await inngest.send({
  name: 'memory.save',
  data: { text, role: 'user' }
});
```

### Memory Store
```typescript
import { getMemory, addMemory } from '@/lib/memory/store';

// Retrieve
const memories = getMemory('query');

// Save
addMemory({ text: 'New memory', metadata: {} });
```

## 📈 Next: Add Frontend

Now that backend is ready, create:

1. `app/page.tsx` - Chat UI
2. `app/layout.tsx` - Root layout
3. Use `useChat()` hook from `ai/react`

## 🔗 Resources

- **AI SDK**: https://sdk.vercel.ai/docs
- **Inngest**: https://www.inngest.com/docs
- **Next.js**: https://nextjs.org/docs

## ✨ What Makes This Special

1. **Durable Execution** - Inngest retries failures automatically
2. **Streaming** - Real-time AI responses
3. **Memory** - Context-aware conversations
4. **Observable** - Full logs in Inngest dashboard
5. **Type-Safe** - TypeScript everywhere
6. **Edge Runtime** - Fast, globally distributed

---

**Status**: ✅ Backend Complete & Tested
**Time**: ~30 minutes
**Ready**: For frontend integration

Happy building! 🎉
