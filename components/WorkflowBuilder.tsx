'use client';

import { useState, useRef, useEffect } from 'react';
import { FlowNode, FlowEdge } from '@/lib/flows/types';
import { useTheme } from '@/components/ThemeProvider';

interface WorkflowBuilderProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
}

interface Position {
  x: number;
  y: number;
}

interface NodeWithPosition extends FlowNode {
  position: Position;
}

const NODE_TYPES = [
  { type: 'trigger' as const, label: 'Trigger', icon: '⚡', color: '#6750A4' },
  { type: 'llm' as const, label: 'LLM', icon: '🤖', color: '#7D5260' },
  { type: 'memory' as const, label: 'Memory', icon: '💾', color: '#625B71' },
  { type: 'action' as const, label: 'Action', icon: '🎯', color: '#4A6353' },
];

export default function WorkflowBuilder({ nodes, edges, onNodesChange, onEdgesChange }: WorkflowBuilderProps) {
  const { theme } = useTheme();
  const [nodesWithPos, setNodesWithPos] = useState<NodeWithPosition[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    model: true,
    temperature: true,
    systemPrompt: true,
    memory: true,
    trigger: true,
    action: true
  });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Initialize positions for existing nodes
  useEffect(() => {
    // Sync with parent nodes, preserving existing positions
    if (nodes.length > 0) {
      const positioned = nodes.map((node, idx) => {
        // Check if we already have position for this node
        const existing = nodesWithPos.find(n => n.id === node.id);
        return {
          ...node,
          position: existing?.position || { x: 100 + idx * 250, y: 200 }
        };
      });

      // Only update if actually different
      if (JSON.stringify(positioned.map(n => n.id)) !== JSON.stringify(nodesWithPos.map(n => n.id))) {
        setNodesWithPos(positioned);
      }
    } else if (nodes.length === 0 && nodesWithPos.length > 0) {
      // Clear when parent clears
      setNodesWithPos([]);
    }
  }, [nodes]);

  const addNode = (type: FlowNode['type']) => {
    const newNode: NodeWithPosition = {
      id: `${type}-${Date.now()}`,
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      config: {},
      position: { x: 150, y: 150 }
    };
    const updated = [...nodesWithPos, newNode];
    setNodesWithPos(updated);
    onNodesChange(updated);
  };

  const deleteNode = (nodeId: string) => {
    const updated = nodesWithPos.filter(n => n.id !== nodeId);
    setNodesWithPos(updated);
    onNodesChange(updated);

    // Remove connected edges
    const updatedEdges = edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    onEdgesChange(updatedEdges);

    if (selectedNode === nodeId) setSelectedNode(null);
  };

  const updateNodeLabel = (nodeId: string, label: string) => {
    const updated = nodesWithPos.map(n => n.id === nodeId ? { ...n, label } : n);
    setNodesWithPos(updated);
    onNodesChange(updated);
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    const updated = nodesWithPos.map(n => n.id === nodeId ? { ...n, config } : n);
    setNodesWithPos(updated);
    onNodesChange(updated);
  };

  const startConnection = (nodeId: string) => {
    setConnectingFrom(nodeId);
  };

  const completeConnection = (toNodeId: string) => {
    if (connectingFrom && connectingFrom !== toNodeId) {
      const edgeExists = edges.some(e => e.from === connectingFrom && e.to === toNodeId);
      if (!edgeExists) {
        const newEdge = { from: connectingFrom, to: toNodeId };
        onEdgesChange([...edges, newEdge]);
      }
    }
    setConnectingFrom(null);
  };

  const deleteEdge = (from: string, to: string) => {
    const updated = edges.filter(e => !(e.from === from && e.to === to));
    onEdgesChange(updated);
  };

  const onMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-delete') ||
        (e.target as HTMLElement).closest('.node-connect')) {
      return;
    }
    setDraggedNode(nodeId);
    setSelectedNode(nodeId);
  };

  // Handle spacebar for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        if (canvasRef.current && !isPanning && !draggedNode) {
          canvasRef.current.style.cursor = 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning, draggedNode]);

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    // Don't pan if clicking on a node or interactive element
    const target = e.target as HTMLElement;
    const isNode = target.closest('.workflow-node');
    const isInteractive = target.closest('button') || target.closest('svg') || target.closest('input') || target.closest('textarea') || target.closest('circle') || target.closest('text');
    
    if (isNode || isInteractive) {
      return; // Let the node or interactive element handle the click
    }

    // Panning methods:
    // 1. Left mouse button (0) + Spacebar = panning
    // 2. Middle mouse button (1) = panning
    // 3. Right mouse button (2) = panning
    // 4. Left mouse button (0) on empty canvas = panning (NEW - Main feature)
    if (
      (e.button === 0 && isSpacePressed) || // Left click + Spacebar
      e.button === 1 || // Middle mouse button
      e.button === 2 || // Right click
      (e.button === 0 && !draggedNode && !isNode && !isInteractive) // Left click on empty canvas
    ) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
      e.stopPropagation();
      
      // Update cursor
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggedNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const updated = nodesWithPos.map(n => {
        if (n.id === draggedNode) {
          return {
            ...n,
            position: {
              x: Math.max(0, (e.clientX - rect.left - panOffset.x) / zoom - 75),
              y: Math.max(0, (e.clientY - rect.top - panOffset.y) / zoom - 20)
            }
          };
        }
        return n;
      });
      setNodesWithPos(updated);
      onNodesChange(updated);
    }
  };

  const onMouseUp = () => {
    setDraggedNode(null);
    setIsPanning(false);
    
    // Reset cursor
    if (canvasRef.current) {
      if (isSpacePressed) {
        canvasRef.current.style.cursor = 'grab';
      } else {
        canvasRef.current.style.cursor = 'default';
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(Math.max(0.1, zoom + delta), 3);

    // Zoom towards mouse cursor
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomRatio = newZoom / zoom;
      setPanOffset({
        x: mouseX - (mouseX - panOffset.x) * zoomRatio,
        y: mouseY - (mouseY - panOffset.y) * zoomRatio
      });
    }

    setZoom(newZoom);
  };

  const getNodePosition = (nodeId: string): Position => {
    const node = nodesWithPos.find(n => n.id === nodeId);
    return node?.position || { x: 0, y: 0 };
  };

  const selectedNodeData = nodesWithPos.find(n => n.id === selectedNode);

  return (
    <div style={{ display: 'flex', height: '100%', gap: '0' }}>
      {/* Left Sidebar - Node Palette */}
      <div style={{
        width: '200px',
        background: 'linear-gradient(180deg, var(--color-primary-container) 0%, var(--color-secondary-container) 100%)',
        padding: '20px',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          Add Nodes
        </div>
        {NODE_TYPES.map(nodeType => (
          <button
            key={nodeType.type}
            onClick={() => addNode(nodeType.type)}
            style={{
              padding: '12px 16px',
              background: 'var(--bg-canvas)',
              border: '1px solid ' + nodeType.color,
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: nodeType.color,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = nodeType.color;
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-canvas)';
              e.currentTarget.style.color = nodeType.color;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }}
          >
            <span style={{ fontSize: '18px' }}>{nodeType.icon}</span>
            {nodeType.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Zoom Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'var(--bg-card)',
          opacity: 0.95,
          padding: '8px 16px',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--color-primary)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 100,
          userSelect: 'none'
        }}>
          {Math.round(zoom * 100)}%
        </div>

        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            flex: 1,
            position: 'relative',
            background: 'var(--bg-canvas)',
            backgroundImage: `
              radial-gradient(circle, var(--bg-canvas-grid) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : draggedNode ? 'grabbing' : 'default'
          }}
        >
          {/* Draw Edges */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            {edges.map((edge, idx) => {
              const fromPos = getNodePosition(edge.from);
              const toPos = getNodePosition(edge.to);
              const x1 = fromPos.x + 75;
              const y1 = fromPos.y + 30;
              const x2 = toPos.x + 75;
              const y2 = toPos.y + 30;

              return (
                <g key={idx}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#6750A4"
                    strokeWidth={2 / zoom}
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Delete edge button */}
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r={10 / zoom}
                    fill="#B3261E"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onClick={() => deleteEdge(edge.from, edge.to)}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={12 / zoom}
                    fontWeight="bold"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onClick={() => deleteEdge(edge.from, edge.to)}
                  >
                    ×
                  </text>
                </g>
              );
            })}
            </g>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#6750A4" />
              </marker>
            </defs>
          </svg>

          {/* Draw Nodes */}
          {nodesWithPos.map(node => {
            const nodeTypeInfo = NODE_TYPES.find(nt => nt.type === node.type);
            const isSelected = selectedNode === node.id;
            const isConnecting = connectingFrom === node.id;

            // Check if this node has any connections
            const hasConnections = edges.some(e => e.from === node.id || e.to === node.id);
            const connectionCount = edges.filter(e => e.from === node.id || e.to === node.id).length;

            return (
              <div
                key={node.id}
                className="workflow-node"
                onMouseDown={(e) => onMouseDown(node.id, e)}
                style={{
                  position: 'absolute',
                  left: node.position.x * zoom + panOffset.x,
                  top: node.position.y * zoom + panOffset.y,
                  width: '150px',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  background: isSelected ? nodeTypeInfo?.color : 'var(--bg-card)',
                  color: isSelected ? 'var(--text-on-primary)' : 'var(--text-primary)',
                  border: `2px solid ${isConnecting ? '#FFC107' : nodeTypeInfo?.color}`,
                  borderRadius: '16px',
                  padding: '12px',
                  cursor: draggedNode === node.id ? 'grabbing' : 'grab',
                  boxShadow: isSelected
                    ? '0 8px 16px rgba(0,0,0,0.2)'
                    : '0 2px 8px rgba(0,0,0,0.1)',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.2s',
                  zIndex: isSelected ? 1000 : 1
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  <span style={{ fontSize: '16px' }}>{nodeTypeInfo?.icon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.label}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '4px',
                  marginTop: '8px'
                }}>
                  <button
                    className="node-connect"
                    onClick={() => connectingFrom === node.id ? setConnectingFrom(null) : startConnection(node.id)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: isConnecting ? '#FFC107' : hasConnections ? '#4CAF50' : (isSelected ? 'rgba(255,255,255,0.2)' : '#EADDFF'),
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '500',
                      color: isSelected ? '#FFFFFF' : hasConnections ? '#FFFFFF' : '#6750A4'
                    }}
                  >
                    {isConnecting ? '🔗 Click target' : hasConnections ? `✓ ${connectionCount} Connected` : '🔗 Connect'}
                  </button>
                  <button
                    className="node-delete"
                    onClick={() => deleteNode(node.id)}
                    style={{
                      padding: '6px 10px',
                      background: isSelected ? 'rgba(255,255,255,0.2)' : '#F2B8B5',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '500',
                      color: isSelected ? '#FFFFFF' : '#B3261E'
                    }}
                  >
                    🗑️
                  </button>
                </div>

                {connectingFrom && connectingFrom !== node.id && (
                  <button
                    onClick={() => completeConnection(node.id)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '6px',
                      background: '#4CAF50',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#FFFFFF'
                    }}
                  >
                    ✓ Connect here
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Sidebar - Node Properties */}
      {selectedNodeData && (
        <div style={{
          width: isSidebarOpen ? '280px' : '0px',
          background: 'linear-gradient(180deg, var(--color-secondary-container) 0%, var(--color-primary-container) 100%)',
          padding: isSidebarOpen ? '20px' : '0',
          borderLeft: isSidebarOpen ? '1px solid var(--border-light)' : 'none',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative'
        }}>
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              position: 'absolute',
              left: isSidebarOpen ? '-16px' : '-40px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              background: 'var(--color-primary)',
              color: 'var(--text-on-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0px 2px 4px 0px rgba(0,0,0,0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-primary-container)';
              e.currentTarget.style.boxShadow = '0px 4px 8px 0px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-primary)';
              e.currentTarget.style.boxShadow = '0px 2px 4px 0px rgba(0,0,0,0.2)';
            }}
          >
            <span style={{
              transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s'
            }}>
              ❯
            </span>
          </button>

          {isSidebarOpen && (
            <>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>{NODE_TYPES.find(nt => nt.type === selectedNodeData.type)?.icon}</span>
                Node Properties
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Basic Properties Section */}
            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => toggleSection('basic')}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1D1B20'
                }}
              >
                <span>Basic Properties</span>
                <span style={{
                  transform: expandedSections.basic ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}>
                  ▼
                </span>
              </button>
              {expandedSections.basic && (
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text-secondary)',
                      marginBottom: '6px'
                    }}>
                      Label
                    </label>
                    <input
                      type="text"
                      value={selectedNodeData.label}
                      onChange={(e) => updateNodeLabel(selectedNodeData.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        background: 'var(--bg-card)',
                        color: '#1D1B20'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text-secondary)',
                      marginBottom: '6px'
                    }}>
                      Type
                    </label>
                    <div style={{
                      padding: '10px 12px',
                      background: 'var(--color-surface-variant)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-light)'
                    }}>
                      {selectedNodeData.type}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedNodeData.type === 'llm' && (
              <>
                {/* Model Section */}
                <div style={{
                  background: 'var(--bg-canvas)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-light)',
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => toggleSection('model')}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1D1B20'
                    }}
                  >
                    <span>Model</span>
                    <span style={{
                      transform: expandedSections.model ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▼
                    </span>
                  </button>
                  {expandedSections.model && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <select
                        value={selectedNodeData.config?.model || 'gpt-4o-mini'}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                          ...selectedNodeData.config,
                          model: e.target.value
                        })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="gpt-4o-mini">GPT-4O Mini</option>
                        <option value="gpt-4o">GPT-4O</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Temperature Section */}
                <div style={{
                  background: 'var(--bg-canvas)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-light)',
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => toggleSection('temperature')}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1D1B20'
                    }}
                  >
                    <span>Temperature: {selectedNodeData.config?.temperature || 0.7}</span>
                    <span style={{
                      transform: expandedSections.temperature ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▼
                    </span>
                  </button>
                  {expandedSections.temperature && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={selectedNodeData.config?.temperature || 0.7}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                          ...selectedNodeData.config,
                          temperature: parseFloat(e.target.value)
                        })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}
                </div>

                {/* System Prompt Section */}
                <div style={{
                  background: 'var(--bg-canvas)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-light)',
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => toggleSection('systemPrompt')}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1D1B20'
                    }}
                  >
                    <span>System Prompt</span>
                    <span style={{
                      transform: expandedSections.systemPrompt ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▼
                    </span>
                  </button>
                  {expandedSections.systemPrompt && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <textarea
                        value={selectedNodeData.config?.systemPrompt || ''}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                          ...selectedNodeData.config,
                          systemPrompt: e.target.value
                        })}
                        placeholder="Enter system prompt..."
                        style={{
                          width: '100%',
                          minHeight: '100px',
                          padding: '10px 12px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedNodeData.type === 'memory' && (
              <div style={{
                background: 'var(--bg-canvas)',
                borderRadius: '16px',
                border: '1px solid var(--border-light)',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => toggleSection('memory')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1D1B20'
                  }}
                >
                  <span>Memory Configuration</span>
                  <span style={{
                    transform: expandedSections.memory ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </button>
                {expandedSections.memory && (
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--text-secondary)',
                        marginBottom: '6px'
                      }}>
                        Operation
                      </label>
                      <select
                        value={selectedNodeData.config?.operation || 'read'}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                          ...selectedNodeData.config,
                          operation: e.target.value
                        })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          fontSize: '14px',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="read">Read</option>
                        <option value="write">Write</option>
                      </select>
                    </div>
                    {selectedNodeData.config?.operation === 'read' && (
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'var(--text-secondary)',
                          marginBottom: '6px'
                        }}>
                          Limit
                        </label>
                        <input
                          type="number"
                          value={selectedNodeData.config?.limit || 5}
                          onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                            ...selectedNodeData.config,
                            limit: parseInt(e.target.value)
                          })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            fontSize: '14px',
                            background: 'var(--bg-card)',
                            color: '#1D1B20'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedNodeData.type === 'trigger' && (
              <div style={{
                background: 'var(--bg-canvas)',
                borderRadius: '16px',
                border: '1px solid var(--border-light)',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => toggleSection('trigger')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1D1B20'
                  }}
                >
                  <span>Trigger Configuration</span>
                  <span style={{
                    transform: expandedSections.trigger ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </button>
                {expandedSections.trigger && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text-secondary)',
                      marginBottom: '6px'
                    }}>
                      Event Type
                    </label>
                    <input
                      type="text"
                      value={selectedNodeData.config?.event || 'chat.message'}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                        ...selectedNodeData.config,
                        event: e.target.value
                      })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        background: 'var(--bg-card)',
                        color: '#1D1B20'
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {selectedNodeData.type === 'action' && (
              <div style={{
                background: 'var(--bg-canvas)',
                borderRadius: '16px',
                border: '1px solid var(--border-light)',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => toggleSection('action')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1D1B20'
                  }}
                >
                  <span>Action Configuration</span>
                  <span style={{
                    transform: expandedSections.action ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </button>
                {expandedSections.action && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text-secondary)',
                      marginBottom: '6px'
                    }}>
                      Action Type
                    </label>
                    <select
                      value={selectedNodeData.config?.type || 'stream'}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, {
                        ...selectedNodeData.config,
                        type: e.target.value
                      })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        fontSize: '14px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="stream">Stream Response</option>
                      <option value="webhook">Call Webhook</option>
                      <option value="email">Send Email</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}
        </div>
      )}
    </div>
  );
}
