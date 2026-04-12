import React, { useState, useEffect } from 'react';
import { PlannerNode, NodeType, NodeStatus } from '../types';
import { usePlannerStore } from '../store';
import { cn } from '../lib/utils';
import { X, Save, Trash2, Calendar, Tag, ChevronDown, FileText, CheckSquare, List } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface NodeEditorProps {
  node: PlannerNode;
  onClose: () => void;
}

export default function NodeEditor({ node, onClose }: NodeEditorProps) {
  const { token, nodes, updateNode, deleteNode } = usePlannerStore();
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description || '');
  const [status, setStatus] = useState<NodeStatus>(node.status);
  const [progress, setProgress] = useState(node.progress);
  const [deadline, setDeadline] = useState(node.deadline || '');
  const [parentId, setParentId] = useState(node.parent_id || '');
  const [noteContent, setNoteContent] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');

  const isAutoCalculated = (node.type === 'goal' && nodes.some(n => n.parent_id === node.id && n.type === 'project')) || 
                           (node.type === 'project' && nodes.some(n => n.parent_id === node.id && (n.type === 'task' || n.type === 'project'))) ||
                           (node.type === 'area' && nodes.some(n => n.parent_id === node.id && n.type === 'goal'));

  useEffect(() => {
    setTitle(node.title);
    setDescription(node.description || '');
    setStatus(node.status);
    setProgress(node.progress);
    setDeadline(node.deadline || '');
    setParentId(node.parent_id || '');
    fetchNote();
  }, [node]);

  const fetchNote = async () => {
    try {
      const res = await fetch(`/api/notes/${node.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setNoteContent(data.content || '');
    } catch (err) {
      console.error('Failed to fetch note');
    }
  };

  const handleSave = async () => {
    const updates = {
      title,
      description,
      status,
      progress,
      deadline: deadline || null,
      parent_id: parentId || null,
    };
    
    updateNode(node.id, updates);
    
    await fetch(`/api/nodes/${node.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ...node, ...updates }),
    });

    await fetch(`/api/notes/${node.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content: noteContent }),
    });
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this node?')) {
      deleteNode(node.id);
      await fetch(`/api/nodes/${node.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-full lg:w-[450px] bg-[#111] border-l border-white/10 shadow-2xl z-50 flex flex-col"
    >
      <div className="p-4 lg:p-6 border-bottom border-white/5 flex items-center justify-between bg-[#161616]">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            node.type === 'area' ? "bg-white" : 
            node.type === 'goal' ? "bg-blue-500" :
            node.type === 'project' ? "bg-purple-500" : "bg-white/40"
          )} />
          <h2 className="text-base lg:text-lg font-bold tracking-tight">Edit {node.type}</h2>
        </div>
        <div className="flex items-center gap-1 lg:gap-2">
          <button onClick={handleSave} className="p-2 hover:bg-white/5 rounded-lg text-emerald-400 transition-colors">
            <Save className="w-5 h-5" />
          </button>
          <button onClick={handleDelete} className="p-2 hover:bg-white/5 rounded-lg text-red-400 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/5 bg-[#161616]">
        <button 
          onClick={() => setActiveTab('details')}
          className={cn(
            "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
            activeTab === 'details' ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"
          )}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={cn(
            "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
            activeTab === 'notes' ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"
          )}
        >
          Notes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {activeTab === 'details' ? (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Parent Node</label>
              <select 
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={node.type === 'area'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none disabled:opacity-50"
              >
                <option value="">None (Root)</option>
                {nodes
                  .filter(n => n.id !== node.id)
                  .filter(n => {
                    if (node.type === 'goal') return n.type === 'area';
                    if (node.type === 'project') return n.type === 'goal' || n.type === 'project';
                    if (node.type === 'task') return n.type === 'project';
                    return false;
                  })
                  .map(n => (
                    <option key={n.id} value={n.id}>{n.title} ({n.type})</option>
                  ))
                }
              </select>
              {node.type === 'area' && (
                <p className="text-[10px] text-white/20 italic ml-1">Areas are always root nodes.</p>
              )}
            </div>

            {node.type !== 'task' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Status</label>
                    <select 
                      value={status}
                      onChange={(e) => setStatus(e.target.value as NodeStatus)}
                      disabled={isAutoCalculated && progress === 100}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none disabled:opacity-50"
                    >
                      <option value="not-started">Not Started</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    {isAutoCalculated && progress === 100 && <p className="text-[9px] text-white/20 italic ml-1">Locked to completed (100% progress).</p>}
                    {isAutoCalculated && progress < 100 && <p className="text-[9px] text-white/20 italic ml-1">Status and progress are auto-calculated.</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Progress ({progress}%)</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={progress}
                      onChange={(e) => setProgress(parseInt(e.target.value))}
                      disabled={isAutoCalculated}
                      className="w-full h-10 accent-white disabled:opacity-50"
                    />
                  </div>
                </div>

                {node.type !== 'area' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Deadline</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input 
                        type="date" 
                        value={deadline.split('T')[0]}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={node.type === 'task' ? 12 : 4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                placeholder="Add more context..."
              />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Markdown Notes</label>
              <button 
                onClick={() => setIsEditingNote(!isEditingNote)}
                className="text-xs font-bold text-white/60 hover:text-white transition-colors"
              >
                {isEditingNote ? 'Preview' : 'Edit'}
              </button>
            </div>
            {isEditingNote ? (
              <textarea 
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                placeholder="# My Notes\n\n- [ ] Task 1\n- [ ] Task 2"
              />
            ) : (
              <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl px-6 py-6 text-sm prose prose-invert max-w-none overflow-y-auto">
                <ReactMarkdown>{noteContent || '*No notes yet. Click edit to add some.*'}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
