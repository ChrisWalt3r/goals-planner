import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { PlannerNode, NodeStatus, NodeType, User } from '../types';
import { collectNodeAndDescendantIds } from './hierarchy';

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
  dependency_ids: string[] | null;
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

const RETRY_DELAYS_MS = [250, 700, 1400];

const getSupabaseErrorMessage = (error: unknown) => {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') return maybeMessage;
  }

  return String(error);
};

const isTransientSupabaseError = (error: unknown) => {
  const message = getSupabaseErrorMessage(error);
  return /429|too many requests|lock|aborterror|steal|timeout|network|fetch/i.test(message);
};

const withSupabaseRetry = async <T extends { error: unknown }>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> => {
  let attempt = 0;

  while (true) {
    const result = await operation();

    if (!result.error) return result;

    attempt += 1;
    if (attempt >= maxAttempts || !isTransientSupabaseError(result.error)) {
      return result;
    }

    const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  }
};

const isMissingDependencyColumnError = (error: unknown) => {
  const message = getSupabaseErrorMessage(error);
  return /dependency_ids|column .* does not exist/i.test(message);
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
  dependency_ids: Array.isArray(row.dependency_ids) ? [...new Set(row.dependency_ids)] : [],
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const buildNodePayload = (node: PlannerNode, includeDependencies = true) => ({
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
  ...(includeDependencies ? { dependency_ids: node.dependency_ids ?? [] } : {}),
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
  const result = await withSupabaseRetry(() =>
    supabase
      .from('nodes')
      .select('id, user_id, parent_id, type, title, description, status, progress, deadline, position_x, position_y, tags, dependency_ids, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
  );

  if (result.error) throw result.error;
  return (result.data ?? []).map((row) => mapNode(row as PlannerNodeRow));
}

export async function fetchPlannerNoteNodeIds(userId: string) {
  const result = await withSupabaseRetry(() =>
    supabase
      .from('notes')
      .select('node_id, content')
      .eq('user_id', userId)
  );

  if (result.error) throw result.error;

  return (result.data ?? [])
    .filter((row) => typeof row.content === 'string' && row.content.trim().length > 0)
    .map((row) => row.node_id as string);
}

export async function createPlannerNode(node: PlannerNode, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const primaryResult = await withSupabaseRetry(() => supabase.from('nodes').insert({
    ...buildNodePayload(node),
    user_id: resolvedUserId,
  }));

  if (!primaryResult.error) return;
  if (!isMissingDependencyColumnError(primaryResult.error)) throw primaryResult.error;

  // Fallback: dependency_ids column doesn't exist in database yet
  const hasDependencyIds = node.dependency_ids && node.dependency_ids.length > 0;
  if (hasDependencyIds) {
    console.warn(
      '[Planner] Node created without connector links: dependency_ids column missing from database. ' +
      'Run migration in Supabase: ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS dependency_ids JSONB NOT NULL DEFAULT \'[]\'::jsonb;'
    );
  }

  const fallbackResult = await withSupabaseRetry(() => supabase.from('nodes').insert({
    ...buildNodePayload(node, false),
    user_id: resolvedUserId,
  }));

  if (fallbackResult.error) throw fallbackResult.error;
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
    dependency_ids: updates.dependency_ids,
    updated_at: new Date().toISOString(),
  });

  const primaryResult = await withSupabaseRetry(() => supabase.from('nodes').update(payload).eq('id', nodeId).eq('user_id', resolvedUserId));
  if (!primaryResult.error) return;

  if (!isMissingDependencyColumnError(primaryResult.error) || !('dependency_ids' in payload)) throw primaryResult.error;

  // Fallback: The database is missing the dependency_ids column.
  // This gracefully handles the case where production Supabase hasn't been migrated yet.
  const hasDependencyChanges = updates.dependency_ids !== undefined;
  if (hasDependencyChanges) {
    console.warn(
      '[Planner] Connector links not saved: dependency_ids column missing from database. ' +
      'Run migration in Supabase: ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS dependency_ids JSONB NOT NULL DEFAULT \'[]\'::jsonb;'
    );
  }

  const fallbackPayload = stripUndefined({
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

  const fallbackResult = await withSupabaseRetry(() => supabase.from('nodes').update(fallbackPayload).eq('id', nodeId).eq('user_id', resolvedUserId));
  if (fallbackResult.error) throw fallbackResult.error;
}

export async function deletePlannerNode(nodeId: string, userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  const dependencyAwareSelect = await supabase
    .from('nodes')
    .select('id, parent_id, dependency_ids')
    .eq('user_id', resolvedUserId);

  let data: any = dependencyAwareSelect.data;
  let fetchError = dependencyAwareSelect.error;

  if (fetchError && isMissingDependencyColumnError(fetchError)) {
    const fallbackSelect = await supabase
      .from('nodes')
      .select('id, parent_id')
      .eq('user_id', resolvedUserId);

    data = fallbackSelect.data;
    fetchError = fallbackSelect.error;
  }

  if (fetchError) throw fetchError;

  const nodes = (data ?? []) as PlannerNode[];
  const idsToDelete = collectNodeAndDescendantIds(nodes, nodeId);
  const { error } = await supabase.from('nodes').delete().in('id', idsToDelete).eq('user_id', resolvedUserId);
  if (error) throw error;

  const removedIdSet = new Set(idsToDelete);
  const remainingNodes = nodes.filter((node) => !removedIdSet.has(node.id));

  for (const remainingNode of remainingNodes) {
    const nextDependencyIds = (remainingNode.dependency_ids ?? []).filter((dependencyId) => !removedIdSet.has(dependencyId) && dependencyId !== remainingNode.id);
    const currentDependencyIds = remainingNode.dependency_ids ?? [];

    if (nextDependencyIds.length === currentDependencyIds.length && nextDependencyIds.every((dependencyId, index) => dependencyId === currentDependencyIds[index])) {
      continue;
    }

    const { error: updateError } = await supabase
      .from('nodes')
      .update({ dependency_ids: nextDependencyIds, updated_at: new Date().toISOString() })
      .eq('id', remainingNode.id)
      .eq('user_id', resolvedUserId);

    if (updateError) throw updateError;
  }
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
  const result = await withSupabaseRetry(() => supabase.from('notes').upsert({
    node_id: nodeId,
    user_id: resolvedUserId,
    content,
    updated_at: new Date().toISOString(),
  }));

  if (result.error) throw result.error;
}
