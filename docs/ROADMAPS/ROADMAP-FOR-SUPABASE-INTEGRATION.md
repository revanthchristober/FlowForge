
OUR-SUPABASE-INTEGRATION-PLAN:
"""🎯 DEEP ANALYSIS: Supabase Integration Plan for FlowForge
Current Architecture Analysis
1. Storage Layer (File-based → Supabase migration needed)
Workflows (lib/workflows/store.ts):
Currently stores in: /data/workflows/*.json (filesystem)
Functions: saveWorkflow, getWorkflow, getAllWorkflows, deleteWorkflow
No user isolation - all workflows are global
Memory (lib/memory/store.ts):
Currently stores in: memory.json (append-only file)
Functions: addMemory, getMemory, getAllMemory, clearMemory
No user/workflow isolation - all memory is global
Line-based JSON (each line = 1 memory item)
2. Data Types Currently Used
// Workflow structure
interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];  // Array stored as JSONB in Supabase
  edges: FlowEdge[];  // Array stored as JSONB in Supabase
  createdAt: string;
  updatedAt: string;
  version: number;
}

// Memory structure
interface MemoryItem {
  id: string;
  text: string;
  timestamp: number;
  metadata?: Record<string, any>; // role, timestamp
}

// Node structure (stored inside workflow.nodes)
interface FlowNode {
  id: string;
  type: 'trigger' | 'llm' | 'memory' | 'action';
  label: string;
  config?: Record<string, any>;
}
3. API Routes
/api/workflows (GET, POST, DELETE) - Uses file-based store
/api/workflows/execute (POST) - Executes workflow & manages memory
/api/memory (likely exists) - Memory operations
/api/chat - Chat interface
4. Frontend Components
app/page.tsx - Main workflow UI (NO AUTH, multi-user not supported)
components/WorkflowBuilder.tsx - Visual editor (zoom/pan enabled)
components/ChatSidebar.tsx - Test interface
📋 SUPABASE INTEGRATION PLAN
Phase 1: Setup Supabase Project
Step 1.1: Create Supabase Project
Go to supabase.com
Create new project
Copy:
Project URL → NEXT_PUBLIC_SUPABASE_URL
Anon Key → NEXT_PUBLIC_SUPABASE_ANON_KEY
Add to .env.local:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Step 1.2: Install Supabase Client
npm install @supabase/supabase-js
Phase 2: Database Schema (Run in Supabase SQL Editor)
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (linked to Supabase Auth)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Workflows table
create table public.workflows (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  is_public boolean default false,
  version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Memory items table
create table public.memory_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  workflow_id uuid references public.workflows(id) on delete cascade,
  text text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_workflows_user_id on public.workflows(user_id);
create index idx_workflows_updated_at on public.workflows(updated_at desc);
create index idx_memory_items_user_id on public.memory_items(user_id);
create index idx_memory_items_workflow_id on public.memory_items(workflow_id);
create index idx_memory_items_created_at on public.memory_items(created_at desc);

-- Row Level Security (RLS) Policies
alter table public.users enable row level security;
alter table public.workflows enable row level security;
alter table public.memory_items enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Workflows: Users can only see their own
create policy "Users can view own workflows"
  on public.workflows for select
  using (auth.uid() = user_id);

create policy "Users can create workflows"
  on public.workflows for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workflows"
  on public.workflows for update
  using (auth.uid() = user_id);

create policy "Users can delete own workflows"
  on public.workflows for delete
  using (auth.uid() = user_id);

-- Memory: Users can only access their own
create policy "Users can view own memory"
  on public.memory_items for select
  using (auth.uid() = user_id);

create policy "Users can create memory"
  on public.memory_items for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own memory"
  on public.memory_items for delete
  using (auth.uid() = user_id);

-- Function to auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call function on new auth user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
Phase 3: Create Supabase Client Files
File: lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
File: lib/supabase/workflows.ts (Replaces lib/workflows/store.ts)
import { supabase } from './client';
import { Flow, FlowNode, FlowEdge } from '@/lib/flows/types';

export interface Workflow extends Flow {
  user_id?: string;
  version: number;
  updatedAt: string;
  is_public?: boolean;
}

export async function saveWorkflow(workflow: Workflow): Promise<Workflow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const workflowData = {
    id: workflow.id,
    user_id: user.id,
    name: workflow.name,
    description: workflow.description,
    nodes: workflow.nodes,
    edges: workflow.edges,
    version: workflow.version || 1,
    is_public: workflow.is_public || false,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('workflows')
    .upsert(workflowData)
    .select()
    .single();

  if (error) {
    console.error('Error saving workflow:', error);
    return null;
  }

  return {
    ...data,
    updatedAt: data.updated_at,
    createdAt: data.created_at
  } as Workflow;
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    updatedAt: data.updated_at,
    createdAt: data.created_at
  } as Workflow;
}

export async function getAllWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map(w => ({
    ...w,
    updatedAt: w.updated_at,
    createdAt: w.created_at
  })) as Workflow[];
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id);

  return !error;
}
File: lib/supabase/memory.ts (Replaces lib/memory/store.ts)
import { supabase } from './client';

export interface MemoryItem {
  id: string;
  user_id?: string;
  workflow_id?: string;
  text: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export async function addMemory(item: Omit<MemoryItem, 'id' | 'user_id' | 'created_at'>, workflowId?: string): Promise<MemoryItem | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('memory_items')
    .insert({
      user_id: user.id,
      workflow_id: workflowId,
      text: item.text,
      metadata: item.metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding memory:', error);
    return null;
  }

  return data as MemoryItem;
}

export async function getMemory(limitOrQuery?: number | string, workflowId?: string): Promise<MemoryItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('memory_items')
    .select('*')
    .eq('user_id', user.id);

  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }

  if (typeof limitOrQuery === 'number') {
    query = query.order('created_at', { ascending: false }).limit(limitOrQuery);
  } else if (typeof limitOrQuery === 'string') {
    query = query.ilike('text', `%${limitOrQuery}%`).limit(5);
  } else {
    query = query.order('created_at', { ascending: false }).limit(5);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data as MemoryItem[];
}

export async function clearMemory(workflowId?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let query = supabase
    .from('memory_items')
    .delete()
    .eq('user_id', user.id);

  if (workflowId) {
    query = query.eq('workflow_id', workflowId);
  }

  await query;
}
Phase 4: Add Authentication
File: app/login/page.tsx (NEW)
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      router.push('/');
    } else {
      alert(error.message);
    }

    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: email.split('@')[0] }
      }
    });

    if (!error) {
      alert('Check your email for confirmation!');
    } else {
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <div style={{ /* Your Material You styling */ }}>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>Log In</button>
        <button type="button" onClick={handleSignup} disabled={loading}>
          Sign Up
        </button>
      </form>
    </div>
  );
}
Update: app/page.tsx - Add Auth Check
// Add at top after imports
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // ... rest of your component
}
Phase 5: Update API Routes
Update: app/api/workflows/route.ts
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Add this to .env.local
);

export async function GET(req: Request) {
  // Get workflows from Supabase instead of files
  // ... implement using lib/supabase/workflows.ts functions
}
Phase 6: Migration Strategy
Step 6.1: Migrate Existing Data
// File: scripts/migrate-to-supabase.ts
import { getAllWorkflows as getFileWorkflows } from '@/lib/workflows/store';
import { saveWorkflow } from '@/lib/supabase/workflows';

async function migrate() {
  const fileWorkflows = getFileWorkflows();
  
  for (const workflow of fileWorkflows) {
    await saveWorkflow(workflow);
    console.log(`Migrated: ${workflow.name}`);
  }
}

migrate();
🎯 SUMMARY: What Changes Where
File	Action	Why
.env.local	Add Supabase keys	Auth & DB connection
lib/supabase/client.ts	CREATE	Supabase client
lib/supabase/workflows.ts	CREATE	Replace file-based store
lib/supabase/memory.ts	CREATE	Replace file-based store
app/login/page.tsx	CREATE	User authentication
app/page.tsx	UPDATE	Add auth check
app/api/workflows/route.ts	UPDATE	Use Supabase queries
app/api/workflows/execute/route.ts	UPDATE	Use Supabase memory
✅ EXECUTION ORDER
Create Supabase project → Get API keys
Run SQL schema in Supabase SQL Editor
Install @supabase/supabase-js
Create lib/supabase/ folder with client, workflows, memory files
Create /app/login/page.tsx
Update app/page.tsx with auth check
Update API routes to use Supabase
Test locally
Deploy to Vercel with Supabase env vars
This is the complete roadmap. Ready to start?"""