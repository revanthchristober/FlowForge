"use client";
import { useState, useEffect } from "react";
import { FlowNode, FlowEdge } from "@/lib/flows/types";
import WorkflowBuilder from "@/components/WorkflowBuilder";
import ChatSidebar from "@/components/ChatSidebar";
import { customerSupportFlow } from "@/lib/flows/samples";
import type { Workflow } from "@/lib/workflows/store";

export default function Page() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);

  // Material You Color Tokens
  const colors = {
    primary: "#6750A4",
    primaryContainer: "#EADDFF",
    secondary: "#625B71",
    secondaryContainer: "#E8DEF8",
    surface: "#FEF7FF",
    surfaceVariant: "#E7E0EC",
    onSurface: "#1D1B20",
    outline: "#79747E",
    error: "#B3261E",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const createNewWorkflow = () => {
    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: 'New Workflow',
      description: 'A new LLM workflow',
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    setCurrentWorkflow(newWorkflow);
    setNodes([]);
    setEdges([]);
    setWorkflowName(newWorkflow.name);
    setWorkflowDescription(newWorkflow.description);
  };

  const loadWorkflow = (workflow: Workflow) => {
    setCurrentWorkflow(workflow);
    setNodes(workflow.nodes);
    setEdges(workflow.edges);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description);
  };

  const loadSampleWorkflow = () => {
    const sample: Workflow = {
      ...customerSupportFlow,
      updatedAt: new Date().toISOString(),
      version: 1
    };
    loadWorkflow(sample);
  };

  const saveWorkflow = async () => {
    if (!currentWorkflow) return;

    const workflowToSave: Workflow = {
      ...currentWorkflow,
      name: workflowName || 'Untitled Workflow',
      description: workflowDescription || '',
      nodes,
      edges,
      updatedAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowToSave)
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentWorkflow(data.workflow);
        await loadWorkflows();
        showToast('Workflow saved successfully!', 'success');
      } else {
        showToast('Failed to save workflow', 'error');
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      showToast('Failed to save workflow', 'error');
    }
  };

  const deleteWorkflow = async (id: string) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this workflow?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const response = await fetch(`/api/workflows?id=${id}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            await loadWorkflows();
            if (currentWorkflow?.id === id) {
              setCurrentWorkflow(null);
              setNodes([]);
              setEdges([]);
            }
            showToast('Workflow deleted successfully!', 'success');
          } else {
            showToast('Failed to delete workflow', 'error');
          }
        } catch (error) {
          console.error('Failed to delete workflow:', error);
          showToast('Failed to delete workflow', 'error');
        }
      }
    });
  };

  const testWorkflow = async (input: string): Promise<string> => {
    if (!currentWorkflow || !input.trim()) {
      throw new Error('Please enter test input');
    }

    try {
      // Save workflow first if it has nodes
      if (nodes.length > 0) {
        await saveWorkflow();
      }

      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: currentWorkflow.id,
          input
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.output || 'No output';
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute workflow');
      }
    } catch (error) {
      console.error('Failed to test workflow:', error);
      throw error;
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: colors.surface,
      fontFamily: 'Roboto, system-ui, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        color: '#FFFFFF',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>⚡</span>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
            FlowForge Studio
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {currentWorkflow && (
            <>
              <button
                onClick={saveWorkflow}
                style={{
                  padding: '10px 20px',
                  background: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#45a049';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#4CAF50';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                }}
              >
                💾 Save Workflow
              </button>
            </>
          )}
          <button
            onClick={createNewWorkflow}
            style={{
              padding: '10px 20px',
              background: colors.primaryContainer,
              color: colors.primary,
              border: `2px solid ${colors.primary}`,
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.primary;
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.primaryContainer;
              e.currentTarget.style.color = colors.primary;
            }}
          >
            ➕ New Workflow
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Workflow List */}
        <div style={{
          width: '280px',
          background: colors.surfaceVariant,
          borderRight: `1px solid ${colors.outline}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.outline}`,
            background: colors.primaryContainer
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.primary,
              margin: '0 0 16px 0'
            }}>
              My Workflows
            </h2>
            <button
              onClick={loadSampleWorkflow}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: colors.secondaryContainer,
                color: colors.secondary,
                border: `1px solid ${colors.secondary}`,
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.secondary;
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.secondaryContainer;
                e.currentTarget.style.color = colors.secondary;
              }}
            >
              📦 Load Sample Workflow
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px'
          }}>
            {workflows.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: colors.outline,
                fontSize: '14px'
              }}>
                No workflows yet. Create one to get started!
              </div>
            ) : (
              workflows.map(workflow => (
                <div
                  key={workflow.id}
                  style={{
                    background: currentWorkflow?.id === workflow.id ? colors.primaryContainer : '#FFFFFF',
                    border: `1px solid ${currentWorkflow?.id === workflow.id ? colors.primary : colors.outline}`,
                    borderRadius: '16px',
                    padding: '12px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => loadWorkflow(workflow)}
                  onMouseEnter={(e) => {
                    if (currentWorkflow?.id !== workflow.id) {
                      e.currentTarget.style.background = colors.surfaceVariant;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentWorkflow?.id !== workflow.id) {
                      e.currentTarget.style.background = '#FFFFFF';
                    }
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.onSurface,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {workflow.name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: colors.outline,
                    marginBottom: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {workflow.description}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: colors.outline
                  }}>
                    <span>{workflow.nodes.length} nodes</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(workflow.id);
                      }}
                      style={{
                        padding: '4px 8px',
                        background: '#F2B8B5',
                        color: '#B3261E',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!currentWorkflow ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              padding: '40px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '80px' }}>⚡</span>
              <h2 style={{
                fontSize: '32px',
                fontWeight: '600',
                color: colors.onSurface,
                margin: 0
              }}>
                Welcome to FlowForge Studio
              </h2>
              <p style={{
                fontSize: '18px',
                color: colors.outline,
                maxWidth: '600px',
                margin: 0
              }}>
                Create powerful LLM workflows with a visual drag-and-drop interface.
                Connect triggers, memory, AI models, and actions to build intelligent automation.
              </p>
              <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
                <button
                  onClick={createNewWorkflow}
                  style={{
                    padding: '14px 28px',
                    background: colors.primary,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '28px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                  }}
                >
                  Create New Workflow
                </button>
                <button
                  onClick={loadSampleWorkflow}
                  style={{
                    padding: '14px 28px',
                    background: colors.secondaryContainer,
                    color: colors.secondary,
                    border: `2px solid ${colors.secondary}`,
                    borderRadius: '28px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.secondary;
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.secondaryContainer;
                    e.currentTarget.style.color = colors.secondary;
                  }}
                >
                  Try Sample Workflow
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Workflow Info Bar */}
              <div style={{
                background: colors.primaryContainer,
                padding: '16px 24px',
                borderBottom: `1px solid ${colors.outline}`,
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="Workflow Name"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${colors.outline}`,
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      background: '#FFFFFF',
                      color: colors.onSurface,
                      marginBottom: '8px'
                    }}
                  />
                  <input
                    type="text"
                    value={workflowDescription}
                    onChange={(e) => setWorkflowDescription(e.target.value)}
                    placeholder="Description"
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      border: `1px solid ${colors.outline}`,
                      borderRadius: '10px',
                      fontSize: '14px',
                      background: '#FFFFFF',
                      color: colors.outline
                    }}
                  />
                </div>
                <div style={{
                  padding: '12px 16px',
                  background: colors.secondaryContainer,
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: colors.secondary,
                  whiteSpace: 'nowrap'
                }}>
                  {nodes.length} nodes • {edges.length} connections
                </div>
              </div>

              {/* Workflow Builder */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <WorkflowBuilder
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={setNodes}
                  onEdgesChange={setEdges}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        workflowId={currentWorkflow?.id || null}
        onTestWorkflow={testWorkflow}
      />

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              zIndex: 10000,
              animation: 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onClick={() => setConfirmDialog(null)}
          />
          {/* Dialog */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: colors.surface,
              borderRadius: '28px',
              padding: '24px',
              minWidth: '280px',
              maxWidth: '560px',
              boxShadow: '0px 8px 12px 6px rgba(0,0,0,0.15), 0px 4px 4px 0px rgba(0,0,0,0.3)',
              zIndex: 10001,
              animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: 'Roboto, system-ui, -apple-system, sans-serif'
            }}
          >
            {/* Icon */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '20px',
              background: colors.errorContainer,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              fontSize: '20px'
            }}>
              ⚠️
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '20px',
              fontWeight: '500',
              color: colors.onSurface,
              margin: '0 0 8px 0',
              lineHeight: '28px'
            }}>
              Delete Workflow?
            </h3>

            {/* Message */}
            <p style={{
              fontSize: '14px',
              color: colors.outline,
              margin: '0 0 24px 0',
              lineHeight: '20px'
            }}>
              {confirmDialog.message}
            </p>

            {/* Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{
                  padding: '10px 24px',
                  background: 'transparent',
                  color: colors.primary,
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.primaryContainer}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                style={{
                  padding: '10px 24px',
                  background: colors.error,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#C7372F';
                  e.currentTarget.style.boxShadow = '0px 1px 3px 0px rgba(0,0,0,0.3), 0px 4px 8px 3px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.error;
                  e.currentTarget.style.boxShadow = '0px 1px 2px 0px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: toast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100px)',
            background: toast.type === 'success' ? colors.primaryContainer : colors.errorContainer,
            color: toast.type === 'success' ? colors.primary : colors.onErrorContainer,
            padding: '16px 24px',
            borderRadius: '28px',
            boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px 0px rgba(0,0,0,0.3)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'Roboto, system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            minWidth: '288px',
            maxWidth: '560px',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: 1,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {toast.type === 'success' ? '✓' : '⚠'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
