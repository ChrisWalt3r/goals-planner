import React, { useMemo } from 'react';
import { usePlannerStore } from '../store';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  PieChart, 
  Activity, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Target,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';

export default function Analytics() {
  const { nodes } = usePlannerStore();

  const stats = useMemo(() => {
    const total = nodes.length;
    const completed = nodes.filter(node => node.status === 'completed').length;
    const inProgress = nodes.filter(node => node.status === 'in-progress').length;
    const notStarted = total - completed - inProgress;

    return {
      total,
      completed,
      inProgress,
      notStarted,
      overallProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [nodes]);

  const typeData = [
    { name: 'Areas', value: nodes.filter(n => n.type === 'area').length, color: '#ffffff' },
    { name: 'Goals', value: nodes.filter(n => n.type === 'goal').length, color: '#3b82f6' },
    { name: 'Projects', value: nodes.filter(n => n.type === 'project').length, color: '#a855f7' },
    { name: 'Tasks', value: nodes.filter(n => n.type === 'task').length, color: '#64748b' },
  ];

  const statusData = [
    { name: 'Completed', value: stats.completed, color: '#10b981', dotClass: 'bg-emerald-400' },
    { name: 'In Progress', value: stats.inProgress, color: '#3b82f6', dotClass: 'bg-blue-400' },
    { name: 'Not Started', value: stats.notStarted, color: '#334155', dotClass: 'bg-slate-700' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">{label || payload[0].name}</p>
          <p className="text-lg font-bold text-white">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 overflow-y-auto h-full custom-scrollbar bg-[#0a0a0a]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Analytics</h1>
          <p className="text-white/40 mt-1 lg:mt-2 text-sm lg:text-base">Deep dive into your planning performance.</p>
        </div>
        <div className="flex gap-2 bg-[#1a1a1a] border border-white/10 p-1 rounded-xl self-start lg:self-auto">
          <div className="px-4 py-2 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
            <Activity className="w-3 h-3" /> Real-time Data
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Distribution by Type */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg lg:text-xl font-bold tracking-tight">Node Distribution</h2>
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl flex flex-col"
        >
          <div className="flex items-center gap-3 mb-8">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg lg:text-xl font-bold tracking-tight">Status Ratio</h2>
          </div>
          <div className="flex-1 h-62.5 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </RePieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold tracking-tight">{stats.overallProgress}%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">Progress</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", item.dotClass)} />
                  <span className="text-xs text-white/60">{item.name}</span>
                </div>
                <span className="text-xs font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Efficiency Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/30">Execution Rate</h3>
            <div className="p-2 bg-emerald-400/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
            </span>
            <span className="text-emerald-400 text-xs font-bold flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +12%
            </span>
          </div>
          <p className="text-xs text-white/40 mt-2">Percentage of total nodes completed.</p>
        </motion.div>

        {/* Focus Score */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/30">Focus Score</h3>
            <div className="p-2 bg-blue-400/10 rounded-lg">
              <Target className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">
              {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%
            </span>
            <span className="text-emerald-400 text-xs font-bold flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +5%
            </span>
          </div>
          <p className="text-xs text-white/40 mt-2">Active nodes vs total system size.</p>
        </motion.div>

        {/* System Health */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 lg:p-8 rounded-3xl bg-[#161616] border border-white/10 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/30">System Health</h3>
            <div className="p-2 bg-purple-400/10 rounded-lg">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">Optimal</span>
          </div>
          <p className="text-xs text-white/40 mt-2">Node distribution is balanced.</p>
        </motion.div>
      </div>
    </div>
  );
}
