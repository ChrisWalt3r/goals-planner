import React from 'react';
import { usePlannerStore } from '../store';
import { cn } from '../lib/utils';
import { 
  LayoutDashboard, 
  Network, 
  Settings, 
  LogOut, 
  Cloud, 
  ChevronRight,
  Plus,
  Folder,
  X,
  BarChart3,
  Menu
} from 'lucide-react';

interface SidebarProps {
  activeView: 'dashboard' | 'mindmap' | 'analytics' | 'goals' | 'projects';
  setActiveView: (view: 'dashboard' | 'mindmap' | 'analytics' | 'goals' | 'projects') => void;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ activeView, setActiveView, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout, nodes } = usePlannerStore();

  const areas = nodes.filter(n => n.type === 'area');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'mindmap', label: 'Mind Map', icon: Network },
    { id: 'goals', label: 'Goals', icon: BarChart3 },
    { id: 'projects', label: 'Projects', icon: Folder },
  ];

  return (
    <div className={cn(
      "h-full bg-[#0d0d0d] border-r border-white/5 flex flex-col z-40 relative transition-all duration-500 ease-in-out",
      isCollapsed ? "w-20" : "w-72"
    )}>
      {/* Mobile Close Button */}
      {onClose && (
        <button 
          onClick={onClose}
          className="lg:hidden absolute top-6 right-6 p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className={cn("p-6 lg:p-8 flex-1 flex flex-col overflow-hidden", isCollapsed && "items-center px-4")}>
        <div className={cn("flex items-center gap-3 mb-10 transition-all", isCollapsed ? "flex-col gap-6" : "justify-between")}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] shrink-0">
              <Cloud className="w-6 h-6 text-black" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight truncate">Cloud Planner</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 truncate">System v1.0</p>
              </div>
            )}
          </div>
          
          {/* Desktop Toggle Button */}
          {!onClose && (
            <button 
              onClick={onToggleCollapse}
              className={cn(
                "p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white shrink-0",
                isCollapsed ? "mt-2" : ""
              )}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                activeView === item.id 
                  ? "bg-white text-black font-semibold shadow-lg" 
                  : "text-white/40 hover:text-white hover:bg-white/5",
                isCollapsed && "justify-center px-0"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", activeView === item.id ? "text-black" : "text-white/40 group-hover:text-white")} />
              {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
              {!isCollapsed && activeView === item.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </nav>
      </div>

      <div className={cn("mt-auto p-6 border-t border-white/5 bg-white/[0.02]", isCollapsed && "p-4 items-center")}>
        <div className={cn("flex items-center gap-3 mb-6 px-2 transition-all", isCollapsed ? "justify-center px-0" : "")}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.email[0].toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.email.split('@')[0]}</p>
              <p className="text-[10px] text-white/30 truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <div className={cn("grid gap-2", isCollapsed ? "grid-cols-1" : "grid-cols-2")}>
          <button className="flex items-center justify-center p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={logout}
            className="flex items-center justify-center p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
