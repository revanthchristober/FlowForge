import { inngest } from './client';
import { addMemory } from '../memory/store';

// Event type definitions
type MemorySaveEvent = {
  name: 'memory.save';
  data: {
    text: string;
    role?: 'user' | 'assistant';
    metadata?: Record<string, any>;
  };
};

// Inngest function: Save memory to persistent storage
export const saveMemoryFunction = inngest.createFunction(
  {
    id: 'save-memory',
    name: 'Save Memory',
  },
  { event: 'memory.save' },
  async ({ event, step }) => {
    const { text, role = 'user', metadata } = event.data as MemorySaveEvent['data'];

    // Step 1: Save to memory store
    const savedItem = await step.run('save-to-store', async () => {
      console.log('🧠 Saving memory:', { text, role, metadata });

      const item = addMemory({
        text,
        metadata: {
          role,
          ...metadata,
        },
      });

      return item;
    });

    // Step 2: Log success
    await step.run('log-success', async () => {
      console.log('✅ Memory saved successfully:', savedItem.id);
      return { success: true, id: savedItem.id };
    });

    return { saved: true, item: savedItem };
  }
);

// Export all functions
export const inngestFunctions = [saveMemoryFunction];
