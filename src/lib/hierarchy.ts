import { PlannerNode, NodeType } from '../types';

const ALLOWED_PARENT_TYPES: Record<NodeType, NodeType[]> = {
  area: ['area', 'goal', 'project'],
  goal: ['area', 'goal', 'project'],
  project: ['area', 'goal', 'project'],
  task: ['project'],
};

export function getAllowedParentTypes(childType: NodeType): NodeType[] {
  return ALLOWED_PARENT_TYPES[childType] ?? [];
}

export function canNodeTypeBeChildOf(childType: NodeType, parentType: NodeType): boolean {
  return getAllowedParentTypes(childType).includes(parentType);
}

export function getAllowedChildTypes(parentType: NodeType): NodeType[] {
  const allTypes: NodeType[] = ['area', 'goal', 'project', 'task'];
  return allTypes.filter((type) => canNodeTypeBeChildOf(type, parentType));
}

export function getAllowedStructuralChildTypes(parentType: NodeType): NodeType[] {
  return getAllowedChildTypes(parentType).filter((type) => type !== 'task');
}

export function getPlanningNodes(nodes: PlannerNode[]): PlannerNode[] {
  return nodes.filter((node) => node.type !== 'task');
}

export function getPlanningNodeStats(nodes: PlannerNode[]) {
  const planningNodes = getPlanningNodes(nodes);
  const total = planningNodes.length;
  const completed = planningNodes.filter((node) => node.status === 'completed').length;
  const inProgress = planningNodes.filter((node) => node.status === 'in-progress').length;

  return {
    total,
    completed,
    inProgress,
    notStarted: total - completed - inProgress,
    overallProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function collectNodeAndDescendantIds(nodes: PlannerNode[], rootId: string): string[] {
  const childMap = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.parent_id) continue;

    const children = childMap.get(node.parent_id) ?? [];
    children.push(node.id);
    childMap.set(node.parent_id, children);
  }

  const collected = new Set<string>();
  const pending = [rootId];

  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || collected.has(currentId)) continue;

    collected.add(currentId);
    const childIds = childMap.get(currentId) ?? [];
    for (const childId of childIds) {
      pending.push(childId);
    }
  }

  return [...collected];
}

export function collectOrphanNodeIds(nodes: PlannerNode[]): string[] {
  const remainingIds = new Set(nodes.map((node) => node.id));
  const orphanIds = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;

    for (const node of nodes) {
      if (!remainingIds.has(node.id)) continue;
      if (!node.parent_id) continue;

      if (!remainingIds.has(node.parent_id)) {
        remainingIds.delete(node.id);
        orphanIds.add(node.id);
        changed = true;
      }
    }
  }

  return [...orphanIds];
}