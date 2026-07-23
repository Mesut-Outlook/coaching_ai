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
    console.error('❌ Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  return { supabaseUrl, serviceRoleKey };
}

function findBackupFolder(): string {
  const customArg = process.argv[2];
  if (customArg) {
    const fullPath = path.isAbsolute(customArg) ? customArg : path.join(process.cwd(), customArg);
    if (fs.existsSync(fullPath)) return fullPath;
    console.error(`❌ Specified backup path does not exist: ${fullPath}`);
    process.exit(1);
  }

  const backupsBase = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsBase)) {
    console.error(`❌ No backups directory found at ${backupsBase}`);
    process.exit(1);
  }

  const folders = fs.readdirSync(backupsBase)
    .filter(f => fs.statSync(path.join(backupsBase, f)).isDirectory())
    .sort()
    .reverse();

  if (folders.length === 0) {
    console.error(`❌ No backup folders found inside ${backupsBase}`);
    process.exit(1);
  }

  return path.join(backupsBase, folders[0]);
}

async function restoreTable(supabase: any, tableName: string, rows: any[]) {
  if (!rows || rows.length === 0) {
    console.log(`  -> ${tableName}: 0 rows to restore.`);
    return;
  }

  console.log(`Restoring ${rows.length} rows into table: ${tableName}...`);
  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).upsert(batch);
    if (error) {
      console.error(`  ❌ Error restoring batch for ${tableName}:`, error.message);
    }
  }
  console.log(`  -> ${tableName}: ${rows.length} rows restored.`);
}

async function uploadFolderRecursive(supabase: any, bucketName: string, localDir: string, storagePath: string): Promise<number> {
  const items = fs.readdirSync(localDir);
  let count = 0;

  for (const item of items) {
    if (item.startsWith('.')) continue;
    const fullLocalPath = path.join(localDir, item);
    const itemStoragePath = storagePath ? `${storagePath}/${item}` : item;
    const stat = fs.statSync(fullLocalPath);

    if (stat.isDirectory()) {
      count += await uploadFolderRecursive(supabase, bucketName, fullLocalPath, itemStoragePath);
    } else {
      const fileBuffer = fs.readFileSync(fullLocalPath);
      const contentType = item.endsWith('.png') ? 'image/png' : item.endsWith('.jpg') || item.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream';
      const { error } = await supabase.storage.from(bucketName).upload(itemStoragePath, fileBuffer, {
        upsert: true,
        contentType
      });

      if (error) {
        console.error(`  ❌ Failed to upload photo ${itemStoragePath}:`, error.message);
      } else {
        count++;
      }
    }
  }

  return count;
}

async function restoreStorageFiles(supabase: any, backupDir: string) {
  const bucketName = 'student-photos';
  const photosDir = path.join(backupDir, 'student-photos');
  
  if (!fs.existsSync(photosDir)) {
    console.log(`  ℹ️ No student-photos directory found in backup.`);
    return 0;
  }

  console.log(`Restoring files to Supabase Storage bucket: ${bucketName}...`);
  const uploadedCount = await uploadFolderRecursive(supabase, bucketName, photosDir, '');
  console.log(`  -> ${bucketName}: ${uploadedCount} files restored.`);
  return uploadedCount;
}

async function main() {
  console.log('=== Starting Database & Storage Restore ===');
  const { supabaseUrl, serviceRoleKey } = loadEnv();
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const backupDir = findBackupFolder();
  console.log(`Using backup directory: ${backupDir}`);

  const jsonPath = path.join(backupDir, 'database.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ database.json not found in ${backupDir}`);
    process.exit(1);
  }

  const dbData: Record<string, any[]> = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Strict Foreign Key dependency order
  const restoreOrder = [
    'profiles',
    'subjects',
    'topics',
    'students',
    'mock_exams',
    'mock_exam_sections',
    'weekly_tasks',
    'topic_measurements',
    'coach_decisions',
    'error_basket_items'
  ];

  for (const table of restoreOrder) {
    if (dbData[table]) {
      await restoreTable(supabase, table, dbData[table]);
    }
  }

  const photosRestored = await restoreStorageFiles(supabase, backupDir);

  console.log('\n=== Restore Summary ===');
  for (const table of restoreOrder) {
    const count = dbData[table]?.length || 0;
    console.log(`- ${table}: ${count} rows`);
  }
  console.log(`- Storage (student-photos): ${photosRestored} files`);
  console.log(`Restore completed successfully at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal restore error:', err);
  process.exit(1);
});
