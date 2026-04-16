/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { usePlannerStore } from './store';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import GoalsPage from './components/GoalsPage';
import ProjectsPage from './components/ProjectsPage';
import MindMap from './components/MindMap';
import NodeEditor from './components/NodeEditor';
import { PlannerNode } from './types';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X, Lock } from 'lucide-react';
import { fetchPlannerNodes, updatePassword } from './lib/plannerApi';
import { cn } from './lib/utils';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-8 py-10 shadow-2xl backdrop-blur-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        <div className="text-center">
          <h1 className="text-lg font-bold tracking-tight">Cloud Planner</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/40">Loading workspace</p>
        </div>
      </div>
    </div>
  );
}

function UpdatePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{tone: 'error'|'success', message: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setFeedback({ tone: 'error', message: 'Passwords do not match.' });
      return;
    }
    
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await updatePassword(password);
      setFeedback({ tone: 'success', message: 'Password updated! Redirecting...' });
      setTimeout(() => {
        window.location.hash = '';
        onClose();
      }, 2000);
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Failed to update password' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Update Password</h2>
          </div>
          <button aria-label="Close update password modal" onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-1.5 ml-1">New Password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-new-password" className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-1.5 ml-1">Confirm New Password</label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              required
            />
          </div>

          {feedback && (
            <p className={cn(
              'text-sm text-center py-2 rounded-lg border',
              feedback.tone === 'error' ? 'text-red-300 bg-red-400/10 border-red-400/20' : 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
            )}>
              {feedback.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function App() {
  const { token, user, setNodes, nodes } = usePlannerStore();
  const [activeView, setActiveView] = useState<'dashboard' | 'mindmap' | 'analytics' | 'goals' | 'projects'>('dashboard');
  const [selectedNode, setSelectedNode] = useState<PlannerNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);

  useEffect(() => {
    const persistApi = (usePlannerStore as any).persist;
    if (!persistApi?.onFinishHydration) {
      setIsAuthReady(true);
      return;
    }

    setIsAuthReady(Boolean(persistApi.hasHydrated?.()));

    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsAuthReady(true);
    });

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setShowUpdatePassword(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !token || !user?.id || nodes.length > 0) return;

    let cancelled = false;
    fetchPlannerNodes(user.id)
      .then(data => {
        if (!cancelled) setNodes(data);
      })
      .catch(error => console.error('Failed to fetch nodes', error));

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, token, user?.id, nodes.length, setNodes]);

  // Close sidebar when view changes on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeView]);

  const handleOpenNode = (nodeId: string) => {
    const target = nodes.find(node => node.id === nodeId);
    if (!target) return;

    setSelectedNode(target);
    setIsFullscreen(false);
    setActiveView('mindmap');
  };

  if (!isAuthReady) {
    return <LoadingScreen />;
  }

  if (!token) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a] text-white font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && !isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {!isFullscreen && (
        <div className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar 
            activeView={activeView} 
            setActiveView={setActiveView} 
            onClose={() => setIsSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          />
        </div>
      )}
      
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Mobile Header */}
        {!isFullscreen && (
          <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0d0d0d]">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              title="Open sidebar"
              aria-label="Open sidebar"
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">Cloud Planner</h1>
            <div className="w-10" /> {/* Spacer */}
          </header>
        )}

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] pointer-events-none"
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <Dashboard key="dashboard" onNavigate={setActiveView} onNodeSelect={setSelectedNode} />
            ) : activeView === 'analytics' ? (
              <Analytics key="analytics" />
            ) : activeView === 'goals' ? (
              <GoalsPage key="goals" onOpenNode={handleOpenNode} />
            ) : activeView === 'projects' ? (
              <ProjectsPage key="projects" onOpenNode={handleOpenNode} />
            ) : (
              <MindMap 
                key="mindmap" 
                onNodeSelect={setSelectedNode} 
                selectedNode={selectedNode}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedNode && (
              <NodeEditor 
                node={selectedNode} 
                onClose={() => setSelectedNode(null)} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {showUpdatePassword && (
        <UpdatePasswordModal onClose={() => setShowUpdatePassword(false)} />
      )}
    </div>
  );
}
