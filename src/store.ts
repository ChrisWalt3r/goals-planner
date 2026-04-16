import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlannerNode, User, AuthState } from './types';
import { signOut } from './lib/plannerApi';

interface PlannerStore {
  user: User | null;
  token: string | null;
  nodes: PlannerNode[];
  setAuth: (auth: AuthState) => void;
  logout: () => void;
  setNodes: (nodes: PlannerNode[]) => void;
  addNode: (node: PlannerNode) => void;
  updateNode: (id: string, updates: Partial<PlannerNode>) => void;
  deleteNode: (id: string) => void;
  recalculateProgress: (parentId: string | null) => void;
}

const calculateProgress = (nodes: PlannerNode[], parentId: string | null): PlannerNode[] => {
  if (!parentId) return nodes;

  const parent = nodes.find(n => n.id === parentId);
  if (!parent) return nodes;

  const children = nodes.filter(n => n.parent_id === parentId);
  let newProgress = parent.progress;
  let newStatus = parent.status;

  if (parent.type === 'project') {
    const tasks = children.filter(c => c.type === 'task');
    const projects = children.filter(c => c.type === 'project');
    
    if (tasks.length > 0 || projects.length > 0) {
      const totalItems = tasks.length + projects.length;
      let totalProgress = 0;

      for (const t of tasks) {
        totalProgress += t.status === 'completed' ? 100 : t.progress || 0;
      }
      for (const p of projects) {
        totalProgress += (p.progress || 0);
      }

      newProgress = Math.round(totalProgress / totalItems);
      newStatus = parent.status;
    }
  } else if (parent.type === 'goal') {
    const projects = children.filter(c => c.type === 'project');
    if (projects.length > 0) {
      const totalProgress = projects.reduce((acc, p) => acc + (p.progress || 0), 0);
      const anyInProgress = projects.some(p => p.status === 'in-progress' || (p.progress > 0 && p.progress < 100));
      const allNotStarted = projects.every(p => p.status === 'not-started');
      
      newProgress = Math.round(totalProgress / projects.length);
      
      if (newProgress === 100) {
        newStatus = 'completed';
      } else if (anyInProgress || (newProgress > 0 && newProgress < 100)) {
        newStatus = 'in-progress';
      } else if (allNotStarted && newProgress === 0) {
        newStatus = 'not-started';
      }
    }
  } else if (parent.type === 'area') {
    const goals = children.filter(c => c.type === 'goal');
    if (goals.length > 0) {
      const anyInProgress = goals.some(g => g.status === 'in-progress' || (g.progress > 0 && g.progress < 100));
      const allNotStarted = goals.every(g => g.status === 'not-started');
      const allCompleted = goals.every(g => g.status === 'completed');

      if (allCompleted) {
        newStatus = 'completed';
      } else if (anyInProgress || !allNotStarted) {
        newStatus = 'in-progress';
      } else {
        newStatus = 'not-started';
      }
      // Areas don't have progress or deadline
      newProgress = 0;
    }
  }

  if (newProgress !== parent.progress || newStatus !== parent.status || (parent.type === 'area' && parent.deadline !== null)) {
    const updatedNodes = nodes.map(n => n.id === parentId ? { ...n, progress: newProgress, status: newStatus, deadline: n.type === 'area' ? null : n.deadline } : n);
    return calculateProgress(updatedNodes, parent.parent_id);
  }

  return nodes;
};

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      nodes: [],
      setAuth: (auth) => set({ user: auth.user, token: auth.token }),
      logout: () => {
        void signOut();
        set({ user: null, token: null, nodes: [] });
      },
      setNodes: (nodes) => set({ nodes }),
      addNode: (node) => set((state) => {
        const newNodes = [...state.nodes, node];
        return { nodes: calculateProgress(newNodes, node.parent_id) };
      }),
      updateNode: (id, updates) =>
        set((state) => {
          const node = state.nodes.find(n => n.id === id);
          const oldParentId = node?.parent_id;
          const updatedNodes = state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n));
          
          let finalNodes = calculateProgress(updatedNodes, updates.parent_id || node?.parent_id || null);
          if (oldParentId && oldParentId !== updates.parent_id) {
            finalNodes = calculateProgress(finalNodes, oldParentId);
          }
          return { nodes: finalNodes };
        }),
      deleteNode: (id) =>
        set((state) => {
          const node = state.nodes.find(n => n.id === id);
          const filteredNodes = state.nodes.filter((n) => n.id !== id);
          return { nodes: calculateProgress(filteredNodes, node?.parent_id || null) };
        }),
      recalculateProgress: (parentId) => set((state) => ({ nodes: calculateProgress(state.nodes, parentId) })),
    }),
    {
      name: 'planner-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
