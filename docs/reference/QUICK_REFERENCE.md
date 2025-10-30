# FlowForge - Quick Reference Card

## 🚀 Start Servers (2 Terminals)

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Inngest
npx inngest-cli@latest dev
```

## 🔑 Environment Variables

```env
# .env.local (required)
OPENAI_API_KEY=sk-your-key-here
```

## 🌐 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Next.js | http://localhost:3000 | Main app |
| Chat API | http://localhost:3000/api/chat | AI endpoint |
| Inngest API | http://localhost:3000/api/inngest | Functions |
| Inngest Dashboard | http://localhost:8288 | Monitor workflows |

## 🧪 Quick Test

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

## ✅ Health Check

```bash
# Check memory file exists
cat memory.json

# Check Inngest functions registered
curl http://localhost:8288/api/functions
```

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| `OPENAI_API_KEY not found` | Add to `.env.local` and restart |
| Inngest not discovering | Start Next.js BEFORE Inngest |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| No memory.json | Check Inngest dashboard for errors |

## 📁 Project Structure

```
app/api/
  ├── chat/route.ts       # AI streaming endpoint
  └── inngest/route.ts    # Inngest functions

lib/
  ├── inngest/
  │   ├── client.ts       # Inngest client
  │   └── functions.ts    # Background jobs
  └── memory/
      └── store.ts        # Memory CRUD
```

## 🎓 Key Concepts

**Streaming**: Real-time AI responses via `streamText()`
**Durable**: Inngest retries failures automatically
**Memory**: Context persists in `memory.json`
**Events**: `inngest.send()` triggers background jobs

## 📚 Documentation

- [Setup Guide](SETUP_GUIDE.md) - Full setup instructions
- [README](README.md) - Project overview
- [Improvements](IMPROVEMENTS.md) - Recent fixes
- [Verification](VERIFICATION_COMPLETE.md) - Quality check

## 🔧 Dev Commands

```bash
npm run dev          # Start Next.js
npm run build        # Build for production
npm run start        # Start production server
npx inngest-cli dev  # Start Inngest dev server
```

---

**Need Help?** See [SETUP_GUIDE.md](SETUP_GUIDE.md)
