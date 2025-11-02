/**
 * Supabase Memory Store
 * 
 * Replaces file-based memory storage with Supabase database.
 * Maintains backward compatibility with existing interface.
 * 
 * Key Features:
 * - User isolation via RLS (Row Level Security)
 * - Optional workflow association
 * - Async operations (all functions return Promises)
 * - Maintains chronological ordering (oldest → newest)
 * 
 * CRITICAL FIXES:
 * - Added getAllMemory() function (was missing)
 * - Added clearMemory() function (was missing)
 * - Fixed getMemory() ordering to match file-based behavior
 * - Made workflowId optional in addMemory() for backward compatibility
 */

import { supabase } from './client';

/**
 * Memory item interface matching both DB schema and current application types
 */
export interface MemoryItem {
  id: string;
  user_id?: string;
  workflow_id?: string;
  text: string;
  metadata?: Record<string, any>;
  created_at?: string;
  timestamp?: number; // For backward compatibility
}

/**
 * Add a memory item
 * 
 * @param item - Memory item to add (without id, user_id, created_at)
 * @param workflowId - Optional workflow ID to associate memory with
 * @returns Promise<MemoryItem> - Saved memory item
 * @throws Error if user is not authenticated or save fails
 * 
 * NOTE: workflowId is OPTIONAL for backward compatibility
 */
export async function addMemory(
  item: Omit<MemoryItem, 'id' | 'user_id' | 'created_at' | 'timestamp'>,
  workflowId?: string
): Promise<MemoryItem> {
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to add memory');
  }

  // Prepare data for database
  const memoryData = {
    user_id: user.id,
    workflow_id: workflowId || null, // Optional association
    text: item.text,
    metadata: item.metadata || {},
  };

  const { data, error } = await supabase
    .from('memory_items')
    .insert(memoryData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding memory:', error);
    throw new Error(`Failed to add memory: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to add memory: No data returned');
  }

  // Map to interface format with backward compatibility
  return {
    id: data.id,
    user_id: data.user_id,
    workflow_id: data.workflow_id,
    text: data.text,
    metadata: data.metadata,
    created_at: data.created_at,
    timestamp: new Date(data.created_at).getTime(), // For backward compatibility
  } as MemoryItem;
}

/**
 * Get memory items with optional filtering
 * 
 * CRITICAL: Maintains file-based behavior - returns LAST N items in chronological order
 * 
 * @param limitOrQuery - Number (limit) or string (search query)
 * @param workflowId - Optional workflow ID to filter by
 * @returns Promise<MemoryItem[]> - Array of memory items
 * 
 * Behavior:
 * - Number: Returns last N items (oldest → newest)
 * - String: Searches text and returns last 5 matching items
 * - Undefined: Returns last 5 items
 * 
 * NOTE: Order is ASCENDING (chronological) then slice last N
 * This matches the file-based behavior: memoryCache.slice(-limitOrQuery)
 */
export async function getMemory(
  limitOrQuery?: number | string,
  workflowId?: string
): Promise<MemoryItem[]> {
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️ No authenticated user - returning empty memory');
    return [];
  }

  let query = supabase
    .from('memory_items')
    .select('*')
    .eq('user_id', user.id);

  // Optional workflow filtering
  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }

  // Handle different query types
  if (typeof limitOrQuery === 'number') {
    // CRITICAL FIX: Get all, order chronologically, then slice last N
    // This matches file-based behavior: memoryCache.slice(-limitOrQuery)
    
    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching memory:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Take last N items (like array.slice(-N))
    const lastNItems = data.slice(-limitOrQuery);
    
    // Map to interface format
    return lastNItems.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      workflow_id: item.workflow_id,
      text: item.text,
      metadata: item.metadata,
      created_at: item.created_at,
      timestamp: new Date(item.created_at).getTime(),
    })) as MemoryItem[];

  } else if (typeof limitOrQuery === 'string') {
    // Search text with ILIKE, return last 5 matching
    const { data, error } = await query
      .ilike('text', `%${limitOrQuery}%`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error searching memory:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Take last 5 matching items
    const lastFiveItems = data.slice(-5);
    
    // Map to interface format
    return lastFiveItems.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      workflow_id: item.workflow_id,
      text: item.text,
      metadata: item.metadata,
      created_at: item.created_at,
      timestamp: new Date(item.created_at).getTime(),
    })) as MemoryItem[];

  } else {
    // Default: return last 5 items
    const { data, error } = await query
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching memory:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Take last 5 items
    const lastFiveItems = data.slice(-5);
    
    // Map to interface format
    return lastFiveItems.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      workflow_id: item.workflow_id,
      text: item.text,
      metadata: item.metadata,
      created_at: item.created_at,
      timestamp: new Date(item.created_at).getTime(),
    })) as MemoryItem[];
  }
}

/**
 * Get all memory items for the authenticated user
 * 
 * CRITICAL FIX: This function was MISSING from the original plan
 * Required by: /api/memory/route.ts
 * 
 * @returns Promise<MemoryItem[]> - All memory items in chronological order
 */
export async function getAllMemory(): Promise<MemoryItem[]> {
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️ No authenticated user - returning empty memory');
    return [];
  }

  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true }); // Chronological order (oldest → newest)

  if (error) {
    console.error('❌ Error fetching all memory:', error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Map to interface format
  return data.map((item) => ({
    id: item.id,
    user_id: item.user_id,
    workflow_id: item.workflow_id,
    text: item.text,
    metadata: item.metadata,
    created_at: item.created_at,
    timestamp: new Date(item.created_at).getTime(),
  })) as MemoryItem[];
}

/**
 * Clear memory items
 * 
 * CRITICAL FIX: This function was MISSING from the original plan
 * Required for: Testing and memory management
 * 
 * @param workflowId - Optional workflow ID to clear only workflow-specific memory
 * @returns Promise<void>
 * 
 * Behavior:
 * - If workflowId provided: Deletes only memory for that workflow
 * - If workflowId not provided: Deletes ALL user's memory
 */
export async function clearMemory(workflowId?: string): Promise<void> {
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('⚠️ No authenticated user - cannot clear memory');
    return;
  }

  let query = supabase
    .from('memory_items')
    .delete()
    .eq('user_id', user.id);

  // Optional: Clear only workflow-specific memory
  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }

  const { error } = await query;

  if (error) {
    console.error('❌ Error clearing memory:', error);
    throw new Error(`Failed to clear memory: ${error.message}`);
  }

  console.log(`✅ Memory cleared successfully${workflowId ? ` for workflow ${workflowId}` : ' (all)'}`);
}

