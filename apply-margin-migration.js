#!/usr/bin/env node
/**
 * Apply profit margins migration (patch 020)
 * Adds margin columns to companies and quotes tables
 */

const fs = require('fs');
const path = require('path');

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found!');
  console.log('Create .env.local with your Supabase credentials:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔄 Applying profit margins migration (patch 020)...\n');

  const migrationPath = path.join(__dirname, 'backend', 'supabase', 'migrations', 'quotecore_v2_patch_020_profit_margins.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  try {
    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (less safe)
      console.log('⚠️  exec_sql function not found, trying direct execution...');
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

      for (const statement of statements) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
        if (stmtError) {
          console.error('❌ Migration failed:', stmtError.message);
          process.exit(1);
        }
      }
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('Added columns:');
    console.log('  companies:');
    console.log('    - default_material_margin_percent (NUMERIC, 0-100)');
    console.log('    - default_labor_margin_percent (NUMERIC, 0-100)');
    console.log('  quotes:');
    console.log('    - material_margin_percent (NUMERIC, 0-100, nullable)');
    console.log('    - labor_margin_percent (NUMERIC, 0-100, nullable)');
    console.log('    - material_margin_enabled (BOOLEAN, default true)');
    console.log('    - labor_margin_enabled (BOOLEAN, default true)');
    console.log('\n✅ Slice 1 complete - Database schema ready!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\nManual steps:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Paste the contents of backend/supabase/migrations/quotecore_v2_patch_020_profit_margins.sql');
    console.log('3. Run the migration');
    process.exit(1);
  }
}

applyMigration();
