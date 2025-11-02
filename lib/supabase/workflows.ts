/**
 * Supabase Workflows Store
 * 
 * Replaces file-based workflow storage with Supabase database.
 * Maintains backward compatibility with existing interface.
 * 
 * Key Features:
 * - User isolation via RLS (Row Level Security)
 * - Async operations (all functions return Promises)
 * - Field mapping: DB snake_case ↔ Interface camelCase
 */

import { supabase } from './client';
import { Flow, FlowNode, FlowEdge } from '@/lib/flows/types';

/**
 * Workflow interface matching both DB schema and current application types
 */
export interface Workflow extends Flow {
  user_id?: string;
  version: number;
  updatedAt: string;
  is_public?: boolean;
}

/**
 * Save or update a workflow
 * 
 * @param workflow - Workflow object to save
 * @returns Promise<Workflow> - Saved workflow with DB-generated fields
 * @throws Error if user is not authenticated or save fails
 * 
 * NOTE: This is an ASYNC function (breaking change from file-based store)
 * Callers must use `await saveWorkflow(...)` 
 */
export async function saveWorkflow(workflow: Workflow): Promise<Workflow> {
  // Auth check - required for all DB operations
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to save workflows');
  }

  // Prepare data for database (map camelCase → snake_case)
  const workflowData = {
    id: workflow.id,
    user_id: user.id,
    name: workflow.name,
    description: workflow.description || '',
    nodes: workflow.nodes as unknown as any, // JSONB type
    edges: workflow.edges as unknown as any, // JSONB type
    version: workflow.version || 1,
    is_public: workflow.is_public || false,
    updated_at: new Date().toISOString(),
  };

  // Upsert: Insert if new, update if exists
  const { data, error } = await supabase
    .from('workflows')
    .upsert(workflowData, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('❌ Error saving workflow:', error);
    throw new Error(`Failed to save workflow: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to save workflow: No data returned');
  }

  // Map DB fields back to interface format (snake_case → camelCase)
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    nodes: data.nodes as FlowNode[],
    edges: data.edges as FlowEdge[],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version,
    user_id: data.user_id,
    is_public: data.is_public,
  } as Workflow;
}

/**
 * Get a single workflow by ID
 * 
 * @param id - Workflow ID
 * @returns Promise<Workflow | null> - Workflow if found, null otherwise
 * 
 * NOTE: RLS automatically filters to user's own workflows
 */
export async function getWorkflow(id: string): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // Not found or access denied
    console.warn(`⚠️ Workflow ${id} not found or access denied:`, error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  // Map DB fields to interface format
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    nodes: data.nodes as FlowNode[],
    edges: data.edges as FlowEdge[],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version,
    user_id: data.user_id,
    is_public: data.is_public,
  } as Workflow;
}

/**
 * Get all workflows for the authenticated user
 * 
 * @returns Promise<Workflow[]> - Array of workflows, sorted by most recently updated
 * 
 * NOTE: RLS automatically filters to user's own workflows
 * Returns empty array if user not authenticated
 */
export async function getAllWorkflows(): Promise<Workflow[]> {
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️ No authenticated user - returning empty workflows list');
    return [];
  }

  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching workflows:', error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Map DB fields to interface format
  return data.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    nodes: w.nodes as FlowNode[],
    edges: w.edges as FlowEdge[],
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    version: w.version,
    user_id: w.user_id,
    is_public: w.is_public,
  })) as Workflow[];
}

/**
 * Delete a workflow by ID
 * 
 * @param id - Workflow ID to delete
 * @returns Promise<boolean> - true if deleted, false if not found or failed
 * 
 * NOTE: RLS automatically ensures user can only delete their own workflows
 */
export async function deleteWorkflow(id: string): Promise<boolean> {
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️ No authenticated user - cannot delete workflow');
    return false;
  }

  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // Extra safety check

  if (error) {
    console.error(`❌ Error deleting workflow ${id}:`, error);
    return false;
  }

  console.log(`✅ Workflow ${id} deleted successfully`);
  return true;
}

