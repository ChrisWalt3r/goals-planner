import React, { useCallback, useEffect } from 'react';
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
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePlannerStore } from '../store';
import CustomNode from './CustomNode';
import { PlannerNode, NodeType } from '../types';
import { Plus, Search, LayoutGrid, List, Filter, Eye, EyeOff, Maximize2, Minimize2, X, Expand, Shrink } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ControlButton } from '@xyflow/react';
import { createPlannerNode, updatePlannerNode } from '../lib/plannerApi';
import { canNodeTypeBeChildOf, getAllowedParentTypes, getAllowedStructuralChildTypes } from '../lib/hierarchy';

const nodeTypes = {
  plannerNode: CustomNode,
};

const LAYOUT_NODE_WIDTHS: Record<NodeType, number> = {
  area: 260,
  goal: 240,
  project: 220,
  task: 180,
};

const LAYOUT_SIBLING_GAP = 96;
const LAYOUT_LEVEL_GAP = 280;
const LAYOUT_ROOT_GAP = 220;
const LAYOUT_PADDING_X = 80;
const LAYOUT_PADDING_Y = 96;

function buildNodeLayout(nodes: PlannerNode[]) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const childrenMap = new Map<string, PlannerNode[]>();

  for (const node of nodes) {
    if (node.type === 'task') continue;
    if (!node.parent_id || !nodeMap.has(node.parent_id)) continue;

    const children = childrenMap.get(node.parent_id) ?? [];
    children.push(node);
    childrenMap.set(node.parent_id, children);
  }

  for (const children of childrenMap.values()) {
    children.sort((first, second) => {
      const typeOrder = { area: 0, goal: 1, project: 2, task: 3 } as const;
      const typeDiff = typeOrder[first.type] - typeOrder[second.type];
      if (typeDiff !== 0) return typeDiff;
      return first.title.localeCompare(second.title);
    });
  }

  const widthCache = new Map<string, number>();

  const measureSubtree = (nodeId: string, trail = new Set<string>()): number => {
    if (widthCache.has(nodeId)) return widthCache.get(nodeId)!;
    if (trail.has(nodeId)) return LAYOUT_NODE_WIDTHS.project;

    const node = nodeMap.get(nodeId);
    if (!node) return 0;

    trail.add(nodeId);
    const nodeWidth = LAYOUT_NODE_WIDTHS[node.type] ?? LAYOUT_NODE_WIDTHS.project;
    const children = childrenMap.get(nodeId) ?? [];

    if (children.length === 0) {
      widthCache.set(nodeId, nodeWidth);
      trail.delete(nodeId);
      return nodeWidth;
    }

    const childrenWidth = children.reduce((total, child, index) => {
      const childWidth = measureSubtree(child.id, trail);
      return total + childWidth + (index > 0 ? LAYOUT_SIBLING_GAP : 0);
    }, 0);

    const width = Math.max(nodeWidth, childrenWidth);
    widthCache.set(nodeId, width);
    trail.delete(nodeId);
    return width;
  };

  const roots = nodes.filter(node => node.type !== 'task' && (!node.parent_id || !nodeMap.has(node.parent_id)));

  if (roots.length === 0) {
    return new Map<string, { x: number; y: number }>();
  }

  roots.sort((first, second) => {
    const typeOrder = { area: 0, goal: 1, project: 2, task: 3 } as const;
    const typeDiff = typeOrder[first.type] - typeOrder[second.type];
    if (typeDiff !== 0) return typeDiff;
    return first.title.localeCompare(second.title);
  });

  roots.forEach(root => measureSubtree(root.id));

  const positions = new Map<string, { x: number; y: number }>();

  const placeNode = (nodeId: string, left: number, depth: number, trail = new Set<string>()) => {
    if (trail.has(nodeId)) return;

    const node = nodeMap.get(nodeId);
    if (!node) return;

    trail.add(nodeId);

    const nodeWidth = LAYOUT_NODE_WIDTHS[node.type] ?? LAYOUT_NODE_WIDTHS.project;
    const subtreeWidth = widthCache.get(nodeId) ?? nodeWidth;
    const children = childrenMap.get(nodeId) ?? [];
    const totalChildrenWidth = children.reduce((total, child, index) => {
      const childWidth = widthCache.get(child.id) ?? LAYOUT_NODE_WIDTHS[child.type];
      return total + childWidth + (index > 0 ? LAYOUT_SIBLING_GAP : 0);
    }, 0);

    const nodeX = left + Math.max(0, (subtreeWidth - nodeWidth) / 2);
    const nodeY = LAYOUT_PADDING_Y + depth * LAYOUT_LEVEL_GAP;
    positions.set(nodeId, { x: nodeX, y: nodeY });

    if (children.length > 0) {
      let childLeft = left + Math.max(0, (subtreeWidth - totalChildrenWidth) / 2);
      for (const child of children) {
        const childWidth = widthCache.get(child.id) ?? LAYOUT_NODE_WIDTHS[child.type];
        placeNode(child.id, childLeft, depth + 1, trail);
        childLeft += childWidth + LAYOUT_SIBLING_GAP;
      }
    }

    trail.delete(nodeId);
  };

  let currentLeft = LAYOUT_PADDING_X;
  for (const root of roots) {
    const rootWidth = widthCache.get(root.id) ?? LAYOUT_NODE_WIDTHS[root.type];
    placeNode(root.id, currentLeft, 0);
    currentLeft += rootWidth + LAYOUT_ROOT_GAP;
  }

  return positions;
}

type PlannerNodeData = {
  node: PlannerNode;
  isCollapsed?: boolean;
  isTaskListHidden?: boolean;
  hasTaskChildren?: boolean;
  childrenTasks?: PlannerNode[];
  onAddTask?: () => void;
  onToggleTask?: (taskId: string) => void;
  onTaskClick?: (task: PlannerNode) => void;
  onAddChildNode?: () => void;
  onOpenContextMenu?: (x: number, y: number) => void;
};

interface MindMapProps {
  onNodeSelect: (node: PlannerNode | null) => void;
  selectedNode?: PlannerNode | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function MindMap({ onNodeSelect, selectedNode, isFullscreen, onToggleFullscreen }: MindMapProps) {
  const { nodes: storeNodes, addNode, updateNode, user } = usePlannerStore();
  const userId = user?.id;
  const [nodes, setNodesState, onNodesChange] = useNodesState<Node<PlannerNodeData>>([]);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilters, setSelectedFilters] = React.useState<Set<NodeType>>(new Set(['area', 'goal', 'project', 'task']));
  const [focusNodeId, setFocusNodeId] = React.useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = React.useState<Set<string>>(new Set());
  const [hiddenTaskProjectIds, setHiddenTaskProjectIds] = React.useState<Set<string>>(new Set());
  const [menu, setMenu] = React.useState<{ x: number, y: number, nodeId: string, nodeType: NodeType } | null>(null);
  const [addChildPanel, setAddChildPanel] = React.useState<{ parentId: string; childType: NodeType } | null>(null);

  useEffect(() => {
    if (!selectedNode) {
      setFocusNodeId(null);
      return;
    }

    setFocusNodeId(selectedNode.type === 'task' ? selectedNode.parent_id ?? null : selectedNode.id);
  }, [selectedNode]);

  useEffect(() => {
    if (!reactFlowInstance || !focusNodeId) return;

    const frame = window.requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.25, duration: 400 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusNodeId, reactFlowInstance, nodes, edges]);

  // Helper to check if a node is a descendant of another
  const isDescendant = useCallback((childId: string, ancestorId: string) => {
    let current = storeNodes.find(n => n.id === childId);
    while (current && current.parent_id) {
      if (current.parent_id === ancestorId) return true;
      current = storeNodes.find(n => n.id === current!.parent_id);
    }
    return false;
  }, [storeNodes]);

  // Hierarchy Validation
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = storeNodes.find(n => n.id === connection.source);
    const targetNode = storeNodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) return false;
    if (sourceNode.id === targetNode.id) return false;
    if (!canNodeTypeBeChildOf(targetNode.type, sourceNode.type)) return false;

    // Prevent cycles when reconnecting existing nodes.
    if (isDescendant(sourceNode.id, targetNode.id)) return false;

    return true;
  }, [isDescendant, storeNodes]);

  // Helper to check if any ancestor is collapsed
  const isCollapsed = useCallback((nodeId: string) => {
    let current = storeNodes.find(n => n.id === nodeId);
    while (current && current.parent_id) {
      if (collapsedNodeIds.has(current.parent_id)) return true;
      current = storeNodes.find(n => n.id === current!.parent_id);
    }
    return false;
  }, [storeNodes, collapsedNodeIds]);

  const openNodeMenu = useCallback((nodeId: string, nodeType: NodeType, x: number, y: number) => {
    if (nodeType !== 'area' && nodeType !== 'goal' && nodeType !== 'project') return;
    setMenu({ x, y, nodeId, nodeType });
  }, []);

  const toggleBranchCollapse = useCallback((nodeId: string) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    setMenu(null);
  }, []);

  const toggleProjectTasks = useCallback((projectId: string) => {
    setHiddenTaskProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    setMenu(null);
  }, []);

  const openAddChildPanel = useCallback((parentId: string) => {
    const parentNode = storeNodes.find(node => node.id === parentId);
    if (!parentNode || parentNode.type === 'task') return;

    const allowedTypes = getAllowedStructuralChildTypes(parentNode.type);
    if (allowedTypes.length === 0) return;

    setAddChildPanel({ parentId, childType: allowedTypes[0] });
    setMenu(null);
  }, [storeNodes]);

  const createNewNode = async (type: NodeType = 'task', parentId: string | null = null): Promise<PlannerNode | null> => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 12);
    
    // Default positions
    let x = Math.random() * 400;
    let y = Math.random() * 400;

    // If we have a parent, position it relative to the parent
    if (parentId) {
      const parent = storeNodes.find(n => n.id === parentId);
      if (parent) {
        if (!canNodeTypeBeChildOf(type, parent.type)) {
          return null;
        }

        x = parent.position_x + (Math.random() - 0.5) * 200;
        y = parent.position_y + 150;
      }
    }

    const newNode: PlannerNode = {
      id,
      parent_id: parentId,
      type,
      title: '',
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
    onNodeSelect(newNode);
    
    try {
      await createPlannerNode(newNode, userId);
    } catch (err) {
      console.error('Failed to save new node to DB:', err);
    }

    return newNode;
  };

  const handleSelectChildType = useCallback(async (childType: NodeType) => {
    if (!addChildPanel) return;

    const createdNode = await createNewNode(childType, addChildPanel.parentId);
    if (createdNode) {
      setAddChildPanel(null);
    }
  }, [addChildPanel, createNewNode]);

  useEffect(() => {
    if (!addChildPanel) return;

    const parentNode = storeNodes.find(node => node.id === addChildPanel.parentId);
    if (!parentNode) {
      setAddChildPanel(null);
      return;
    }

    const allowedTypes = getAllowedStructuralChildTypes(parentNode.type);
    if (allowedTypes.length === 0) {
      setAddChildPanel(null);
      return;
    }

    if (!allowedTypes.includes(addChildPanel.childType)) {
      setAddChildPanel({ parentId: addChildPanel.parentId, childType: allowedTypes[0] });
    }
  }, [addChildPanel, storeNodes]);

  const toggleTaskStatus = useCallback(async (taskId: string) => {
    const task = storeNodes.find(n => n.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
    const newProgress = newStatus === 'completed' ? 100 : 0;
    
    const updates = { status: newStatus as any, progress: newProgress };
    updateNode(taskId, updates);

    await updatePlannerNode(taskId, updates, userId);
  }, [storeNodes, updateNode, userId]);

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
      const projectTasks = storeNodes.filter(n => n.parent_id === node.id && n.type === 'task');
      const childrenTasks = node.type === 'project' && selectedFilters.has('task') && !hiddenTaskProjectIds.has(node.id)
        ? projectTasks
        : [];

      return {
        id: node.id,
        type: 'plannerNode',
        position: { x: node.position_x, y: node.position_y },
        data: { 
          node,
          isCollapsed: collapsedNodeIds.has(node.id),
          isTaskListHidden: node.type === 'project' && hiddenTaskProjectIds.has(node.id),
          hasTaskChildren: projectTasks.length > 0,
          childrenTasks,
          onAddTask: () => createNewNode('task', node.id),
          onToggleTask: (taskId: string) => toggleTaskStatus(taskId),
          onTaskClick: (task: PlannerNode) => onNodeSelect(task),
          onAddChildNode: () => openAddChildPanel(node.id),
          onOpenContextMenu: (x: number, y: number) => openNodeMenu(node.id, node.type, x, y),
        },
      };
    });

    const flowEdges: Edge[] = filteredStoreNodes
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
      .filter(Boolean) as Edge[];

    setNodesState((prevNodes) => {
      // Merge with previous nodes to retain React Flow's internal states like `measured`, `selected`, and `dragging` offsets
      return flowNodes.map((newNode) => {
        const existingNode = prevNodes.find(n => n.id === newNode.id);
        if (existingNode) {
          return { ...existingNode, ...newNode, position: newNode.position, data: newNode.data };
        }
        return newNode;
      });
    });
    setEdgesState(flowEdges);
  }, [storeNodes, setNodesState, setEdgesState, selectedFilters, searchQuery, focusNodeId, collapsedNodeIds, hiddenTaskProjectIds, isDescendant, isCollapsed, openNodeMenu, openAddChildPanel]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (isValidConnection(params)) {
        setEdgesState((eds) => addEdge(params, eds));
        // Also update the store
        const targetNode = storeNodes.find(n => n.id === params.target);
        if (targetNode) {
          const updates = { parent_id: params.source };
          updateNode(targetNode.id, updates);
          void updatePlannerNode(targetNode.id, updates, userId);
        }
      }
    },
    [setEdgesState, isValidConnection, storeNodes, updateNode, userId]
  );

  const onNodeClick = useCallback((_: any, node: any) => {
    onNodeSelect(node.data.node);
    setMenu(null);
  }, [onNodeSelect]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    openNodeMenu(node.id, node.data.node.type, event.clientX, event.clientY);
  }, [openNodeMenu]);

  const onPaneClick = useCallback(() => {
    setMenu(null);
    setAddChildPanel(null);
    onNodeSelect(null);
  }, [onNodeSelect]);

  const toggleFocus = (nodeId: string) => {
    setFocusNodeId(prev => prev === nodeId ? null : nodeId);
    setMenu(null);
  };

  const onNodeDragStop = useCallback(async (_: any, node: any) => {
    const updatedNode = storeNodes.find(n => n.id === node.id);
    if (updatedNode) {
      // Use absolute position in case of relative node coordinates
      const x = node.positionAbsolute?.x ?? node.position.x;
      const y = node.positionAbsolute?.y ?? node.position.y;
      const updates = { position_x: x, position_y: y };
      
      updateNode(node.id, updates);
      await updatePlannerNode(node.id, updates, userId);
    }
  }, [storeNodes, updateNode, userId]);

  const reorganizeNodes = useCallback(async () => {
    setMenu(null);
    setFocusNodeId(null);

    try {
      const layoutPositions = buildNodeLayout(storeNodes);
      const visibleLayoutNodes = storeNodes.filter(node => node.type !== 'task' && layoutPositions.has(node.id));

      for (const node of visibleLayoutNodes) {
        const position = layoutPositions.get(node.id);
        if (!position) continue;

        const updates = { position_x: position.x, position_y: position.y };
        updateNode(node.id, updates);

        void updatePlannerNode(node.id, updates, userId).catch((error) => {
          console.error('Failed to persist reorganized node position', error);
        });
      }

      if (reactFlowInstance) {
        window.requestAnimationFrame(() => {
          reactFlowInstance.fitView({ padding: 0.25, duration: 400 });
        });
      }
    } finally {
      window.setTimeout(() => onNodeSelect(null), 150);
    }
  }, [onNodeSelect, reactFlowInstance, storeNodes, updateNode, userId]);

  const addChildParentNode = React.useMemo(() => {
    if (!addChildPanel) return null;
    return storeNodes.find(node => node.id === addChildPanel.parentId) ?? null;
  }, [addChildPanel, storeNodes]);

  const addChildTypeOptions = React.useMemo(() => {
    if (!addChildParentNode) return [] as NodeType[];
    return getAllowedStructuralChildTypes(addChildParentNode.type);
  }, [addChildParentNode]);

  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <ReactFlow
        onInit={setReactFlowInstance}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeClick}
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
            onClick={reorganizeNodes}
            title="Reorganize nodes"
            className="hover:bg-white/5 transition-colors"
          >
            <LayoutGrid className="w-4 h-4 text-white" />
          </ControlButton>
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
                className="bg-[#1a1a1a] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl min-w-45"
              >
                <button 
                  onClick={() => toggleFocus(menu.nodeId)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-xs font-medium text-white/70 hover:text-white"
                >
                  {focusNodeId === menu.nodeId ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {focusNodeId === menu.nodeId ? 'Show All Nodes' : 'Focus on Branch'}
                </button>
                <button 
                  onClick={() => {
                    if (menu.nodeType === 'project') {
                      toggleProjectTasks(menu.nodeId);
                      return;
                    }

                    toggleBranchCollapse(menu.nodeId);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-xs font-medium text-white/70 hover:text-white"
                >
                  {menu.nodeType === 'project' ? (
                    hiddenTaskProjectIds.has(menu.nodeId) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />
                  ) : (
                    collapsedNodeIds.has(menu.nodeId) ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />
                  )}
                  {menu.nodeType === 'project'
                    ? hiddenTaskProjectIds.has(menu.nodeId)
                      ? 'Show Tasks'
                      : 'Hide Tasks'
                    : collapsedNodeIds.has(menu.nodeId)
                      ? 'Show Children'
                      : 'Hide Children'}
                </button>
              </motion.div>
            </Panel>
          )}
        </AnimatePresence>

        {!isFullscreen && (
          <>
            <Panel position="top-right" className="hidden lg:flex justify-end">
              <div className="flex flex-wrap justify-end bg-[#1a1a1a] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl max-w-full">
                <button 
                  onClick={() => {
                    const canAttachToSelected = selectedNode && getAllowedParentTypes('area').includes(selectedNode.type);
                    const parentId = canAttachToSelected ? selectedNode.id : null;
                    createNewNode('area', parentId);
                  }}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-medium whitespace-nowrap"
                >
                  <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> Area
                </button>
                <div className="w-px bg-white/10 mx-1 my-2" />
                <button 
                  onClick={() => {
                    const canAttachToSelected = selectedNode && getAllowedParentTypes('goal').includes(selectedNode.type);
                    const parentId = canAttachToSelected ? selectedNode.id : null;
                    createNewNode('goal', parentId);
                  }}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-medium whitespace-nowrap"
                >
                  <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> Goal
                </button>
                <div className="w-px bg-white/10 mx-1 my-2" />
                <button 
                  onClick={() => {
                    const canAttachToSelected = selectedNode && getAllowedParentTypes('project').includes(selectedNode.type);
                    const parentId = canAttachToSelected ? selectedNode.id : null;
                    createNewNode('project', parentId);
                  }}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-medium whitespace-nowrap"
                >
                  <Plus className="w-3 h-3 lg:w-4 lg:h-4" /> Project
                </button>
              </div>
            </Panel>

            <Panel position="top-left" className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative group w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search nodes..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 w-full shadow-2xl backdrop-blur-xl"
                />
              </div>

              <div className="flex flex-wrap bg-[#1a1a1a] border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-xl gap-1 max-w-full">
                <button 
                  onClick={() => {
                    const newFilters = new Set(selectedFilters);
                    if (newFilters.has('area')) newFilters.delete('area');
                    else newFilters.add('area');
                    setSelectedFilters(newFilters);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest whitespace-nowrap",
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
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest whitespace-nowrap",
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
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest whitespace-nowrap",
                    selectedFilters.has('project') ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  Projects
                </button>
                <button 
                  onClick={() => {
                    const newFilters = new Set(selectedFilters);
                    if (newFilters.has('task')) newFilters.delete('task');
                    else newFilters.add('task');
                    setSelectedFilters(newFilters);
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-all text-[10px] lg:text-xs font-bold uppercase tracking-widest whitespace-nowrap",
                    selectedFilters.has('task') ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  Tasks
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full lg:hidden">
                <button 
                  onClick={() => {
                    const canAttachToSelected = selectedNode && getAllowedParentTypes('area').includes(selectedNode.type);
                    const parentId = canAttachToSelected ? selectedNode.id : null;
                    createNewNode('area', parentId);
                  }}
                  className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 text-[10px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> Area
                </button>
                <button 
                  onClick={() => {
                    const canAttachToSelected = selectedNode && getAllowedParentTypes('goal').includes(selectedNode.type);
                    const parentId = canAttachToSelected ? selectedNode.id : null;
                    createNewNode('goal', parentId);
                  }}
                  className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 text-[10px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> Goal
                </button>
                <button 
                  onClick={() => {
                    const canAttachToSelected = selectedNode && getAllowedParentTypes('project').includes(selectedNode.type);
                    const parentId = canAttachToSelected ? selectedNode.id : null;
                    createNewNode('project', parentId);
                  }}
                  className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2 text-[10px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> Project
                </button>
              </div>

              {focusNodeId && (
                <div className="flex bg-blue-500/20 border border-blue-500/30 rounded-xl p-1 shadow-2xl backdrop-blur-xl items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Focused View</span>
                  <button 
                    onClick={() => setFocusNodeId(null)}
                    title="Clear focused view"
                    aria-label="Clear focused view"
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

      <AnimatePresence>
        {addChildPanel && addChildParentNode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddChildPanel(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 z-50 h-full w-full sm:w-96 bg-[#111] border-l border-white/10 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/5 bg-[#161616] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Add Child Node</p>
                  <h2 className="text-lg font-bold tracking-tight mt-1">{addChildParentNode.title || 'Untitled node'}</h2>
                  <p className="text-xs text-white/45 mt-1">Parent type: {addChildParentNode.type}</p>
                </div>
                <button
                  onClick={() => setAddChildPanel(null)}
                  title="Close child creator"
                  aria-label="Close child creator"
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Child Node Type</label>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {addChildTypeOptions.map((typeOption) => {
                      const isSelected = addChildPanel.childType === typeOption;
                      return (
                        <button
                          key={typeOption}
                          type="button"
                          onClick={() => void handleSelectChildType(typeOption)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors',
                            isSelected
                              ? 'border-white bg-white text-black'
                              : 'border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white'
                          )}
                        >
                          {typeOption}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/55 leading-relaxed">
                  Selecting a child type creates the node immediately and opens the editor so you can add title, description, deadlines, and notes.
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
