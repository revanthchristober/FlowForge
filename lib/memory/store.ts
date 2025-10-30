import fs from 'fs';
import path from 'path';

const MEMORY_FILE = path.join(process.cwd(), 'memory.json');

export interface MemoryItem {
  id: string;
  text: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// In-memory cache
let memoryCache: MemoryItem[] = [];

// Initialize memory file if it doesn't exist
function initMemoryFile() {
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, '', 'utf-8');
  }
}

// Load memory from file
function loadMemoryFromFile(): MemoryItem[] {
  initMemoryFile();
  const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  return lines.map(line => {
    try {
      const item = JSON.parse(line) as MemoryItem;
      // Validate the item has required fields with correct types
      if (item &&
          typeof item.text === 'string' &&
          item.text.trim().length > 0 &&
          item.id &&
          item.timestamp) {
        return item;
      }
      // Skip corrupted entries
      console.warn('⚠️ Skipping corrupted memory entry:', line.substring(0, 100));
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to parse memory entry:', line.substring(0, 100));
      return null;
    }
  }).filter(Boolean) as MemoryItem[];
}

// Get memory items (with optional limit)
export function getMemory(limitOrQuery?: number | string): MemoryItem[] {
  // Load fresh data from file
  memoryCache = loadMemoryFromFile();

  if (memoryCache.length === 0) {
    return [];
  }

  // If number, treat as limit
  if (typeof limitOrQuery === 'number') {
    return memoryCache.slice(-limitOrQuery);
  }

  // If string, treat as search query
  if (typeof limitOrQuery === 'string') {
    const lowerQuery = limitOrQuery.toLowerCase();
    const filtered = memoryCache.filter(item =>
      item.text.toLowerCase().includes(lowerQuery)
    );
    return filtered.slice(-5);
  }

  // Default: return last 5 items
  return memoryCache.slice(-5);
}

// Add memory item to file (append-only)
export function addMemory(item: Omit<MemoryItem, 'id' | 'timestamp'>): MemoryItem {
  initMemoryFile();

  const newItem: MemoryItem = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    ...item
  };

  // Append to file
  fs.appendFileSync(MEMORY_FILE, JSON.stringify(newItem) + '\n', 'utf-8');

  // Update cache
  memoryCache.push(newItem);

  return newItem;
}

// Get all memory items
export function getAllMemory(): MemoryItem[] {
  memoryCache = loadMemoryFromFile();
  return memoryCache;
}

// Clear all memory (for testing)
export function clearMemory(): void {
  fs.writeFileSync(MEMORY_FILE, '', 'utf-8');
  memoryCache = [];
}
