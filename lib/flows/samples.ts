import { Flow, FlowTrace } from './types';

// Sample Flow: Customer Support Agent
export const customerSupportFlow: Flow = {
  id: 'customer-support-v1',
  name: 'Customer Support Agent',
  description: 'Automated customer support with memory and LLM reasoning',
  createdAt: '2025-10-29T00:00:00Z',
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      label: 'User Message',
      config: { event: 'chat.message' }
    },
    {
      id: 'memory-1',
      type: 'memory',
      label: 'Load Context',
      config: { operation: 'read', limit: 5 }
    },
    {
      id: 'llm-1',
      type: 'llm',
      label: 'Generate Response',
      config: { model: 'gpt-4o-mini', temperature: 0.7 }
    },
    {
      id: 'memory-2',
      type: 'memory',
      label: 'Save Conversation',
      config: { operation: 'write' }
    },
    {
      id: 'action-1',
      type: 'action',
      label: 'Send Response',
      config: { type: 'stream' }
    }
  ],
  edges: [
    { from: 'trigger-1', to: 'memory-1' },
    { from: 'memory-1', to: 'llm-1' },
    { from: 'llm-1', to: 'memory-2' },
    { from: 'memory-2', to: 'action-1' }
  ]
};

// Sample Flow Trace
export const sampleTrace: FlowTrace = {
  id: 'trace-001',
  flowId: 'customer-support-v1',
  startTime: '2025-10-29T15:30:00Z',
  endTime: '2025-10-29T15:30:03.456Z',
  status: 'completed',
  steps: [
    {
      nodeId: 'trigger-1',
      nodeName: 'User Message',
      startTime: '2025-10-29T15:30:00.000Z',
      endTime: '2025-10-29T15:30:00.012Z',
      status: 'completed',
      input: { message: 'What is FlowForge?' },
      output: { message: 'What is FlowForge?' },
      duration: 12
    },
    {
      nodeId: 'memory-1',
      nodeName: 'Load Context',
      startTime: '2025-10-29T15:30:00.012Z',
      endTime: '2025-10-29T15:30:00.145Z',
      status: 'completed',
      input: { query: 'FlowForge' },
      output: { contextItems: 2, context: ['Previous conversation about AI...', 'User asked about memory...'] },
      duration: 133
    },
    {
      nodeId: 'llm-1',
      nodeName: 'Generate Response',
      startTime: '2025-10-29T15:30:00.145Z',
      endTime: '2025-10-29T15:30:02.890Z',
      status: 'completed',
      input: { prompt: 'What is FlowForge?', context: '...' },
      output: { response: 'FlowForge is an AI workflow platform...', tokens: 156 },
      duration: 2745
    },
    {
      nodeId: 'memory-2',
      nodeName: 'Save Conversation',
      startTime: '2025-10-29T15:30:02.890Z',
      endTime: '2025-10-29T15:30:03.234Z',
      status: 'completed',
      input: { messages: [{ role: 'user' }, { role: 'assistant' }] },
      output: { saved: 2, memoryId: 'mem-123' },
      duration: 344
    },
    {
      nodeId: 'action-1',
      nodeName: 'Send Response',
      startTime: '2025-10-29T15:30:03.234Z',
      endTime: '2025-10-29T15:30:03.456Z',
      status: 'completed',
      input: { response: 'FlowForge is an AI workflow platform...' },
      output: { sent: true, chunks: 45 },
      duration: 222
    }
  ]
};

// Export sample flows
export const sampleFlows: Flow[] = [customerSupportFlow];
