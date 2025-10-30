import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { inngest } from '@/lib/inngest/client';
import { getMemory } from '@/lib/memory/store';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
// Explicitly use Node.js runtime (not edge) because memory store uses fs module
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Check if messages are in UIMessage format (with parts) or old format (with content string)
    const isUIMessageFormat = messages.some((m: any) => m.parts && Array.isArray(m.parts));

    // Convert UIMessages to ModelMessages only if in new format
    const modelMessages = isUIMessageFormat
      ? convertToModelMessages(messages)
      : messages; // Use as-is if already in old/model format

    // Get the last user message - extract text from parts if UIMessage format
    const lastMessage = messages[messages.length - 1];
    let userPrompt = '';

    if (lastMessage?.parts && Array.isArray(lastMessage.parts)) {
      // UIMessage format with parts array
      userPrompt = lastMessage.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    } else if (typeof lastMessage?.content === 'string') {
      // Old format with content string
      userPrompt = lastMessage.content;
    } else if (Array.isArray(lastMessage?.content)) {
      // Content is array of parts
      userPrompt = lastMessage.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }

    // 1. Read memory context (use limit of 5 instead of search query)
    const memoryItems = getMemory(5);
    const memoryContext = (memoryItems || []).map(item => item.text);
    const memoryPrompt = memoryContext.length > 0
      ? `\n\nRelevant memory context:\n${memoryContext.join('\n')}`
      : '';

    // 2. Prepare system message with memory context
    const systemMessage = {
      role: 'system' as const,
      content: `You are FlowForge Assistant, an AI that helps users build and understand agent workflows. You have access to conversation memory to provide contextual responses.${memoryPrompt}`
    };

    // 3. Stream LLM response using AI SDK
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemMessage.content,
      messages: modelMessages,
      temperature: 0.7,
      maxTokens: 1000,
      async onFinish({ text, finishReason }) {
        console.log('💬 Chat completed:', { finishReason, textLength: text.length });

        // 4. Fire Inngest event to save memory asynchronously
        // Save both user message and assistant response
        try {
          await inngest.send([
            {
              name: 'memory.save',
              data: {
                text: userPrompt,
                role: 'user',
                metadata: {
                  timestamp: new Date().toISOString(),
                },
              },
            },
            {
              name: 'memory.save',
              data: {
                text,
                role: 'assistant',
                metadata: {
                  timestamp: new Date().toISOString(),
                  finishReason,
                },
              },
            },
          ]);

          console.log('📤 Memory save events sent to Inngest');
        } catch (error) {
          console.error('❌ Failed to send Inngest events:', error);
        }
      },
    });

    // 5. Return streaming response
    // AI SDK v5 - Use toUIMessageStreamResponse for chat UI
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('❌ Chat API error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
