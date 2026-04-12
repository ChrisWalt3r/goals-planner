import React, { useEffect, useState } from 'react';
import { usePlannerStore } from '../store';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, Target, TrendingUp, Calendar, Zap, ChevronRight, X, ListTodo, Edit2, Trash2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatePresence } from 'motion/react';
import { PlannerNode } from '../types';

interface DashboardProps {
  onNavigate?: (view: 'dashboard' | 'mindmap' | 'analytics') => void;
  onNodeSelect?: (node: PlannerNode | null) => void;
}

export default function Dashboard({ onNavigate, onNodeSelect }: DashboardProps) {
  const { token, nodes, updateNode, deleteNode, addNode } = usePlannerStore();
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    overallProgress: 0
  });
  const [selectedProject, setSelectedProject] = useState<PlannerNode | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            usePlannerStore.getState().logout();
          }
          throw new Error('Failed to fetch stats');
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats');
      }
    };
    fetchStats();
  }, [nodes, token]);

  const toggleTask = async (taskId: string) => {
    const task = nodes.find(n => n.id === taskId);
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
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteNode(taskId);
      await fetch(`/api/nodes/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    }
  };

  const handleAddTask = async (projectId: string) => {
    const id = Math.random().toString(36).substring(7);
    const project = nodes.find(n => n.id === projectId);
    
    const newTask: PlannerNode = {
      id,
      parent_id: projectId,
      type: 'task',
      title: 'New task',
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
    await fetch('/api/nodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(newTask),
    });
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
                      <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate group-hover/item:text-purple-400 transition-colors">{node.title}</h4>
                        <p className="text-[10px] lg:text-xs text-white/40 uppercase tracking-wider">Project</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 sm:w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-400" style={{ width: `${node.progress}%` }} />
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
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{node.title}</h4>
                        <p className="text-[10px] lg:text-xs text-white/40 uppercase tracking-wider">Goal</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 sm:w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400" style={{ width: `${node.progress}%` }} />
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
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex flex-col items-center justify-center">
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
  const tasks = nodes.filter(n => n.parent_id === project.id && n.type === 'task');
  
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="fixed right-0 top-0 h-full w-full lg:w-[400px] bg-[#111] border-l border-white/10 shadow-2xl z-[70] flex flex-col"
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
              className="p-2 hover:bg-white/5 rounded-lg text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
            <button 
              onClick={onClose}
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
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group"
            >
              <button 
                onClick={() => onToggle(task.id)}
                className="flex flex-1 items-center gap-4 text-left"
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                  task.status === 'completed' 
                    ? "bg-emerald-400 border-emerald-400" 
                    : "border-white/20 group-hover:border-white/40"
                )}>
                  {task.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
                </div>
                <span className={cn(
                  "text-sm font-medium transition-all",
                  task.status === 'completed' ? "text-white/20 line-through" : "text-white/70 group-hover:text-white"
                )}>
                  {task.title}
                </span>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onEdit(task)}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(task.id)}
                  className="p-2 hover:bg-white/10 rounded-lg text-red-400/40 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
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
