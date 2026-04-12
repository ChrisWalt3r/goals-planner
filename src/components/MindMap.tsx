import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
  MarkerType,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePlannerStore } from '../store';
import CustomNode from './CustomNode';
import { PlannerNode, NodeType } from '../types';
import { Plus, Search, LayoutGrid, List, Filter, Eye, EyeOff, Maximize2, Minimize2, X, Expand, Shrink } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ControlButton } from '@xyflow/react';

const nodeTypes = {
  plannerNode: CustomNode,
};

type PlannerNodeData = {
  node: PlannerNode;
  isCollapsed?: boolean;
  childrenTasks?: PlannerNode[];
  onAddTask?: () => void;
};

interface MindMapProps {
  onNodeSelect: (node: PlannerNode | null) => void;
  selectedNode?: PlannerNode | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function MindMap({ onNodeSelect, selectedNode, isFullscreen, onToggleFullscreen }: MindMapProps) {
  const { nodes: storeNodes, token, setNodes, addNode, updateNode } = usePlannerStore();
  const [nodes, setNodesState, onNodesChange] = useNodesState([]);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilters, setSelectedFilters] = React.useState<Set<NodeType>>(new Set(['area', 'goal', 'project']));
  const [focusNodeId, setFocusNodeId] = React.useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = React.useState<Set<string>>(new Set());
  const [menu, setMenu] = React.useState<{ x: number, y: number, nodeId: string } | null>(null);

  // Hierarchy Validation
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = storeNodes.find(n => n.id === connection.source);
    const targetNode = storeNodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) return false;

    // Area can't be a child
    if (targetNode.type === 'area') return false;

    // Goal can only be a child of an Area
    if (targetNode.type === 'goal') {
      return sourceNode.type === 'area';
    }

    // Project can be a child of Goal or Project
    if (targetNode.type === 'project') {
      return sourceNode.type === 'goal' || sourceNode.type === 'project';
    }

    // Task can be a child of Project or Goal
    if (targetNode.type === 'task') {
      return sourceNode.type === 'project' || sourceNode.type === 'goal';
    }

    return true;
  }, [storeNodes]);

  // Helper to check if a node is a descendant of another
  const isDescendant = useCallback((childId: string, ancestorId: string) => {
    let current = storeNodes.find(n => n.id === childId);
    while (current && current.parent_id) {
      if (current.parent_id === ancestorId) return true;
      current = storeNodes.find(n => n.id === current!.parent_id);
    }
    return false;
  }, [storeNodes]);

  // Helper to check if any ancestor is collapsed
  const isCollapsed = useCallback((nodeId: string) => {
    let current = storeNodes.find(n => n.id === nodeId);
    while (current && current.parent_id) {
      if (collapsedNodeIds.has(current.parent_id)) return true;
      current = storeNodes.find(n => n.id === current!.parent_id);
    }
    return false;
  }, [storeNodes, collapsedNodeIds]);

  const createNewNode = async (type: NodeType = 'task', parentId: string | null = null) => {
    const id = Math.random().toString(36).substring(7);
    
    // Default positions
    let x = Math.random() * 400;
    let y = Math.random() * 400;

    // If we have a parent, position it relative to the parent
    if (parentId) {
      const parent = storeNodes.find(n => n.id === parentId);
      if (parent) {
        x = parent.position_x + (Math.random() - 0.5) * 200;
        y = parent.position_y + 150;
      }
    }

    const newNode: PlannerNode = {
      id,
      parent_id: parentId,
      type,
      title: `New ${type}`,
      description: '',
      status: 'not-started',
      progress: 0,
      deadline: null,
      position_x: x,
      position_y: y,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addNode(newNode);
    await fetch('/api/nodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(newNode),
    });
    onNodeSelect(newNode);
  };

  const toggleTaskStatus = useCallback(async (taskId: string) => {
    const task = storeNodes.find(n => n.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
    const newProgress = newStatus === 'completed' ? 100 : 0;
    
    const updates = { status: newStatus as any, progress: newProgress };
    updateNode(taskId, updates);

    await fetch(`/api/nodes/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ...task, ...updates }),
    });
  }, [storeNodes, updateNode, token]);

  // Sync store nodes to React Flow nodes with filtering
  useEffect(() => {
    const filteredStoreNodes = storeNodes.filter(node => {
      // 0. Don't render tasks as separate nodes
      if (node.type === 'task') return false;

      // 1. Search Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!node.title.toLowerCase().includes(query) && !node.description?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 2. Type Filter
      if (!selectedFilters.has(node.type)) return false;

      // 3. Focus Filter
      if (focusNodeId && node.id !== focusNodeId && !isDescendant(node.id, focusNodeId)) return false;

      // 4. Collapse Filter
      if (isCollapsed(node.id)) return false;

      return true;
    });

    const getVisibleParent = (nodeId: string): string | null => {
      let current = storeNodes.find(n => n.id === nodeId);
      while (current && current.parent_id) {
        const parentId = current.parent_id;
        const parent = storeNodes.find(n => n.id === parentId);
        if (!parent) return null;
        if (filteredStoreNodes.some(n => n.id === parent.id)) {
          return parent.id;
        }
        current = parent;
      }
      return null;
    };

    const flowNodes: Node<PlannerNodeData>[] = filteredStoreNodes.map((node) => {
      // Find children tasks
      const childrenTasks = storeNodes.filter(n => n.parent_id === node.id && n.type === 'task');

      return {
        id: node.id,
        type: 'plannerNode',
        position: { x: node.position_x, y: node.position_y },
        data: { 
          node,
          isCollapsed: collapsedNodeIds.has(node.id),
          childrenTasks,
          onAddTask: () => createNewNode('task', node.id),
          onToggleTask: (taskId: string) => toggleTaskStatus(taskId),
          onTaskClick: (task: PlannerNode) => onNodeSelect(task)
        },
      };
    });

    const flowEdges = filteredStoreNodes
      .map((node) => {
        const visibleParentId = getVisibleParent(node.id);
        if (!visibleParentId) return null;
        return {
          id: `e-${visibleParentId}-${node.id}`,
          source: visibleParentId,
          target: node.id,
          animated: true,
          style: { stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.2)' },
        };
      })
      .filter(Boolean) as any[];

    setNodesState(flowNodes);
    setEdgesState(flowEdges);
  }, [storeNodes, setNodesState, setEdgesState, selectedFilters, searchQuery, focusNodeId, collapsedNodeIds, isDescendant, isCollapsed]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (isValidConnection(params)) {
        setEdgesState((eds) => addEdge(params, eds));
        // Also update the store
        const targetNode = storeNodes.find(n => n.id === params.target);
        if (targetNode) {
          const updates = { parent_id: params.source };
          updateNode(targetNode.id, updates);
          fetch(`/api/nodes/${targetNode.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ ...targetNode, ...updates }),
          });
        }
      }
    },
    [setEdgesState, isValidConnection, storeNodes, updateNode, token]
  );

  const onNodeClick = useCallback((_: any, node: any) => {
    onNodeSelect(node.data.node);
    setMenu(null);
  }, [onNodeSelect]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    const type = node.data.node.type;
    if (type === 'area' || type === 'goal' || type === 'project') {
      setMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    }
  }, []);

  const onPaneClick = useCallback(() => setMenu(null), []);

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    setMenu(null);
  };

  const toggleFocus = (nodeId: string) => {
    setFocusNodeId(prev => prev === nodeId ? null : nodeId);
    setMenu(null);
  };

  const onNodeDragStop = useCallback(async (_: any, node: any) => {
    const updatedNode = storeNodes.find(n => n.id === node.id);
    if (updatedNode) {
      const updates = { position_x: node.position.x, position_y: node.position.y };
      updateNode(node.id, updates);
      
      await fetch(`/api/nodes/${node.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...updatedNode, ...updates }),
      });
    }
  }, [storeNodes, updateNode, token]);

  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#0a0a0a]"
        colorMode="dark"
      >
        <Background color="#333" gap={20} />
        <Controls className="bg-[#1a1a1a] border-white/10 fill-white">
          <ControlButton 
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="hover:bg-white/5 transition-colors"
          >
            {isFullscreen ? <Shrink className="w-4 h-4 text-white" /> : <Expand className="w-4 h-4 text-white" />}
          </ControlButton>
        </Controls>
        {!isFullscreen && (
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'plannerNode') return '#3b82f6';
              return '#fff';
            }}
            maskColor="rgba(0,0,0,0.6)"
            className="bg-[#1a1a1a] border-white/10"
          />
        )}
        
        <AnimatePresence>
          {menu && (
            <Panel position="top-left" style={{ position: 'absolute', left: menu.x, top: menu.y, margin: 0 }}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1a1a1a] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl min-w-[180px]"
              >
                <button 
                  onClick={() => toggleFocus(menu.nodeId)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-xs font-medium text-white/70 hover:text-white"
                >
                  {focusNodeId === menu.nodeId ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {focusNodeId === menu.nodeId ? 'Show All Nodes' : 'Focus on Branch'}
                </button>
                <button 
                  onClick={() => toggleCollapse(menu.nodeId)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-xs font-medium text-white/70 hover:text-white"
                >
                  {collapsedNodeIds.has(menu.nodeId) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {collapsedNodeIds.has(menu.nodeId) ? 'Show Children' : 'Hide Children'}
                </button>
              </motion.div>
            </Panel>
          )}
        </AnimatePresence>

        {!isFullscreen && (
          <>
            <Panel position="top-right" className="flex gap-2">
              <div className="flex bg-[#1a1a1a] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl">
                <button 
                  onClick={() => createNewNode('area')}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-medium"
                >
                  <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> Area
                </button>
                <div className="w-px bg-white/10 mx-1 my-2" />
                <button 
                  onClick={() => {
                    const parentId = selectedNode?.type === 'area' ? selectedNode.id : null;
                    createNewNode('goal', parentId);
                  }}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-medium"
                >
                  <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> Goal
                </button>
                <div className="w-px bg-white/10 mx-1 my-2" />
                <button 
                  onClick={() => {
                    const parentId = (selectedNode?.type === 'goal' || selectedNode?.type === 'project') ? selectedNode.id : null;
                    createNewNode('project', parentId);
                  }}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-medium"
                >
                  <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> Project
                </button>
              </div>
            </Panel>

            <Panel position="top-left" className="flex gap-4 items-center">
              <div className="relative group hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search nodes..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 w-40 lg:w-64 shadow-2xl backdrop-blur-xl"
                />
              </div>

              <div className="flex bg-[#1a1a1a] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl">
                <button 
                  onClick={() => {
                    const newFilters = new Set(selectedFilters);
                    if (newFilters.has('area')) newFilters.delete('area');
                    else newFilters.add('area');
                    setSelectedFilters(newFilters);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest",
                    selectedFilters.has('area') ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  Areas
                </button>
                <button 
                  onClick={() => {
                    const newFilters = new Set(selectedFilters);
                    if (newFilters.has('goal')) newFilters.delete('goal');
                    else newFilters.add('goal');
                    setSelectedFilters(newFilters);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest",
                    selectedFilters.has('goal') ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  Goals
                </button>
                <button 
                  onClick={() => {
                    const newFilters = new Set(selectedFilters);
                    if (newFilters.has('project')) newFilters.delete('project');
                    else newFilters.add('project');
                    setSelectedFilters(newFilters);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest",
                    selectedFilters.has('project') ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  Projects
                </button>
              </div>

              {focusNodeId && (
                <div className="flex bg-blue-500/20 border border-blue-500/30 rounded-xl p-1 shadow-2xl backdrop-blur-xl items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Focused View</span>
                  <button 
                    onClick={() => setFocusNodeId(null)}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-blue-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </Panel>
          </>
        )}
      </ReactFlow>
    </div>
  );
}
