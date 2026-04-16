import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { PlannerNode, NodeStatus, NodeType, User } from '../types';

interface PlannerNodeRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: NodeType;
  title: string;
  description: string | null;
  status: NodeStatus;
  progress: number | null;
  deadline: string | null;
  position_x: number | null;
  position_y: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface PlannerNoteRow {
  node_id: string;
  user_id: string;
  content: string | null;
  updated_at: string;
}

const stripUndefined = <T extends Record<string, unknown>>(value: T) => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
};

const mapUser = (user: SupabaseUser): User => ({
  id: user.id,
  email: user.email || '',
});

export interface PlannerAuthResult {
  user: User;
  token: string | null;
  session: Session | null;
  requiresEmailConfirmation?: boolean;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const resolveUserId = async (userId?: string) => {
  if (userId) return userId;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated user available.');

  return data.user.id;
};

const mapNode = (row: PlannerNodeRow): PlannerNode => ({
  id: row.id,
  parent_id: row.parent_id,
  type: row.type,
  title: row.title,
  description: row.description || '',
  status: row.status,
  progress: row.progress ?? 0,
  deadline: row.deadline,
  position_x: row.position_x ?? 0,
  position_y: row.position_y ?? 0,
  tags: Array.isArray(row.tags) ? row.tags : [],
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const buildNodePayload = (node: PlannerNode) => ({
  id: node.id,
  parent_id: node.parent_id,
  type: node.type,
  title: node.title,
  description: node.description,
  status: node.status,
  progress: node.progress,
  deadline: node.deadline,
  position_x: node.position_x,
  position_y: node.position_y,
  tags: node.tags,
  created_at: node.created_at,
  updated_at: node.updated_at,
});

export async function getSupabaseSessionUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ? mapUser(data.user) : null;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithPassword(email: string, password: string): Promise<PlannerAuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error('Sign in did not return a session.');
  }

  return {
    user: mapUser(data.user),
    token: data.session.access_token,
    session: data.session,
    requiresEmailConfirmation: false,
  } satisfies PlannerAuthResult;
}

export async function signUpWithPassword(email: string, password: string): Promise<PlannerAuthResult> {
  const { data, error } = await supabase.auth.signUp({ email: normalizeEmail(email), password });
  if (error) throw error;
  if (!data.user) {
    throw new Error('Account created, but Supabase did not return a user.');
  }

  if (!data.session) {
    return {
      user: mapUser(data.user),
      token: null,
      session: null,
      requiresEmailConfirmation: true,
    } satisfies PlannerAuthResult;
  }

  return {
    user: mapUser(data.user),
    token: data.session.access_token,
    session: data.session,
  } satisfies PlannerAuthResult;
}

export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${window.location.origin}/?type=recovery`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchPlannerNodes(userId: string) {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapNode(row as PlannerNodeRow));
}

export async function createPlannerNode(node: PlannerNode, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const { error } = await supabase.from('nodes').insert({
    ...buildNodePayload(node),
    user_id: resolvedUserId,
  });
  if (error) throw error;
}

export async function updatePlannerNode(nodeId: string, updates: Partial<PlannerNode>, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const payload = stripUndefined({
    parent_id: updates.parent_id,
    type: updates.type,
    title: updates.title,
    description: updates.description,
    status: updates.status,
    progress: updates.progress,
    deadline: updates.deadline,
    position_x: updates.position_x,
    position_y: updates.position_y,
    tags: updates.tags,
    updated_at: new Date().toISOString(),
  });

  const { error } = await supabase.from('nodes').update(payload).eq('id', nodeId).eq('user_id', resolvedUserId);
  if (error) throw error;
}

export async function deletePlannerNode(nodeId: string, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const { error } = await supabase.from('nodes').delete().eq('id', nodeId).eq('user_id', resolvedUserId);
  if (error) throw error;
}

export async function fetchPlannerNote(nodeId: string, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const { data, error } = await supabase
    .from('notes')
    .select('node_id, user_id, content, updated_at')
    .eq('node_id', nodeId)
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (error) throw error;
  const note = data as PlannerNoteRow | null;
  return note?.content || '';
}

export async function savePlannerNote(nodeId: string, content: string, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const { error } = await supabase.from('notes').upsert({
    node_id: nodeId,
    user_id: resolvedUserId,
    content,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
