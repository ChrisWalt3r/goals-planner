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
import { Menu, X } from 'lucide-react';

export default function App() {
  const { token, user, setNodes } = usePlannerStore();
  const [activeView, setActiveView] = useState<'dashboard' | 'mindmap' | 'analytics' | 'goals' | 'projects'>('dashboard');
  const [selectedNode, setSelectedNode] = useState<PlannerNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchNodes();
    }
  }, [token]);

  // Close sidebar when view changes on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeView]);

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 403 || res.status === 401) {
        usePlannerStore.getState().logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
      }
    } catch (err) {
      console.error('Failed to fetch nodes');
    }
  };

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
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>
      )}
      
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {/* Mobile Header */}
        {!isFullscreen && (
          <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0d0d0d]">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">Cloud Planner</h1>
            <div className="w-10" /> {/* Spacer */}
          </header>
        )}

        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <Dashboard key="dashboard" onNavigate={setActiveView} onNodeSelect={setSelectedNode} />
            ) : activeView === 'analytics' ? (
              <Analytics key="analytics" />
            ) : activeView === 'goals' ? (
              <GoalsPage key="goals" />
            ) : activeView === 'projects' ? (
              <ProjectsPage key="projects" />
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
    </div>
  );
}
