import React, { useMemo, useState } from 'react';
import { usePlannerStore } from '../store';
import { parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { Target, Filter, Search } from 'lucide-react';
import { formatDeadline, isDeadlineOverdue } from '../lib/utils';

interface GoalsPageProps {
  onOpenNode?: (nodeId: string) => void;
}

export default function GoalsPage({ onOpenNode }: GoalsPageProps) {
  const { nodes } = usePlannerStore();
  const [filterAreaId, setFilterAreaId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const goals = useMemo(() => {
    let filtered = nodes.filter(n => n.type === 'goal');

    if (filterAreaId !== 'all') {
      filtered = filtered.filter(g => g.parent_id === filterAreaId);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(g => g.status === filterStatus);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(goal => {
        const parent = nodes.find(node => node.id === goal.parent_id);
        return goal.title.toLowerCase().includes(query) || parent?.title.toLowerCase().includes(query);
      });
    }

    return filtered.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime();
    });
  }, [nodes, filterAreaId, filterStatus, searchQuery]);

  const areas = useMemo(() => {
    return nodes.filter(n => n.type === 'area');
  }, [nodes]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
              <p className="text-white/40 mt-1">Track your high-level objectives and their deadlines.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full lg:w-auto">
            <div className="relative group w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search goals..."
                aria-label="Search goals"
                className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <select
                  value={filterAreaId}
                  onChange={(e) => setFilterAreaId(e.target.value)}
                  aria-label="Filter goals by area"
                  title="Filter goals by area"
                  className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
                >
                  <option value="all">All Areas</option>
                  {areas.map(area => (
                    <option key={area.id} value={area.id}>
                      {area.title}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter goals by status"
                title="Filter goals by status"
                className="w-full sm:w-44 bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="min-w-230 w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
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
                  <tr key={goal.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => onOpenNode?.(goal.id)}
                        className="font-semibold text-left hover:text-blue-400 transition-colors"
                      >
                        {goal.title}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {parent ? (
                        <button
                          type="button"
                          onClick={() => onOpenNode?.(parent.id)}
                          className="text-sm text-white/40 hover:text-white transition-colors text-left"
                        >
                          {parent.title}
                        </button>
                      ) : (
                        <span className="text-sm text-white/40">-</span>
                      )}
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
                        <progress
                          className="progress-bar progress-bar--blue h-1.5 w-24"
                          value={goal.progress}
                          max={100}
                          aria-label={`${goal.title} progress`}
                        />
                        <span className="text-xs font-medium text-white/40 w-8">{goal.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        isDeadlineOverdue(goal.deadline) && goal.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/60'
                      }`}>
                        {goal.deadline && isValid(parseISO(goal.deadline)) ? formatDeadline(goal.deadline) : 'No deadline'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        isDeadlineOverdue(goal.deadline) && goal.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/40'
                      }`}>
                        {goal.deadline && isValid(parseISO(goal.deadline)) ? (
                          goal.status === 'completed' ? '-' :
                          isDeadlineOverdue(goal.deadline) ? 'Overdue' :
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
    </div>
  );
}
