import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

function loadEnv() {
  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
      if (urlMatch && urlMatch[1]) {
        supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '');
      }

      const sroleMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/);
      if (sroleMatch && sroleMatch[1]) {
        serviceRoleKey = sroleMatch[1].trim().replace(/['"]/g, '');
      }
    }
  } catch (e) {
    console.error('Error reading .env.local:', e);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables in .env.local.');
    process.exit(1);
  }

  return { supabaseUrl, serviceRoleKey };
}

async function main() {
  console.log('=== Starting University Rankings Seed ===');
  const { supabaseUrl, serviceRoleKey } = loadEnv();
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const jsonPath = path.join(process.cwd(), 'src/data/universityRankings.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Data file not found at: ${jsonPath}`);
    process.exit(1);
  }

  console.log(`Reading dataset from ${jsonPath}...`);
  const rawData: any[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Total raw records in JSON: ${rawData.length}`);

  // Truncate/clean existing university_rankings table cleanly
  console.log('Clearing existing data from university_rankings table...');
  const { error: deleteError } = await supabase
    .from('university_rankings')
    .delete()
    .neq('id', 0);

  if (deleteError) {
    console.warn('Warning when cleaning university_rankings table:', deleteError.message);
  } else {
    console.log('Existing records deleted successfully.');
  }

  // Map items to insert objects
  const insertRows = rawData.map((row) => ({
    program_code: Number(row.program_code),
    university: String(row.university || ''),
    university_type: row.university_type ? String(row.university_type) : null,
    city: row.city ? String(row.city) : null,
    faculty: row.faculty ? String(row.faculty) : null,
    program: String(row.program || ''),
    degree_level: row.degree_level ? String(row.degree_level) : null,
    fee_type: row.fee_type ? String(row.fee_type) : null,
    education_type: row.education_type ? String(row.education_type) : null,
    score_type: row.score_type ? String(row.score_type) : null,
    year: Number(row.year),
    base_score: row.base_score !== null && row.base_score !== undefined ? Number(row.base_score) : null,
    base_ranking: row.base_ranking !== null && row.base_ranking !== undefined ? Number(row.base_ranking) : null,
    quota: row.quota !== null && row.quota !== undefined ? Number(row.quota) : null
  }));

  const batchSize = 1000;
  console.log(`Inserting ${insertRows.length} rows in batches of ${batchSize}...`);

  let insertedTotal = 0;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const batch = insertRows.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('university_rankings')
      .upsert(batch, { onConflict: 'program_code,year' });

    if (insertError) {
      console.error(`❌ Batch insert error at offset ${i}:`, insertError.message);
    } else {
      insertedTotal += batch.length;
      if ((i + batchSize) % 5000 === 0 || i + batchSize >= insertRows.length) {
        console.log(`  Progress: ${insertedTotal} / ${insertRows.length} rows seeded...`);
      }
    }
  }

  console.log(`\n✅ University rankings seed completed! Total rows seeded: ${insertedTotal}`);
}

main().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
