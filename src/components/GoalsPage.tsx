import React, { useMemo, useState } from 'react';
import { usePlannerStore } from '../store';
import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { Target, Filter } from 'lucide-react';

export default function GoalsPage() {
  const { nodes } = usePlannerStore();
  const [filterAreaId, setFilterAreaId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const goals = useMemo(() => {
    let filtered = nodes.filter(n => n.type === 'goal');

    if (filterAreaId !== 'all') {
      filtered = filtered.filter(g => g.parent_id === filterAreaId);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(g => g.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [nodes, filterAreaId, filterStatus]);

  const areas = useMemo(() => {
    return nodes.filter(n => n.type === 'area');
  }, [nodes]);

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
              <p className="text-white/40 mt-1">Track your high-level objectives and their deadlines.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-white/30" />
            <select
              value={filterAreaId}
              onChange={(e) => setFilterAreaId(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none min-w-[150px]"
            >
              <option value="all">All Areas</option>
              {areas.map(area => (
                <option key={area.id} value={area.id}>
                  {area.title}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Goal</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Parent Area</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Progress</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Deadline</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Remaining Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {goals.map(goal => {
                const parent = nodes.find(n => n.id === goal.parent_id);
                return (
                  <tr key={goal.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{goal.title}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white/40">{parent?.title || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        goal.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        goal.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {goal.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden w-24">
                          <div 
                            className="h-full bg-blue-400 transition-all duration-500"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-white/40 w-8">{goal.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        goal.deadline && new Date(goal.deadline) < new Date() && goal.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/60'
                      }`}>
                        {goal.deadline && isValid(parseISO(goal.deadline)) ? format(parseISO(goal.deadline), 'MMM d, yyyy') : 'No deadline'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        goal.deadline && new Date(goal.deadline) < new Date() && goal.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/40'
                      }`}>
                        {goal.deadline && isValid(parseISO(goal.deadline)) ? (
                          goal.status === 'completed' ? '-' :
                          new Date(goal.deadline) < new Date() ? 'Overdue' :
                          formatDistanceToNow(parseISO(goal.deadline), { addSuffix: true })
                        ) : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {goals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/30 italic">
                    No goals found. Create some in the Mind Map!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
