import { supabase } from './supabase';

/**
 * Verify if the dependency_ids column exists in production database
 * This helps detect schema mismatches early
 */
export async function verifyDependencyIdColumn(): Promise<{
  exists: boolean;
  error?: string;
  message: string;
}> {
  try {
    // Try to fetch a single node and check if dependency_ids is in the response
    const { data, error } = await supabase
      .from('nodes')
      .select('id, dependency_ids')
      .limit(1);

    if (error) {
      // Check if the error message indicates a missing column
      const errorMsg = error.message || '';
      if (errorMsg.includes('dependency_ids') || errorMsg.includes('column')) {
        return {
          exists: false,
          error: errorMsg,
          message: '[WARN] dependency_ids column is missing from production database. Run migration to fix.',
        };
      }
      throw error;
    }

    return {
      exists: true,
      message: '[OK] dependency_ids column exists in database',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      exists: false,
      error: errorMsg,
      message: '[ERROR] Unable to verify schema - dependency connectors may not persist',
    };
  }
}

/**
 * Log schema status to help with debugging
 */
export async function logSchemaStatus(): Promise<void> {
  const status = await verifyDependencyIdColumn();
  console.log('[Schema Validator]', status.message);
  if (status.error) {
    console.warn('[Schema Validator]', 'Error details:', status.error);
  }
}
