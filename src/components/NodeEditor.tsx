import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PlannerNode, NodeType, NodeStatus } from '../types';
import { usePlannerStore } from '../store';
import { cn, formatDeadline } from '../lib/utils';
import {
  X,
  Save,
  Trash2,
  Calendar,
  Tag,
  ChevronDown,
  FileText,
  CheckSquare,
  List,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { deletePlannerNode, fetchPlannerNote, savePlannerNote, updatePlannerNode } from '../lib/plannerApi';
import { getAllowedParentTypes } from '../lib/hierarchy';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = Array.from({ length: 12 }, (_, monthIndex) =>
  format(new Date(2024, monthIndex, 1), 'MMMM')
);
const STATUS_OPTIONS: Array<{ value: NodeStatus; label: string }> = [
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

type FloatingPosition = {
  top: number;
  left: number;
  width: number;
};

function useFloatingPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement>,
  estimatedHeight: number
) {
  const [position, setPosition] = useState<FloatingPosition>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const padding = 12;
      const width = Math.max(rect.width, 280);
      const availableBelow = window.innerHeight - rect.bottom - padding;
      const availableAbove = rect.top - padding;
      const openAbove = availableBelow < estimatedHeight && availableAbove > availableBelow;
      const top = openAbove ? Math.max(padding, rect.top - estimatedHeight - 8) : rect.bottom + 8;
      const left = Math.max(
        padding,
        Math.min(rect.left, window.innerWidth - width - padding)
      );

      setPosition({ top, left, width });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorRef, estimatedHeight]);

  return position;
}

interface ParentNodeSelectorProps {
  node: PlannerNode;
  nodes: PlannerNode[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function ParentNodeSelector({ node, nodes, value, onChange, disabled }: ParentNodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(isOpen, buttonRef, 280);

  const options = useMemo(() => {
    const allowedParentTypes = getAllowedParentTypes(node.type);

    return nodes
      .filter(n => n.id !== node.id)
      .filter(n => allowedParentTypes.includes(n.type))
      .map(n => ({ id: n.id, label: `${n.title} (${n.type})` }));
  }, [nodes, node.id, node.type]);

  const selectedLabel = value ? options.find(option => option.id === value)?.label || 'None (Root)' : 'None (Root)';

  useEffect(() => {
    if (!isOpen) return;
    if (disabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, isOpen]);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Parent Node</label>
      <div className={cn("relative", isOpen ? "z-50" : "z-30")}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setIsOpen(current => !current);
          }}
          className={cn(
            'w-full flex items-center justify-between gap-3 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors',
            disabled && 'opacity-60 cursor-not-allowed hover:border-white/10'
          )}
        >
          <span className="truncate pr-3">{selectedLabel}</span>
          {!disabled && <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', isOpen && 'rotate-180')} />}
        </button>

        <AnimatePresence>
          {!disabled && isOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, zIndex: 70 }}
              className="rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_30px_60px_rgba(0,0,0,0.65)] overflow-hidden"
            >
              <div className="max-h-72 overflow-y-auto p-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                      !value ? 'bg-white text-black font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                >
                  <span>None (Root)</span>
                  {!value && <span className="text-[10px] uppercase tracking-widest">Selected</span>}
                </button>

                {options.length === 0 && (
                  <div className="px-3 py-3 text-xs text-white/25 italic">
                    No valid parent nodes available.
                  </div>
                )}

                {options.map(option => {
                  const isSelected = option.id === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onChange(option.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                        isSelected ? 'bg-blue-500 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span className="truncate text-left">{option.label}</span>
                      {isSelected && <span className="text-[10px] uppercase tracking-widest">Current</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface StatusSelectorProps {
  value: NodeStatus;
  onChange: (value: NodeStatus) => void;
  disabled?: boolean;
}

function StatusSelector({ value, onChange, disabled }: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(isOpen, buttonRef, 180);
  const selectedLabel = STATUS_OPTIONS.find(option => option.value === value)?.label || 'Not Started';

  useEffect(() => {
    if (!isOpen || disabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, isOpen]);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Status</label>
      <div className={cn("relative", isOpen ? "z-50" : "z-30")}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setIsOpen(current => !current);
          }}
          className={cn(
            'w-full flex items-center justify-between gap-3 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors',
            disabled && 'opacity-60 cursor-not-allowed hover:border-white/10'
          )}
        >
          <span className="truncate pr-3">{selectedLabel}</span>
          {!disabled && <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', isOpen && 'rotate-180')} />}
        </button>

        <AnimatePresence>
          {!disabled && isOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, zIndex: 70 }}
              className="rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_30px_60px_rgba(0,0,0,0.65)] overflow-hidden"
            >
              <div className="p-1">
                {STATUS_OPTIONS.map(option => {
                  const isSelected = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                        isSelected ? 'bg-white text-black font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span>{option.label}</span>
                      {isSelected && <span className="text-[10px] uppercase tracking-widest">Selected</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface FloatingOptionSelectorProps {
  value: string | number;
  valueLabel: string;
  options: Array<{ value: string | number; label: string }>;
  onSelect: (value: string | number) => void;
  ariaLabel: string;
  estimatedHeight: number;
  panelMinWidth?: number;
  buttonClassName: string;
}

function FloatingOptionSelector({
  value,
  valueLabel,
  options,
  onSelect,
  ariaLabel,
  estimatedHeight,
  panelMinWidth = 180,
  buttonClassName,
}: FloatingOptionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(isOpen, buttonRef, estimatedHeight);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative', isOpen ? 'z-50' : 'z-30')}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setIsOpen(current => !current)}
        className={buttonClassName}
      >
        <span className="truncate">{valueLabel}</span>
        <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform shrink-0', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ position: 'fixed', top: position.top, left: position.left, width: Math.max(position.width, panelMinWidth), zIndex: 70 }}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_30px_60px_rgba(0,0,0,0.65)] overflow-hidden"
          >
            <div className="max-h-72 overflow-y-auto p-1">
              {options.map(option => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => {
                      onSelect(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                      isSelected ? 'bg-white text-black font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <span className="truncate text-left">{option.label}</span>
                    {isSelected && <span className="text-[10px] uppercase tracking-widest">Selected</span>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DeadlinePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function DeadlinePicker({ value, onChange }: DeadlinePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const parsed = parseISO(value);
      if (isValid(parsed)) {
        return startOfMonth(parsed);
      }
    }

    return startOfMonth(new Date());
  });
  const position = useFloatingPosition(isOpen, buttonRef, 392);

  const selectedDate = useMemo(() => {
    if (!value) return null;

    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date()));
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const monthEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });

    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  const yearOptions = useMemo(() => {
    const startYear = currentMonth.getFullYear() - 10;
    return Array.from({ length: 21 }, (_, index) => startYear + index);
  }, [currentMonth]);

  const pickDate = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Deadline</label>
      <div className={cn("relative", isOpen ? "z-50" : "z-30")}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(current => !current)}
          className="w-full flex items-center gap-3 bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-white/20 hover:border-white/20 transition-colors"
        >
          <Calendar className="w-4 h-4 text-white/30 shrink-0" />
          <span className="flex-1 truncate">{selectedDate ? formatDeadline(value) : 'Choose a deadline'}</span>
          <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', isOpen && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              style={{ position: 'fixed', top: position.top, left: position.left, width: Math.max(position.width, 320), zIndex: 70 }}
              className="rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_30px_60px_rgba(0,0,0,0.65)] overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-4">
                <div className="flex flex-1 min-w-0 gap-2">
                  <FloatingOptionSelector
                    value={currentMonth.getMonth()}
                    valueLabel={MONTH_LABELS[currentMonth.getMonth()]}
                    options={MONTH_LABELS.map((monthLabel, monthIndex) => ({ value: monthIndex, label: monthLabel }))}
                    onSelect={(nextMonth) => {
                      setCurrentMonth(current => new Date(current.getFullYear(), Number(nextMonth), 1));
                    }}
                    ariaLabel="Select month"
                    estimatedHeight={320}
                    panelMinWidth={180}
                    buttonClassName="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                  />

                  <FloatingOptionSelector
                    value={currentMonth.getFullYear()}
                    valueLabel={String(currentMonth.getFullYear())}
                    options={yearOptions.map((year) => ({ value: year, label: String(year) }))}
                    onSelect={(nextYear) => {
                      setCurrentMonth(current => new Date(Number(nextYear), current.getMonth(), 1));
                    }}
                    ariaLabel="Select year"
                    estimatedHeight={400}
                    panelMinWidth={120}
                    buttonClassName="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                  />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(month => subMonths(month, 1))}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentMonth(month => addMonths(month, 1))}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-4 pt-4 pb-3">
                <div className="grid grid-cols-7 gap-1 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                  {DAY_LABELS.map(day => (
                    <span key={day} className="py-1 text-center">{day}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map(day => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const isCurrentDay = isToday(day);

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => pickDate(day)}
                        className={cn(
                          'h-10 rounded-xl text-sm transition-all flex items-center justify-center border border-transparent',
                          isCurrentMonth ? 'text-white/80' : 'text-white/20',
                          isSelected
                            ? 'bg-white text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                            : 'hover:bg-white/5 hover:border-white/10',
                          isCurrentDay && !isSelected && 'border-white/20'
                        )}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => pickDate(new Date())}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold uppercase tracking-[0.16em] text-white/70 hover:text-white transition-colors"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-[0.16em] text-white/30 hover:text-white/70 transition-colors"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface NodeEditorProps {
  node: PlannerNode;
  onClose: () => void;
}

export default function NodeEditor({ node, onClose }: NodeEditorProps) {
  const { nodes, updateNode, deleteNode, user } = usePlannerStore();
  const userId = user?.id;
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description || '');
  const [status, setStatus] = useState<NodeStatus>(node.status);
  const [progress, setProgress] = useState(node.progress);
  const [deadline, setDeadline] = useState(node.deadline || '');
  const [parentId, setParentId] = useState(node.parent_id || '');
  const [noteContent, setNoteContent] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');
  const noteEditorRef = useRef<HTMLTextAreaElement>(null);

  const isAutoCalculated = (node.type === 'goal' && nodes.some(n => n.parent_id === node.id && n.type === 'project')) || 
                           (node.type === 'project' && nodes.some(n => n.parent_id === node.id && (n.type === 'task' || n.type === 'project'))) ||
                           (node.type === 'area' && nodes.some(n => n.parent_id === node.id && n.type === 'goal'));

  useEffect(() => {
    setTitle(node.title);
    setDescription(node.description || '');
    setStatus(node.status);
    setProgress(node.progress);
    setDeadline(node.deadline || '');
    setParentId(node.parent_id || '');
    fetchNote();
  }, [node]);

  useEffect(() => {
    if (activeTab === 'notes') {
      setIsEditingNote(true);
      const frame = window.requestAnimationFrame(() => {
        noteEditorRef.current?.focus();
      });

      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [activeTab]);

  const fetchNote = async () => {
    try {
      const content = await fetchPlannerNote(node.id, userId);
      setNoteContent(content);
    } catch (err) {
      console.error('Failed to fetch note');
    }
  };

  const handleSave = async () => {
    const finalProgress = node.type === 'project' && status === 'completed' ? 100 : progress;
    const updates = {
      title,
      description,
      status,
      progress: finalProgress,
      deadline: deadline || null,
      parent_id: parentId || null,
    };
    
    updateNode(node.id, updates);

    try {
      await updatePlannerNode(node.id, updates, userId);
      await savePlannerNote(node.id, noteContent, userId);
    } catch (err) {
      console.error('Failed to save node', err);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this node?')) {
      deleteNode(node.id);
      try {
        await deletePlannerNode(node.id, userId);
        onClose();
      } catch (err) {
        console.error('Failed to delete node', err);
      }
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-full lg:w-112.5 bg-[#111] border-l border-white/10 shadow-2xl z-50 flex flex-col"
    >
      <div className="p-4 lg:p-6 border-bottom border-white/5 flex items-center justify-between bg-[#161616]">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            node.type === 'area' ? "bg-white" : 
            node.type === 'goal' ? "bg-blue-500" :
            node.type === 'project' ? "bg-purple-500" : "bg-white/40"
          )} />
          <h2 className="text-base lg:text-lg font-bold tracking-tight">Edit {node.type}</h2>
        </div>
        <div className="flex items-center gap-1 lg:gap-2">
          <button onClick={handleSave} title="Save node" aria-label="Save node" className="p-2 hover:bg-white/5 rounded-lg text-emerald-400 transition-colors">
            <Save className="w-5 h-5" />
          </button>
          <button onClick={handleDelete} title="Delete node" aria-label="Delete node" className="p-2 hover:bg-white/5 rounded-lg text-red-400 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={onClose} title="Close editor" aria-label="Close editor" className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/5 bg-[#161616]">
        <button 
          onClick={() => setActiveTab('details')}
          className={cn(
            "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
            activeTab === 'details' ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"
          )}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={cn(
            "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
            activeTab === 'notes' ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"
          )}
        >
          Notes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {activeTab === 'details' ? (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus={node.title === ''}
                title="Node title"
                aria-label="Node title"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <ParentNodeSelector
              node={node}
              nodes={nodes}
              value={parentId}
              onChange={setParentId}
            />

            {node.type !== 'task' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <StatusSelector
                      value={status}
                      onChange={(nextStatus) => {
                        setStatus(nextStatus);
                        if (node.type === 'project' && nextStatus === 'completed') {
                          setProgress(100);
                        }
                      }}
                      disabled={isAutoCalculated && progress === 100}
                    />
                    {isAutoCalculated && progress === 100 && <p className="text-[9px] text-white/20 italic ml-1">Locked to completed (100% progress).</p>}
                    {isAutoCalculated && progress < 100 && <p className="text-[9px] text-white/20 italic ml-1">Status and progress are auto-calculated.</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Progress ({progress}%)</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={node.type === 'project' && status === 'completed' ? 100 : progress}
                      onChange={(e) => setProgress(parseInt(e.target.value))}
                      disabled={isAutoCalculated}
                      title="Node progress"
                      aria-label="Node progress"
                      className="w-full h-10 accent-white disabled:opacity-50"
                    />
                  </div>
                </div>

                {node.type !== 'area' && (
                  <DeadlinePicker value={deadline} onChange={setDeadline} />
                )}
              </>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={node.type === 'task' ? 12 : 4}
                aria-label="Node description"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                placeholder="Add more context..."
              />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Markdown Notes</label>
              <button 
                onClick={() => setIsEditingNote(!isEditingNote)}
                title={isEditingNote ? 'Switch to preview' : 'Switch to edit'}
                aria-label={isEditingNote ? 'Switch notes to preview' : 'Switch notes to edit'}
                className="text-xs font-bold text-white/60 hover:text-white transition-colors"
              >
                {isEditingNote ? 'Preview' : 'Edit'}
              </button>
            </div>
            {isEditingNote ? (
              <textarea 
                ref={noteEditorRef}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                title="Markdown notes editor"
                aria-label="Markdown notes editor"
                className="flex-1 w-full min-h-80 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                placeholder="# My Notes\n\nStart typing immediately..."
              />
            ) : (
              <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl px-6 py-6 text-sm prose prose-invert max-w-none overflow-y-auto">
                <ReactMarkdown>{noteContent || '*No notes yet. Switch to edit to add some.*'}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
