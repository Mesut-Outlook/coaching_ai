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

async function backupTable(supabase: any, tableName: string) {
  console.log(`Exporting table: ${tableName}...`);
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.error(`❌ Error fetching ${tableName}:`, error.message);
    return [];
  }
  console.log(`  -> ${tableName}: ${data?.length || 0} rows fetched.`);
  return data || [];
}

async function downloadFolderRecursive(supabase: any, bucketName: string, folderPath: string, targetLocalDir: string): Promise<number> {
  const { data: fileList, error: listError } = await supabase.storage.from(bucketName).list(folderPath, { limit: 1000 });

  if (listError || !fileList) {
    return 0;
  }

  let count = 0;
  for (const item of fileList) {
    if (item.name === '.emptyFolderPlaceholder') continue;
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;

    // Check if item is a folder (id is null or metadata is null)
    if (!item.id && !item.metadata) {
      const subLocalDir = path.join(targetLocalDir, item.name);
      fs.mkdirSync(subLocalDir, { recursive: true });
      count += await downloadFolderRecursive(supabase, bucketName, itemPath, subLocalDir);
    } else {
      const { data: blob, error: downloadError } = await supabase.storage.from(bucketName).download(itemPath);
      if (downloadError) {
        console.error(`  ❌ Failed to download storage file ${itemPath}:`, downloadError.message);
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const localFilePath = path.join(targetLocalDir, item.name);
      fs.writeFileSync(localFilePath, buffer);
      count++;
    }
  }

  return count;
}

async function backupStorageFiles(supabase: any, backupDir: string) {
  const bucketName = 'student-photos';
  console.log(`Exporting Supabase Storage bucket: ${bucketName}...`);

  const photosDir = path.join(backupDir, 'student-photos');
  fs.mkdirSync(photosDir, { recursive: true });

  const totalDownloaded = await downloadFolderRecursive(supabase, bucketName, '', photosDir);
  console.log(`  -> ${bucketName}: ${totalDownloaded} files downloaded to ${photosDir}`);
  return totalDownloaded;
}

async function main() {
  console.log('=== Starting Full Database & Storage Backup ===');
  const { supabaseUrl, serviceRoleKey } = loadEnv();
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const today = new Date().toISOString().split('T')[0];
  const backupDir = path.join(process.cwd(), 'backups', today);
  fs.mkdirSync(backupDir, { recursive: true });

  // university_rankings bilinçli olarak yok: script'ten yeniden üretilebilen
  // 66 bin satırlık referans veri, yedeği gereksiz yere şişirir.
  const tablesToBackup = [
    'profiles',
    'subjects',
    'topics',
    'students',
    'mock_exams',
    'mock_exam_sections',
    'weekly_tasks',
    'topic_measurements',
    'coach_decisions',
    'error_basket_items',
    'attendance_records',
    // RBAC turunda eklenen tablolar — listeye alınmamıştı, yani kurum/rol/üyelik
    // yapısı hiç yedeklenmiyordu.
    'institutions',
    'roles',
    'memberships',
    'invitations',
    // Denetim kaydı: gece yedeği aynı zamanda arşivdir. Temizlik yapıldığında
    // silinen kayıtlar bu dosyalarda kalır.
    'audit_log'
  ];

  const dbData: Record<string, any[]> = {};
  for (const table of tablesToBackup) {
    dbData[table] = await backupTable(supabase, table);
  }

  const jsonPath = path.join(backupDir, 'database.json');
  fs.writeFileSync(jsonPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log(`\n✅ Database JSON backup saved to: ${jsonPath}`);

  const photoCount = await backupStorageFiles(supabase, backupDir);

  console.log('\n=== Backup Summary ===');
  for (const [table, rows] of Object.entries(dbData)) {
    console.log(`- ${table}: ${rows.length} rows`);
  }
  console.log(`- Storage (student-photos): ${photoCount} files`);
  console.log(`Backup completed successfully at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
