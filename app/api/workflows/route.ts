import { NextResponse } from 'next/server';
import { getAllWorkflows, saveWorkflow, deleteWorkflow, Workflow } from '@/lib/supabase/workflows';

export const runtime = 'nodejs';

/**
 * GET /api/workflows
 * Returns all workflows for the authenticated user
 * 
 * User Isolation: Only returns workflows owned by the authenticated user
 * via Supabase RLS policies and explicit user_id filtering
 */
export async function GET() {
  try {
    // getAllWorkflows() from Supabase store automatically filters by user_id
    const workflows = await getAllWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('Failed to get workflows:', error);
    return NextResponse.json(
      { error: 'Failed to load workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Saves or updates a workflow for the authenticated user
 * 
 * User Isolation: Automatically associates workflow with authenticated user's ID
 */
export async function POST(req: Request) {
  try {
    const workflow: Workflow = await req.json();

    // Validate workflow structure
    if (!workflow.id || !workflow.name || !workflow.nodes || !workflow.edges) {
      return NextResponse.json(
        { error: 'Invalid workflow structure' },
        { status: 400 }
      );
    }

    // Add timestamp if not present
    workflow.updatedAt = new Date().toISOString();
    if (!workflow.createdAt) {
      workflow.createdAt = workflow.updatedAt;
    }
    if (!workflow.version) {
      workflow.version = 1;
    }

    // saveWorkflow() from Supabase store automatically sets user_id from auth session
    const savedWorkflow = await saveWorkflow(workflow);

    return NextResponse.json({
      success: true,
      workflow: savedWorkflow
    });
  } catch (error: any) {
    console.error('Failed to save workflow:', error);
    
    // Handle authentication errors
    if (error.message?.includes('authenticated') || error.message?.includes('authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to save workflow' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows?id=<workflow-id>
 * Deletes a workflow owned by the authenticated user
 * 
 * User Isolation: Only allows deletion of workflows owned by the authenticated user
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    // deleteWorkflow() from Supabase store automatically checks user_id
    const success = await deleteWorkflow(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Failed to delete workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
