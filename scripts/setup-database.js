#!/usr/bin/env node
/**
 * Database Setup Script
 * Creates the tvl_snapshots table in Supabase
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

const SQL = `
CREATE TABLE IF NOT EXISTS tvl_snapshots (
  id SERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  captured_at_unix BIGINT NOT NULL,
  summary JSONB NOT NULL,
  table_condensed JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON tvl_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at_unix ON tvl_snapshots(captured_at_unix DESC);

ALTER TABLE tvl_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tvl_snapshots' AND policyname = 'Allow public read access') THEN
    CREATE POLICY "Allow public read access" ON tvl_snapshots FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tvl_snapshots' AND policyname = 'Allow service role insert') THEN
    CREATE POLICY "Allow service role insert" ON tvl_snapshots FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON tvl_snapshots TO anon;
GRANT SELECT ON tvl_snapshots TO authenticated;
GRANT ALL ON tvl_snapshots TO service_role;
`;

async function createTable() {
  console.log('Creating tvl_snapshots table in Supabase...');
  console.log('Project:', projectRef);

  try {
    // Try using the Supabase SQL endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (response.ok) {
      console.log('Table created successfully via RPC!');
      return true;
    }

    // If RPC doesn't exist, that's expected
    console.log('Note: exec_sql RPC not available (this is normal)');
    return false;
  } catch (error) {
    console.log('Could not create table via API:', error.message);
    return false;
  }
}

async function testConnection() {
  console.log('\nTesting Supabase connection...');

  try {
    // Try to query the table (will fail if it doesn't exist, which is fine)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/tvl_snapshots?select=count`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (response.status === 200) {
      console.log('✅ Table exists and connection works!');
      return true;
    } else if (response.status === 404 || response.status === 400) {
      console.log('❌ Table does not exist yet');
      return false;
    } else {
      console.log(`Connection test returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Connection test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Supabase Database Setup');
  console.log('='.repeat(50));

  // Test if table already exists
  const tableExists = await testConnection();

  if (tableExists) {
    console.log('\n✅ Database is ready!');
    console.log('You can now run: npm run migrate-to-supabase');
    return;
  }

  // Try to create table via API
  await createTable();

  // Test again
  const nowExists = await testConnection();

  if (!nowExists) {
    console.log('\n' + '='.repeat(50));
    console.log('MANUAL STEP REQUIRED');
    console.log('='.repeat(50));
    console.log('\nPlease run this SQL in your Supabase dashboard:');
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log('\n--- COPY SQL BELOW ---\n');
    console.log(SQL);
    console.log('\n--- END SQL ---\n');
  }
}

main();
