// Flow Types for FlowForge Demo

export interface FlowNode {
  id: string;
  type: 'trigger' | 'llm' | 'memory' | 'action';
  label: string;
  config?: Record<string, any>;
}

export interface FlowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
}

export interface FlowTrace {
  id: string;
  flowId: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed';
  steps: FlowTraceStep[];
}

export interface FlowTraceStep {
  nodeId: string;
  nodeName: string;
  startTime: string;
  endTime?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  error?: string;
  duration?: number;
}
