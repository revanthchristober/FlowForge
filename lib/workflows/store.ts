import { Flow, FlowNode, FlowEdge } from '@/lib/flows/types';
import fs from 'fs';
import path from 'path';

const WORKFLOWS_DIR = path.join(process.cwd(), 'data', 'workflows');

// Ensure workflows directory exists
if (!fs.existsSync(WORKFLOWS_DIR)) {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

export interface Workflow extends Flow {
  version: number;
  updatedAt: string;
}

export function saveWorkflow(workflow: Workflow): void {
  const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
}

export function getWorkflow(id: string): Workflow | null {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load workflow ${id}:`, error);
    return null;
  }
}

export function getAllWorkflows(): Workflow[] {
  try {
    if (!fs.existsSync(WORKFLOWS_DIR)) return [];
    const files = fs.readdirSync(WORKFLOWS_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf-8');
        return JSON.parse(data);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Failed to load workflows:', error);
    return [];
  }
}

export function deleteWorkflow(id: string): boolean {
  try {
    const filePath = path.join(WORKFLOWS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to delete workflow ${id}:`, error);
    return false;
  }
}
