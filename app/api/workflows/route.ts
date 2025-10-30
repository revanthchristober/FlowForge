import { NextResponse } from 'next/server';
import { getAllWorkflows, saveWorkflow, deleteWorkflow, Workflow } from '@/lib/workflows/store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const workflows = getAllWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error('Failed to get workflows:', error);
    return NextResponse.json(
      { error: 'Failed to load workflows' },
      { status: 500 }
    );
  }
}

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

    // Add timestamp
    workflow.updatedAt = new Date().toISOString();
    if (!workflow.createdAt) {
      workflow.createdAt = workflow.updatedAt;
    }
    if (!workflow.version) {
      workflow.version = 1;
    }

    saveWorkflow(workflow);

    return NextResponse.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Failed to save workflow:', error);
    return NextResponse.json(
      { error: 'Failed to save workflow' },
      { status: 500 }
    );
  }
}

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

    const success = deleteWorkflow(id);

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Failed to delete workflow:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
