import React, { useMemo, useState } from 'react';
import { usePlannerStore } from '../store';
import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { Folder, Filter } from 'lucide-react';

export default function ProjectsPage() {
  const { nodes } = usePlannerStore();
  const [filterParentId, setFilterParentId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const projects = useMemo(() => {
    let filtered = nodes.filter(n => n.type === 'project');

    if (filterParentId !== 'all') {
      // Find all descendants of the selected parent
      const getDescendantIds = (parentId: string): string[] => {
        const children = nodes.filter(n => n.parent_id === parentId);
        let ids = children.map(c => c.id);
        children.forEach(c => {
          ids = [...ids, ...getDescendantIds(c.id)];
        });
        return ids;
      };

      const descendantIds = getDescendantIds(filterParentId);
      // A project is included if its parent is the filter OR if it's a descendant of the filter
      filtered = filtered.filter(p => p.parent_id === filterParentId || descendantIds.includes(p.id));
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [nodes, filterParentId, filterStatus]);

  const filterOptions = useMemo(() => {
    return nodes.filter(n => n.type === 'area' || n.type === 'goal' || n.type === 'project');
  }, [nodes]);

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Folder className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
              <p className="text-white/40 mt-1">Track your actionable projects and their deadlines.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-white/30" />
            <select
              value={filterParentId}
              onChange={(e) => setFilterParentId(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none min-w-[150px]"
            >
              <option value="all">All Projects</option>
              {filterOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.title} ({opt.type})
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
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Project</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Parent</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Progress</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Deadline</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/30">Remaining Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects.map(project => {
                const parent = nodes.find(n => n.id === project.parent_id);
                return (
                  <tr key={project.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{project.title}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white/40">{parent?.title || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        project.status === 'in-progress' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {project.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden w-24">
                          <div 
                            className="h-full bg-purple-400 transition-all duration-500"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-white/40 w-8">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/60'
                      }`}>
                        {project.deadline && isValid(parseISO(project.deadline)) ? format(parseISO(project.deadline), 'MMM d, yyyy') : 'No deadline'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/40'
                      }`}>
                        {project.deadline && isValid(parseISO(project.deadline)) ? (
                          project.status === 'completed' ? '-' :
                          new Date(project.deadline) < new Date() ? 'Overdue' :
                          formatDistanceToNow(parseISO(project.deadline), { addSuffix: true })
                        ) : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/30 italic">
                    No projects found.
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
