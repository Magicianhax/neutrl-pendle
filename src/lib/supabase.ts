import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Client for browser/public access (read-only operations)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// Admin client for server-side operations (write operations)
export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured
  ? supabaseServiceKey
    ? createClient(supabaseUrl!, supabaseServiceKey)
    : supabase
  : null;

// Types for the database
export interface TvlRow {
  id: string;
  tvlAmount: number;
  weightedTvl: number;
  dailyPoints: number;
  share: number;
}

export interface TvlCategory {
  category: string;
  rows: TvlRow[];
}

export interface TvlSummary {
  s1RewardsIssued: number;
  s1RewardsIssuedFormatted?: string;
  participantCount: number;
  totalTvl: number;
  totalTvlFormatted?: string;
  weightedTvl: number;
  weightedTvlFormatted?: string;
  estDailyPoints: number;
  estDailyPointsFormatted?: string;
  estWeeklyPoints: number;
  estWeeklyPointsFormatted?: string;
  estMonthlyPoints: number;
  estMonthlyPointsFormatted?: string;
}

export interface TvlSnapshot {
  id?: number;
  captured_at: string;
  captured_at_unix: number;
  summary: TvlSummary;
  table_condensed: TvlCategory[];
  created_at?: string;
}

// Helper functions for database operations
export async function saveSnapshot(snapshot: Omit<TvlSnapshot, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { error } = await supabaseAdmin
    .from('tvl_snapshots')
    .insert({
      captured_at: snapshot.captured_at,
      captured_at_unix: snapshot.captured_at_unix,
      summary: snapshot.summary,
      table_condensed: snapshot.table_condensed,
    });

  if (error) {
    console.error('Error saving snapshot:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getLatestSnapshot(): Promise<TvlSnapshot | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('tvl_snapshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching latest snapshot:', error);
    return null;
  }

  return data;
}

export async function getAllSnapshots(limit = 100): Promise<TvlSnapshot[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('tvl_snapshots')
    .select('*')
    .order('captured_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching snapshots:', error);
    return [];
  }

  return data || [];
}

export async function getSnapshotsByDateRange(
  startDate: string,
  endDate: string
): Promise<TvlSnapshot[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('tvl_snapshots')
    .select('*')
    .gte('captured_at', startDate)
    .lte('captured_at', endDate)
    .order('captured_at', { ascending: true });

  if (error) {
    console.error('Error fetching snapshots by date range:', error);
    return [];
  }

  return data || [];
}

export async function getSnapshotCount(): Promise<number> {
  if (!supabase) {
    return 0;
  }

  const { count, error } = await supabase
    .from('tvl_snapshots')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error counting snapshots:', error);
    return 0;
  }

  return count || 0;
}
