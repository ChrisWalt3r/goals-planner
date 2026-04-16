import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn, formatDeadline } from '../lib/utils';
import { NodeType, PlannerNode } from '../types';
import { CheckCircle2, Circle, Clock, ChevronDown, EyeOff, Plus } from 'lucide-react';

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

type CustomNodeProps = NodeProps<Node<PlannerNodeData>>;

const CustomNode = ({ data, selected }: CustomNodeProps) => {
  const {
    node,
    isCollapsed,
    isTaskListHidden,
    hasTaskChildren,
    childrenTasks,
    onAddTask,
    onToggleTask,
    onTaskClick,
    onAddChildNode,
    onOpenContextMenu,
  } = data;

  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressStartRef.current = null;
  }, []);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddChildNode?.();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onOpenContextMenu) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;

    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      onOpenContextMenu(longPressStartRef.current?.x ?? event.clientX, longPressStartRef.current?.y ?? event.clientY);
    }, 500);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!longPressStartRef.current || longPressTimerRef.current === null) return;

    const deltaX = Math.abs(event.clientX - longPressStartRef.current.x);
    const deltaY = Math.abs(event.clientY - longPressStartRef.current.y);

    if (deltaX > 10 || deltaY > 10) {
      clearLongPress();
    }
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onOpenContextMenu) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;

    event.preventDefault();
    onOpenContextMenu(event.clientX, event.clientY);
  };

  const getStatusIcon = () => {
    switch (node.status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-blue-400" />;
      default: return <Circle className="w-4 h-4 text-white/30" />;
    }
  };

  const getTypeStyles = () => {
    switch (node.type) {
      case 'area': return 'border-white/40 bg-white/10 text-white min-w-45';
      case 'goal': return 'border-blue-500/40 bg-blue-500/10 text-blue-100 min-w-40';
      case 'project': return 'border-purple-500/40 bg-purple-500/10 text-purple-100 min-w-35';
      case 'task': return 'border-white/10 bg-white/5 text-white/80 min-w-30';
    }
  };

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300 group relative',
        getTypeStyles(),
        selected ? 'ring-2 ring-white/50 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'shadow-lg'
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onContextMenu={handleContextMenu}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      {node.type !== 'task' && (
        <button
          onClick={handleAddChild}
          title="Add child node"
          className={cn(
            'absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center transition-opacity shadow-lg z-10',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{node.type}</span>
            {node.status === 'completed' && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
          </div>
          <h3 className="font-semibold text-sm truncate leading-tight">{node.title}</h3>
        </div>
        <div className="mt-1 flex flex-col items-end gap-1">
          {getStatusIcon()}
          {isCollapsed && (
            <div className="bg-white/10 rounded-full p-0.5">
              <ChevronDown className="w-3 h-3 text-white/60 rotate-180" />
            </div>
          )}
          {node.type === 'project' && isTaskListHidden && hasTaskChildren && (
            <div className="bg-white/10 rounded-full p-0.5">
              <EyeOff className="w-3 h-3 text-white/60" />
            </div>
          )}
        </div>
      </div>

      {node.type !== 'area' && (
        <div className="mt-3">
          <progress
            className={cn(
              'progress-bar h-1 w-full',
              node.status === 'completed' ? 'progress-bar--emerald' : 'progress-bar--muted'
            )}
            value={node.progress}
            max={100}
            aria-label={`${node.title} progress`}
          />
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[10px] opacity-40 font-medium">{node.progress}%</span>
            {node.deadline && (
              <span className="text-[10px] opacity-40 font-medium">
                {formatDeadline(node.deadline, 'MMM d')}
              </span>
            )}
          </div>
        </div>
      )}

      {node.type === 'project' && isTaskListHidden && hasTaskChildren && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 flex items-center gap-1.5">
            <EyeOff className="w-3 h-3" />
            Tasks hidden
          </p>
        </div>
      )}

      {node.type === 'project' && childrenTasks && childrenTasks.length > 0 && !isTaskListHidden && (
        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
          {childrenTasks.slice(0, 5).map(task => (
            <div 
              key={task.id} 
              className="flex items-center gap-2 w-full group/task"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTask?.(task.id);
                }}
                className={cn(
                  "w-3 h-3 rounded-full border flex items-center justify-center transition-colors shrink-0",
                  task.status === 'completed' 
                    ? "bg-emerald-400 border-emerald-400" 
                    : "border-white/20 hover:border-white/40"
                )}
              >
                {task.status === 'completed' && <CheckCircle2 className="w-2 h-2 text-[#0a0a0a]" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick?.(task);
                }}
                className={cn(
                  "text-[10px] truncate flex-1 transition-all text-left",
                  task.status === 'completed' ? "text-white/20 line-through" : "text-white/60 group-hover/task:text-white"
                )}
              >
                {task.title}
              </button>
            </div>
          ))}
          {childrenTasks.length > 5 && (
            <p className="text-[9px] text-white/20 font-bold uppercase tracking-wider pl-5">
              + {childrenTasks.length - 5} more tasks
            </p>
          )}
        </div>
      )}

      {node.type === 'project' && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onAddTask?.();
          }}
          className="mt-3 w-full py-1.5 border border-dashed border-white/10 rounded-lg hover:bg-white/5 transition-all flex items-center justify-center gap-1.5 group"
        >
          <Plus className="w-3 h-3 text-white/20 group-hover:text-white/60" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 group-hover:text-white/60">Add Task</span>
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

export default memo(CustomNode);
