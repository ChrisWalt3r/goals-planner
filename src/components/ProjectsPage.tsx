import React, { useMemo, useState } from 'react';
import { usePlannerStore } from '../store';
import { parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { Folder, Filter, Search } from 'lucide-react';
import { formatDeadline, isDeadlineOverdue } from '../lib/utils';

interface ProjectsPageProps {
  onOpenNode?: (nodeId: string) => void;
}

export default function ProjectsPage({ onOpenNode }: ProjectsPageProps) {
  const { nodes } = usePlannerStore();
  const [filterParentId, setFilterParentId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(project => {
        const parent = nodes.find(node => node.id === project.parent_id);
        return project.title.toLowerCase().includes(query) || parent?.title.toLowerCase().includes(query);
      });
    }

    return filtered.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [nodes, filterParentId, filterStatus, searchQuery]);

  const filterOptions = useMemo(() => {
    return nodes.filter(n => n.type === 'goal');
  }, [nodes]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Folder className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
              <p className="text-white/40 mt-1">Track your actionable projects and their deadlines.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full lg:w-auto">
            <div className="relative group w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                aria-label="Search projects"
                className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <select
                  value={filterParentId}
                  onChange={(e) => setFilterParentId(e.target.value)}
                  aria-label="Filter projects by parent"
                  title="Filter projects by parent"
                  className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
                >
                  <option value="all" className="bg-[#1a1a1a] text-white">All Projects</option>
                  {filterOptions.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-[#1a1a1a] text-white">
                      {opt.title} ({opt.type})
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter projects by status"
                title="Filter projects by status"
                className="w-full sm:w-44 bg-[#111] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
              >
                <option value="all" className="bg-[#1a1a1a] text-white">All Statuses</option>
                <option value="not-started" className="bg-[#1a1a1a] text-white">Not Started</option>
                <option value="in-progress" className="bg-[#1a1a1a] text-white">In Progress</option>
                <option value="completed" className="bg-[#1a1a1a] text-white">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="min-w-230 w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
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
                  <tr key={project.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => onOpenNode?.(project.id)}
                        className="font-semibold text-left hover:text-blue-400 transition-colors"
                      >
                        {project.title}
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
                        project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        project.status === 'in-progress' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {project.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <progress
                          className="progress-bar progress-bar--blue h-1.5 w-24"
                          value={project.progress}
                          max={100}
                          aria-label={`${project.title} progress`}
                        />
                        <span className="text-xs font-medium text-white/40 w-8">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        isDeadlineOverdue(project.deadline) && project.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/60'
                      }`}>
                        {project.deadline && isValid(parseISO(project.deadline)) ? formatDeadline(project.deadline) : 'No deadline'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        isDeadlineOverdue(project.deadline) && project.status !== 'completed' 
                          ? 'text-red-400' 
                          : 'text-white/40'
                      }`}>
                        {project.deadline && isValid(parseISO(project.deadline)) ? (
                          project.status === 'completed' ? '-' :
                          isDeadlineOverdue(project.deadline) ? 'Overdue' :
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
    </div>
  );
}
