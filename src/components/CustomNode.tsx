import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '../lib/utils';
import { PlannerNode } from '../types';
import { CheckCircle2, Circle, Clock, ChevronDown, Plus } from 'lucide-react';

type PlannerNodeData = {
  node: PlannerNode;
  isCollapsed?: boolean;
  childrenTasks?: PlannerNode[];
  onAddTask?: () => void;
  onToggleTask?: (taskId: string) => void;
  onTaskClick?: (task: PlannerNode) => void;
};

type CustomNodeProps = NodeProps<Node<PlannerNodeData>>;

const CustomNode = ({ data, selected }: CustomNodeProps) => {
  const { node, isCollapsed, childrenTasks, onAddTask, onToggleTask, onTaskClick } = data;

  const getStatusIcon = () => {
    switch (node.status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-blue-400" />;
      default: return <Circle className="w-4 h-4 text-white/30" />;
    }
  };

  const getTypeStyles = () => {
    switch (node.type) {
      case 'area': return 'border-white/40 bg-white/10 text-white min-w-[180px]';
      case 'goal': return 'border-blue-500/40 bg-blue-500/10 text-blue-100 min-w-[160px]';
      case 'project': return 'border-purple-500/40 bg-purple-500/10 text-purple-100 min-w-[140px]';
      case 'task': return 'border-white/10 bg-white/5 text-white/80 min-w-[120px]';
    }
  };

  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300",
      getTypeStyles(),
      selected ? "ring-2 ring-white/50 shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "shadow-lg"
    )}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
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
        </div>
      </div>

      {node.type !== 'area' && (
        <div className="mt-3">
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                node.status === 'completed' ? "bg-emerald-400" : "bg-white/40"
              )}
              style={{ width: `${node.progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[10px] opacity-40 font-medium">{node.progress}%</span>
            {node.deadline && (
              <span className="text-[10px] opacity-40 font-medium">
                {new Date(node.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      )}

      {node.type === 'project' && childrenTasks && childrenTasks.length > 0 && (
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
