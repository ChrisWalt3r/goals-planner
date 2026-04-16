import { NodeType } from '../types';

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