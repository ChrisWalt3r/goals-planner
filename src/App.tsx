/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { fetchPlannerNoteNodeIds, fetchPlannerNodes, updatePassword } from './lib/plannerApi';
import { logSchemaStatus } from './lib/schemaValidator';
import { supabase } from './lib/supabase';
import { cn } from './lib/utils';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-8 py-10 shadow-2xl backdrop-blur-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        <div className="text-center">
          <h1 className="text-lg font-bold tracking-tight">Goal Digger</h1>
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
  const { token, user, setAuth, setNodes, setNodeNoteIds, nodes } = usePlannerStore();
  const [activeView, setActiveView] = useState<'dashboard' | 'mindmap' | 'analytics' | 'goals' | 'projects'>('dashboard');
  const [selectedNode, setSelectedNode] = useState<PlannerNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [loadSeed, setLoadSeed] = useState(0);
  const [showUpdatePassword, setShowUpdatePassword] = useState(false);
  const lastAuthedUserIdRef = useRef<string | null>(null);
  const isInitialLoadInFlightRef = useRef(false);
  const hasLoadedInitialDataRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);

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
    let cancelled = false;

    if (!isAuthReady) return;

    setIsSessionReady(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (session?.user && session.access_token) {
        // Prevent repeated auth writes on token-refresh churn.
        if (lastAuthedUserIdRef.current !== session.user.id || !token) {
          setAuth({
            user: {
              id: session.user.id,
              email: session.user.email || '',
            },
            token: session.access_token,
          });
          lastAuthedUserIdRef.current = session.user.id;
        }
      } else if (event === 'SIGNED_OUT') {
        lastAuthedUserIdRef.current = null;
        hasLoadedInitialDataRef.current = false;
        isInitialLoadInFlightRef.current = false;
        setAuth({ user: null, token: null });
        setNodes([]);
        setNodeNoteIds([]);
      }

      setIsSessionReady(true);
    });

    // Bootstraps session readiness even when auth events are delayed.
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to read session during bootstrap', error);
          setIsSessionReady(true);
          return;
        }

        const session = data.session;
        if (session?.user && session.access_token) {
          if (lastAuthedUserIdRef.current !== session.user.id || !token) {
            setAuth({
              user: {
                id: session.user.id,
                email: session.user.email || '',
              },
              token: session.access_token,
            });
            lastAuthedUserIdRef.current = session.user.id;
          }
        }

        setIsSessionReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Unexpected session bootstrap error', error);
        setIsSessionReady(true);
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isAuthReady, setAuth, token, setNodes, setNodeNoteIds]);

  useEffect(() => {
    if (!token || !user?.id) {
      hasLoadedInitialDataRef.current = false;
      isInitialLoadInFlightRef.current = false;
      return;
    }

    if (lastAuthedUserIdRef.current !== user.id) {
      hasLoadedInitialDataRef.current = false;
      isInitialLoadInFlightRef.current = false;
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (!isAuthReady || !isSessionReady || !user?.id) return;
    if (isInitialLoadInFlightRef.current || hasLoadedInitialDataRef.current) return;

    let cancelled = false;
    isInitialLoadInFlightRef.current = true;

    const getSupabaseErrorMessage = (error: unknown) => {
      if (!error) return '';
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;

      if (typeof error === 'object') {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string') return maybeMessage;
      }

      return String(error);
    };

    const shouldRetryLoad = (error: unknown) => {
      const message = getSupabaseErrorMessage(error);
      return /429|too many requests|lock|aborterror|steal|timeout|network|fetch/i.test(message);
    };

    const loadInitialData = async () => {
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt < 3 && !cancelled) {
        try {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;
          if (!userData.user) {
            throw new Error('Authenticated session is missing while loading planner data.');
          }

          if (userData.user.id !== user.id) {
            setAuth({
              user: {
                id: userData.user.id,
                email: userData.user.email || '',
              },
              token,
            });
          }

          // Sequence these requests to avoid auth-lock contention.
          const data = await fetchPlannerNodes(userData.user.id);
          const noteNodeIds = await fetchPlannerNoteNodeIds(userData.user.id).catch(() => []);

          if (!cancelled) {
            setNodes(data);
            setNodeNoteIds(noteNodeIds);
            hasLoadedInitialDataRef.current = true;
            if (retryTimerRef.current) {
              window.clearTimeout(retryTimerRef.current);
              retryTimerRef.current = null;
            }

            // Verify schema on successful load to detect missing dependency_ids column early
            void logSchemaStatus().catch(() => {
              // Silently fail - just informational logging
            });
          }
          return;
        } catch (error) {
          lastError = error;
          attempt += 1;

          if (!shouldRetryLoad(error) || attempt >= 3) break;

          await new Promise((resolve) => {
            window.setTimeout(resolve, 350 * attempt);
          });
        }
      }

      if (!cancelled && lastError) {
        console.error('Failed to fetch nodes', lastError);

        if (retryTimerRef.current) {
          window.clearTimeout(retryTimerRef.current);
        }

        retryTimerRef.current = window.setTimeout(() => {
          if (cancelled || hasLoadedInitialDataRef.current || isInitialLoadInFlightRef.current) return;
          setLoadSeed((current) => current + 1);
        }, 2000);
      }
    };

    void loadInitialData().finally(() => {
      isInitialLoadInFlightRef.current = false;
    });

    return () => {
      cancelled = true;
      isInitialLoadInFlightRef.current = false;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [isAuthReady, isSessionReady, user?.id, setNodes, setNodeNoteIds, loadSeed, setAuth]);

  useEffect(() => {
    if (!token || !user?.id) return;

    const retryLoad = () => {
      if (hasLoadedInitialDataRef.current || isInitialLoadInFlightRef.current) return;
      setLoadSeed((current) => current + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        retryLoad();
      }
    };

    window.addEventListener('online', retryLoad);
    window.addEventListener('focus', retryLoad);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', retryLoad);
      window.removeEventListener('focus', retryLoad);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, user?.id]);

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

  if (token && !isSessionReady) {
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
            <h1 className="text-lg font-bold tracking-tight">Goal Digger</h1>
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
