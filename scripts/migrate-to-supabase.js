#!/usr/bin/env node
/**
 * Migration Script: Local JSON to Supabase
 *
 * This script imports existing tvl-history.json data to Supabase.
 * Run this once after setting up your Supabase database.
 *
 * Usage:
 *   node scripts/migrate-to-supabase.js
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrate() {
  console.log('='.repeat(60));
  console.log('TVL History Migration: Local JSON → Supabase');
  console.log('='.repeat(60));

  // Load local data
  const historyPath = path.join(__dirname, '..', 'data', 'tvl-history.json');

  if (!fs.existsSync(historyPath)) {
    console.error('Error: tvl-history.json not found at:', historyPath);
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  console.log(`Found ${localData.length} snapshots in local file`);

  // Check existing data in Supabase
  const { count: existingCount } = await supabase
    .from('tvl_snapshots')
    .select('*', { count: 'exact', head: true });

  console.log(`Found ${existingCount || 0} existing snapshots in Supabase`);

  if (existingCount > 0) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('Supabase already has data. Continue and add new snapshots? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Migration cancelled');
      process.exit(0);
    }
  }

  // Get existing unix timestamps to avoid duplicates
  const { data: existingSnapshots } = await supabase
    .from('tvl_snapshots')
    .select('captured_at_unix');

  const existingTimestamps = new Set(
    (existingSnapshots || []).map(s => s.captured_at_unix)
  );

  // Filter out duplicates
  const newSnapshots = localData.filter(
    snapshot => !existingTimestamps.has(snapshot.capturedAtUnix)
  );

  console.log(`${newSnapshots.length} new snapshots to migrate`);

  if (newSnapshots.length === 0) {
    console.log('No new snapshots to migrate. All data already exists.');
    process.exit(0);
  }

  // Transform and insert in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < newSnapshots.length; i += BATCH_SIZE) {
    const batch = newSnapshots.slice(i, i + BATCH_SIZE);

    const rows = batch.map(snapshot => ({
      captured_at: snapshot.capturedAt,
      captured_at_unix: snapshot.capturedAtUnix,
      summary: snapshot.summary,  // Preserve full summary object
      table_condensed: snapshot.tableCondensed,  // Preserve full table structure with rows
    }));

    const { error } = await supabase
      .from('tvl_snapshots')
      .insert(rows);

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${i / BATCH_SIZE + 1}: ${batch.length} snapshots`);
    }
  }

  console.log('='.repeat(60));
  console.log('Migration Complete!');
  console.log(`  Inserted: ${inserted} snapshots`);
  console.log(`  Errors: ${errors} snapshots`);
  console.log('='.repeat(60));
}

migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
