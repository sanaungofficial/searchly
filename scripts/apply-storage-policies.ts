import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects`,
  `CREATE POLICY "Users can upload their own resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can read their own resumes" ON storage.objects`,
  `CREATE POLICY "Users can read their own resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects`,
  `CREATE POLICY "Users can delete their own resumes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects`,
  `CREATE POLICY "Users can update their own resumes" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)`,
];

async function main() {
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✓ ${sql.slice(0, 70)}...`);
    } catch (e: any) {
      console.error(`✗ ${sql.slice(0, 70)}...`, e.message);
    }
  }
}

main().finally(() => prisma.$disconnect());
