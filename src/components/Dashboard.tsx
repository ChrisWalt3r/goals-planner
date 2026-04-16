import React, { useEffect, useMemo, useState, useRef } from 'react';
import { usePlannerStore } from '../store';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, Target, TrendingUp, Calendar, Zap, ChevronRight, X, ListTodo, Edit2, Trash2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatePresence } from 'motion/react';
import { PlannerNode } from '../types';
import { createPlannerNode, deletePlannerNode, updatePlannerNode } from '../lib/plannerApi';

interface DashboardProps {
  onNavigate?: (view: 'dashboard' | 'mindmap' | 'analytics') => void;
  onNodeSelect?: (node: PlannerNode | null) => void;
}

export default function Dashboard({ onNavigate, onNodeSelect }: DashboardProps) {
  const { nodes, updateNode, deleteNode, addNode, user } = usePlannerStore();
  const userId = user?.id;
  const [selectedProject, setSelectedProject] = useState<PlannerNode | null>(null);
  const stats = useMemo(() => {
    const total = nodes.length;
    const completed = nodes.filter(n => n.status === 'completed').length;
    const inProgress = nodes.filter(n => n.status === 'in-progress').length;

    return {
      total,
      completed,
      inProgress,
      overallProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [nodes]);

  const toggleTask = async (taskId: string) => {
    const task = nodes.find(n => n.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
    const newProgress = newStatus === 'completed' ? 100 : 0;
    
    const updates = { status: newStatus as any, progress: newProgress };
    updateNode(taskId, updates);

    try {
      await updatePlannerNode(taskId, updates, userId);
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteNode(taskId);
      try {
        await deletePlannerNode(taskId, userId);
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const handleAddTask = async (projectId: string) => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 12);
    const project = nodes.find(n => n.id === projectId);
    
    const newTask: PlannerNode = {
      id,
      parent_id: projectId,
      type: 'task',
      title: '',
      description: '',
      status: 'not-started',
      progress: 0,
      deadline: null,
      position_x: project ? project.position_x + (Math.random() - 0.5) * 200 : Math.random() * 400,
      position_y: project ? project.position_y + 150 : Math.random() * 400,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addNode(newTask);
    try {
      await createPlannerNode(newTask, userId);
    } catch (err) {
      console.error('Failed to create task in DB:', err);
    }
  };

  const cards = [
    { title: 'Overall Progress', value: `${stats.overallProgress}%`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { title: 'Total Nodes', value: stats.total, icon: Target, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { title: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { title: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto h-full custom-scrollbar">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-white/40 mt-1 lg:mt-2 text-sm lg:text-base">Your planning system at a glance.</p>
        </div>
        <div className="flex gap-2 bg-[#1a1a1a] border border-white/10 p-1 rounded-xl self-start lg:self-auto">
          <button 
            className="px-4 py-2 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-white bg-white/10 rounded-lg"
          >
            Overview
          </button>
          <button 
            onClick={() => onNavigate?.('analytics')}
            className="px-4 py-2 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 lg:p-6 rounded-2xl bg-[#161616] border border-white/10 shadow-xl group hover:border-white/20 transition-all"
          >
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className={cn("p-2.5 lg:p-3 rounded-xl", card.bg)}>
                <card.icon className={cn("w-5 h-5 lg:w-6 lg:h-6", card.color)} />
              </div>
            </div>
            <h3 className="text-white/40 text-xs lg:text-sm font-medium">{card.title}</h3>
            <p className="text-2xl lg:text-3xl font-bold mt-1 tracking-tight">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Focus (Projects) */}
          <div className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] -mr-32 -mt-32" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg lg:text-xl font-bold tracking-tight">Current weekly focus</h2>
              </div>
              <div className="space-y-3 lg:space-y-4">
                {nodes.filter(n => n.type === 'project' && n.status === 'in-progress').slice(0, 3).map(node => (
                  <button 
                    key={node.id} 
                    onClick={() => setSelectedProject(node)}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 hover:bg-white/10 transition-all gap-3 text-left group/item"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate group-hover/item:text-purple-400 transition-colors">{node.title}</h4>
                        <p className="text-[10px] lg:text-xs text-white/40 uppercase tracking-wider">Project</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 sm:w-32">
                        <progress
                          className="progress-bar progress-bar--purple h-1 w-full"
                          value={node.progress}
                          max={100}
                          aria-label={`${node.title} progress`}
                        />
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover/item:text-white/60" />
                    </div>
                  </button>
                ))}
                {nodes.filter(n => n.type === 'project' && n.status === 'in-progress').length === 0 && (
                  <p className="text-white/20 text-sm italic py-8 text-center">No active projects this week.</p>
                )}
              </div>
            </div>
          </div>

          {/* Goal Focus */}
          <div className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 blur-[100px] -mr-32 -mt-32" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg lg:text-xl font-bold tracking-tight">Current goals focus</h2>
              </div>
              <div className="space-y-3 lg:space-y-4">
                {nodes.filter(n => n.type === 'goal' && n.status === 'in-progress').slice(0, 3).map(node => (
                  <div key={node.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{node.title}</h4>
                        <p className="text-[10px] lg:text-xs text-white/40 uppercase tracking-wider">Goal</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 sm:w-32">
                        <progress
                          className="progress-bar progress-bar--blue h-1 w-full"
                          value={node.progress}
                          max={100}
                          aria-label={`${node.title} progress`}
                        />
                      </div>
                      <span className="text-xs font-bold text-white/40">{node.progress}%</span>
                    </div>
                  </div>
                ))}
                {nodes.filter(n => n.type === 'goal' && n.status === 'in-progress').length === 0 && (
                  <p className="text-white/20 text-sm italic py-8 text-center">No active goals. Start a goal to see it here.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg lg:text-xl font-bold tracking-tight">Upcoming</h2>
            </div>
            <div className="space-y-3 lg:space-y-4">
              {nodes.filter(n => n.deadline && n.status !== 'completed').sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()).slice(0, 4).map(node => (
                <div key={node.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-white/40 uppercase">{new Date(node.deadline!).toLocaleDateString(undefined, { month: 'short' })}</span>
                    <span className="text-sm font-bold leading-none">{new Date(node.deadline!).getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{node.title}</h4>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{node.type}</p>
                  </div>
                </div>
              ))}
              {nodes.filter(n => n.deadline && n.status !== 'completed').length === 0 && (
                <p className="text-white/20 text-sm italic py-8 text-center">No upcoming deadlines.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {selectedProject && (
          <TaskPanel 
            project={selectedProject} 
            nodes={nodes} 
            onToggle={toggleTask} 
            onEdit={(task) => onNodeSelect?.(task)}
            onDelete={handleDeleteTask}
            onAddTask={() => handleAddTask(selectedProject.id)}
            onClose={() => setSelectedProject(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

{/* Project Task Panel */}
function TaskPanel({ project, nodes, onToggle, onEdit, onDelete, onAddTask, onClose }: { 
  project: PlannerNode, 
  nodes: PlannerNode[], 
  onToggle: (id: string) => void, 
  onEdit: (task: PlannerNode) => void,
  onDelete: (id: string) => void,
  onAddTask: () => void,
  onClose: () => void 
}) {
  const { updateNode, user } = usePlannerStore();
  const userId = user?.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const tasks = nodes.filter(n => n.parent_id === project.id && n.type === 'task');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check for any task with empty title to start editing
    const emptyTask = tasks.find(t => t.title === '');
    if (emptyTask && emptyTask.id !== editingId) {
      setEditingId(emptyTask.id);
      setEditTitle('');
    }
  }, [tasks, editingId]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const handleSaveEdit = async (task: PlannerNode) => {
    if (editingId !== task.id) return;
    setEditingId(null);

    const finalTitle = editTitle.trim();

    if (task.title !== finalTitle) {
      updateNode(task.id, { title: finalTitle });
      try {
        await updatePlannerNode(task.id, { title: finalTitle }, userId);
      } catch (err) {
        console.error('Failed to update task title');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, task: PlannerNode) => {
    if (e.key === 'Enter') {
      handleSaveEdit(task);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditTitle(task.title); // revert
    }
  };
  
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60"
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="fixed right-0 top-0 h-full w-full lg:w-100 bg-[#111] border-l border-white/10 shadow-2xl z-70 flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-3">
            <ListTodo className="w-5 h-5 text-purple-400" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight truncate">{project.title}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Project Tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onAddTask}
              title="Add task"
              className="p-2 hover:bg-white/5 rounded-lg text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button 
              onClick={onClose}
              title="Close panel"
              className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {tasks.map(task => (
            <div 
              key={task.id}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group min-h-18"
            >
              {editingId === task.id ? (
                <div className="flex-1 flex items-center gap-4">
                  <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0" />
                  <input 
                    ref={inputRef}
                    autoFocus
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSaveEdit(task)}
                    onKeyDown={(e) => handleKeyDown(e, task)}
                    placeholder="Task name..."
                    className="flex-1 bg-transparent border-b border-white/20 text-sm font-medium focus:outline-none focus:border-white/60 py-1"
                  />
                </div>
              ) : (
                <button 
                  onClick={() => onToggle(task.id)}
                  className="flex flex-1 items-center gap-4 text-left"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                    task.status === 'completed' 
                      ? "bg-emerald-400 border-emerald-400" 
                      : "border-white/20 group-hover:border-white/40"
                  )}>
                    {task.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
                  </div>
                  <span className={cn(
                    "text-sm font-medium transition-all break-all line-clamp-2",
                    task.status === 'completed' ? "text-white/20 line-through" : "text-white/70 group-hover:text-white"
                  )}>
                    {task.title}
                  </span>
                </button>
              )}
              
              {editingId !== task.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                  <button 
                    onClick={() => {
                      setEditTitle(task.title);
                      setEditingId(task.id);
                    }}
                    title="Inline edit task"
                    className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onEdit(task)}
                    title="Open task editor"
                    className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                  >
                    <ListTodo className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(task.id)}
                    title="Delete task"
                    className="p-2 hover:bg-white/10 rounded-lg text-red-400/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <ListTodo className="w-8 h-8 text-white/10" />
              </div>
              <p className="text-white/20 text-sm italic">No tasks found for this project.</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
