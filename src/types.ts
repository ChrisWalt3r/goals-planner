export type NodeType = 'area' | 'goal' | 'project' | 'task';
export type NodeStatus = 'not-started' | 'in-progress' | 'completed';

export interface PlannerNode {
  id: string;
  parent_id: string | null;
  type: NodeType;
  title: string;
  description: string;
  status: NodeStatus;
  progress: number;
  deadline: string | null;
  position_x: number;
  position_y: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}
