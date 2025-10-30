import { NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getMemory, addMemory } from '@/lib/memory/store';
import { getWorkflow } from '@/lib/workflows/store';
import { FlowNode } from '@/lib/flows/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ExecutionContext {
  variables: Record<string, any>;
  memory: any[];
}

async function executeNode(
  node: FlowNode,
  context: ExecutionContext,
  userInput?: string
): Promise<{ output: any; context: ExecutionContext }> {
  const { type, config } = node;

  switch (type) {
    case 'trigger':
      return {
        output: { message: userInput || context.variables.input },
        context
      };

    case 'memory':
      if (config?.operation === 'read') {
        const limit = config.limit || 5;
        const memory = getMemory(limit);
        return {
          output: { memory },
          context: { ...context, memory }
        };
      } else if (config?.operation === 'write') {
        // Save user input first
        if (userInput && !context.variables.userInputSaved) {
          addMemory({ text: userInput, metadata: { role: 'user', timestamp: new Date().toISOString() } });
          context.variables.userInputSaved = true;
        }

        // Save LLM output if available
        const llmOutput = context.variables.llmOutput;
        if (llmOutput) {
          addMemory({ text: llmOutput, metadata: { role: 'assistant', timestamp: new Date().toISOString() } });
          console.log('💾 Saved user input and assistant response to memory');
        }

        return {
          output: { saved: true },
          context
        };
      }
      return { output: {}, context };

    case 'llm':
      const model = config?.model || 'gpt-4o-mini';
      const temperature = config?.temperature || 0.7;
      let systemPrompt = config?.systemPrompt || 'You are a helpful assistant.';

      // Build messages from context
      const messages: any[] = [];

      // Enhanced system prompt if memory is available
      if (context.memory && context.memory.length > 0) {
        systemPrompt = `${systemPrompt} You have access to previous conversation history. Use this context to provide relevant, personalized responses. Reference past messages when appropriate.`;
      }

      // Note: AI SDK v5 requires system prompt as separate parameter, not in messages array

      // Add memory context if available
      if (context.memory && context.memory.length > 0) {
        console.log(`💭 Processing ${context.memory.length} memory items`);

        // Filter out invalid memory entries (missing text or corrupted data)
        const validMemories = context.memory.filter((mem: any) => {
          return mem && typeof mem.text === 'string' && mem.text.trim().length > 0;
        });

        console.log(`✅ Valid memories after filtering: ${validMemories.length} / ${context.memory.length}`);

        validMemories.forEach((mem: any) => {
          messages.push({
            role: mem.metadata?.role || 'user',
            content: mem.text
          });
        });
      } else {
        console.log('⚠️ No memory available in context');
      }

      // Add current user input
      const currentInput = userInput || context.variables.input;
      console.log(`📥 User input for LLM: "${currentInput}" (userInput: "${userInput}", context.variables.input: "${context.variables.input}")`);

      if (currentInput) {
        messages.push({ role: 'user', content: currentInput });
      } else {
        console.warn('⚠️ No user input available for LLM');
      }

      console.log(`🤖 LLM receiving ${messages.length} messages (including ${context.memory?.length || 0} from memory)`);

      // Check if we have any messages
      if (messages.length === 0) {
        console.error('❌ No messages to send to LLM!');
        return {
          output: { text: 'Error: No input provided', error: true },
          context
        };
      }

      // Generate response
      try {
        const result = await streamText({
          model: openai(model),
          system: systemPrompt,  // AI SDK v5: system prompt as separate parameter
          messages,
          temperature
        });

        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }

        console.log(`✅ LLM generated ${fullText.length} characters`);

        return {
          output: { text: fullText },
          context: {
            ...context,
            variables: { ...context.variables, llmOutput: fullText }
          }
        };
      } catch (error) {
        console.error('❌ LLM generation error:', error);
        return {
          output: { text: '', error: error instanceof Error ? error.message : 'Unknown error' },
          context
        };
      }

    case 'action':
      // For now, just pass through the output
      return {
        output: context.variables,
        context
      };

    default:
      return { output: {}, context };
  }
}

export async function POST(req: Request) {
  try {
    const { workflowId, input } = await req.json();

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const workflow = getWorkflow(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Initialize execution context
    let context: ExecutionContext = {
      variables: { input },
      memory: []
    };

    const results: Record<string, any> = {};

    // Build execution order from edges
    const executed = new Set<string>();
    const toExecute = [...workflow.nodes];

    // Simple execution - follow edges in order
    for (const node of toExecute) {
      if (executed.has(node.id)) continue;

      console.log(`Executing node: ${node.id} (${node.type})`);

      const result = await executeNode(node, context, input);
      results[node.id] = result.output;
      context = result.context;
      executed.add(node.id);
    }

    // Return final output - try to find LLM output first
    let finalOutput = context.variables.llmOutput;

    // If no LLM output in variables, check results for any LLM node
    if (!finalOutput) {
      const llmResults = Object.entries(results).find(([key, value]) =>
        key.includes('llm') && value && typeof value === 'object' && 'text' in value
      );
      if (llmResults && llmResults[1].text) {
        finalOutput = llmResults[1].text;
      }
    }

    // Fallback to generic message if still no output
    if (!finalOutput || finalOutput === '') {
      finalOutput = 'Workflow executed successfully (no LLM output generated)';
    }

    return NextResponse.json({
      success: true,
      output: finalOutput,
      results,
      workflowId
    });
  } catch (error) {
    console.error('Workflow execution error:', error);
    return NextResponse.json(
      { error: 'Workflow execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
