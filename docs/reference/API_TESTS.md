# FlowForge API Tests with curl

> Comprehensive curl-based tests for all FlowForge endpoints

## 🎯 Prerequisites

Before running tests, ensure:
- ✅ Next.js server running: `npm run dev` (http://localhost:3000)
- ✅ Inngest dev server running: `npx inngest-cli@latest dev` (http://localhost:8288)
- ✅ OpenAI API key configured in `.env.local`

---

## 🧪 Test Suite

### Test 1: Health Check - Next.js Server

**Purpose**: Verify Next.js server is running

```bash
curl -I http://localhost:3000
```

**Expected Response:**
```
HTTP/1.1 200 OK
# or
HTTP/1.1 404 Not Found (if no root page)
```

**Status**: ✅ Pass if server responds with any HTTP code

---

### Test 2: Health Check - Inngest API Endpoint

**Purpose**: Verify Inngest API endpoint is accessible

```bash
curl -I http://localhost:3000/api/inngest
```

**Expected Response:**
```
HTTP/1.1 200 OK
# or
HTTP/1.1 405 Method Not Allowed (GET not supported, needs POST)
```

**Status**: ✅ Pass if endpoint is accessible

---

### Test 3: Chat API - Simple Message

**Purpose**: Test basic chat functionality

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Expected Response:**
```
0:"Hello! How can I help you today?"
# Streaming response with UI message format
```

**Status**: ✅ Pass if response contains text

---

### Test 4: Chat API - Memory Context

**Purpose**: Test memory context injection

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is FlowForge?"}
    ]
  }'
```

**Expected Response:**
- AI explains FlowForge based on system prompt
- Response uses memory context if available

**Status**: ✅ Pass if response is relevant

---

### Test 5: Chat API - Multi-turn Conversation

**Purpose**: Test conversation history handling

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Nice to meet you, Alice!"},
      {"role": "user", "content": "What is my name?"}
    ]
  }'
```

**Expected Response:**
```
AI should respond with "Alice" based on conversation history
```

**Status**: ✅ Pass if AI uses conversation context

---

### Test 6: Inngest Event - Direct Send

**Purpose**: Test Inngest event ingestion

```bash
curl -X POST http://localhost:8288/e/flowforge-demo \
  -H "Content-Type: application/json" \
  -d '{
    "name": "memory.save",
    "data": {
      "text": "Test memory item from curl",
      "role": "user",
      "metadata": {
        "test": true,
        "timestamp": "2025-10-29T20:00:00Z"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "ids": ["01HP1ZX8M3NG9VP6QN0XK7J4CZ"],
  "status": 200
}
```

**Status**: ✅ Pass if event ID is returned

**Verify:**
```bash
# Check memory.json file
cat memory.json | tail -n 1
```

Should show the test memory item.

---

### Test 7: Memory File Verification

**Purpose**: Verify memory persistence

```bash
# Check if file exists
ls -la memory.json

# Count entries
wc -l memory.json

# View last 3 entries (formatted)
tail -n 3 memory.json | jq '.'
```

**Expected Output:**
```json
{
  "id": "1730000000000",
  "timestamp": 1730000000000,
  "text": "Hello!",
  "metadata": {
    "role": "user",
    "timestamp": "2025-10-29T..."
  }
}
```

**Status**: ✅ Pass if file exists and contains JSON lines

---

### Test 8: Chat API - Error Handling

**Purpose**: Test API error handling with malformed request

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

**Expected Response:**
```json
{
  "error": "Failed to process chat request",
  "details": "..."
}
```

**Status**: ✅ Pass if error is handled gracefully (HTTP 500 or 400)

---

### Test 9: Inngest Dashboard

**Purpose**: Verify Inngest dashboard is accessible

```bash
curl -I http://localhost:8288
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: text/html
```

**Manual Verify:**
- Open http://localhost:8288 in browser
- Should see Inngest Dev Server UI
- Check "Functions" tab shows `saveMemoryFunction`

**Status**: ✅ Pass if dashboard loads

---

### Test 10: Streaming Response

**Purpose**: Verify streaming functionality

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Count to 5"}
    ]
  }'
```

**Note**: `-N` flag disables buffering for streaming

**Expected Response:**
Streaming chunks as they arrive:
```
0:"1"
0:"2"
0:"3"
0:"4"
0:"5"
```

**Status**: ✅ Pass if response streams in real-time

---

## 🔄 Test Workflow

### Complete Test Sequence

Run these in order to test the full flow:

```bash
# 1. Send first message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"My name is Bob"}]}'

# 2. Wait 2 seconds for Inngest to process
sleep 2

# 3. Check memory file
cat memory.json | grep "Bob"

# 4. Send follow-up using memory
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is my name?"}]}'

# Expected: AI responds with "Bob"
```

---

## 📊 Advanced Tests

### Test 11: Concurrent Requests

**Purpose**: Test API under concurrent load

```bash
# Send 5 requests in parallel
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Request $i\"}]}" &
done
wait

# Check if all 10 events saved (2 per request: user + assistant)
wc -l memory.json
```

**Expected**: All requests succeed, memory file has 10 new entries

---

### Test 12: Large Message

**Purpose**: Test API with large input

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "'"$(printf 'A%.0s' {1..1000})"'"
      }
    ]
  }'
```

**Expected**: API handles large inputs gracefully

---

### Test 13: Special Characters

**Purpose**: Test API with special characters

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Test with special chars: @#$%^&*(){}[]|\\:<>?/"
      }
    ]
  }'
```

**Expected**: API properly escapes and handles special characters

---

### Test 14: Memory Retrieval

**Purpose**: Test memory context filtering

```bash
# 1. Add specific memory
curl -X POST http://localhost:8288/e/flowforge-demo \
  -H "Content-Type: application/json" \
  -d '{
    "name": "memory.save",
    "data": {
      "text": "User prefers dark mode",
      "role": "user"
    }
  }'

# 2. Query related to memory
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are my preferences?"}
    ]
  }'
```

**Expected**: AI uses memory context to respond about dark mode

---

## 🐛 Debugging Tests

### View Inngest Function Runs

```bash
# Get function runs (if Inngest API is exposed)
curl http://localhost:8288/api/runs
```

### Check Server Logs

**Next.js logs** (Terminal 1):
- Look for `💬 Chat completed`
- Look for `📤 Memory save events sent to Inngest`

**Inngest logs** (Terminal 2):
- Look for `🧠 Saving memory:`
- Look for `✅ Memory saved successfully:`

### Clear Memory

```bash
# Backup current memory
cp memory.json memory.backup.json

# Clear memory file
echo "" > memory.json

# Or delete entirely
rm memory.json
```

---

## ✅ Success Criteria

### All Tests Pass If:

- ✅ Both servers are running and responding
- ✅ Chat API returns streaming responses
- ✅ Inngest events are accepted
- ✅ Memory file is created and updated
- ✅ Memory context is used in responses
- ✅ Errors are handled gracefully
- ✅ Dashboard is accessible

### Common Issues:

| Issue | Solution |
|-------|----------|
| Connection refused | Start servers first |
| Empty response | Check OpenAI API key in `.env.local` |
| No memory file | Wait for Inngest to process events |
| 500 errors | Check server logs for details |

---

## 🎓 Test Automation

### Using the Test Script

```bash
# Make script executable
chmod +x test.sh

# Run all tests
./test.sh

# Expected output:
# ================================================
# FlowForge API Test Suite
# ================================================
#
# Total Tests:  10
# Passed:       10
# Failed:       0
#
# 🎉 All tests passed!
```

---

## 📚 Additional Resources

- [Inngest Testing Docs](https://www.inngest.com/docs/testing)
- [curl Manual](https://curl.se/docs/manual.html)
- [AI SDK Testing](https://sdk.vercel.ai/docs)

---

**Test Documentation Complete** ✅
**Ready for Manual or Automated Testing** ✅
