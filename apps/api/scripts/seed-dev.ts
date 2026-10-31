#!/usr/bin/env node

/**
 * Seed script for development data.
 * Populates Karachi boards, levels, subjects, and commerce-focused courses.
 * 
 * Usage: npx tsx scripts/seed-dev.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { boards, courses, levels, subjects } from '@/db/schema';

/**
 * Idempotent seed for the catalog.
 *
 * Every upsert relies on a real unique constraint, so a re-run is a no-op:
 * `boards_slug_unique`, `levels_order_unique`, `subjects_slug_unique` and
 * `courses_board_level_subject_medium_unique`.
 */
async function seedData() {
  console.log('Seeding development data...');

  // ============ BOARDS ============
  const boardSeed = [
    { name: 'Federal Board (FBISE)', slug: 'fbise' },
    { name: 'Sindh Board (BISE Karachi)', slug: 'bise-karachi' },
    { name: 'Aga Khan Examination Board', slug: 'akeb' },
    { name: 'Cambridge (CAIE)', slug: 'cambridge' },
  ];

  const boardDocs = await db
    .insert(boards)
    .values(boardSeed.map((board) => ({ ...board, active: true })))
    .onConflictDoUpdate({
      target: boards.slug,
      set: { name: sql`excluded.name` },
    })
    .returning();

  console.log(`✓ Created/found ${boardDocs.length} boards`);

  // ============ LEVELS ============
  const levelSeed = [
    { name: 'Matric (Grade 9)', order: 1 },
    { name: 'Matric (Grade 10)', order: 2 },
    { name: 'Intermediate (Grade 11)', order: 3 },
    { name: 'Intermediate (Grade 12)', order: 4 },
  ];

  const levelDocs = await db
    .insert(levels)
    .values(levelSeed.map((level) => ({ ...level, active: true })))
    .onConflictDoUpdate({
      target: levels.order,
      set: { name: sql`excluded.name` },
    })
    .returning();

  console.log(`✓ Created/found ${levelDocs.length} levels`);

  // ============ SUBJECTS ============
  const subjectSeed = [
    // Commerce core
    { name: 'Accounting', slug: 'accounting' },
    { name: 'Commerce', slug: 'commerce' },
    { name: 'Economics', slug: 'economics' },
    { name: 'Business Studies', slug: 'business-studies' },

    // General subjects
    { name: 'English', slug: 'english' },
    { name: 'Urdu', slug: 'urdu' },
    { name: 'Islamic Studies', slug: 'islamic-studies' },
    { name: 'Pakistan Studies', slug: 'pakistan-studies' },
    { name: 'Mathematics', slug: 'mathematics' },

    // Science
    { name: 'Physics', slug: 'physics' },
    { name: 'Chemistry', slug: 'chemistry' },
    { name: 'Biology', slug: 'biology' },
  ];

  const subjectDocs = await db
    .insert(subjects)
    .values(subjectSeed.map((subject) => ({ ...subject, active: true })))
    .onConflictDoUpdate({
      target: subjects.slug,
      set: { name: sql`excluded.name` },
    })
    .returning();

  console.log(`✓ Created/found ${subjectDocs.length} subjects`);

  // ============ COURSES ============
  // Get IDs for easier reference
  const boardMap = Object.fromEntries(boardDocs.map((b) => [b.slug, b.id]));
  const levelMap = Object.fromEntries(levelDocs.map((l) => [l.order, l.id]));
  const subjectMap = Object.fromEntries(subjectDocs.map((s) => [s.slug, s.id]));

  const courseSeed = [
    // Matric (Grade 9) - Commerce Track - FBISE
    { board: 'fbise', level: 1, subject: 'accounting', medium: 'English' },
    { board: 'fbise', level: 1, subject: 'accounting', medium: 'Urdu' },
    { board: 'fbise', level: 1, subject: 'commerce', medium: 'English' },
    { board: 'fbise', level: 1, subject: 'commerce', medium: 'Urdu' },
    { board: 'fbise', level: 1, subject: 'english', medium: 'English' },
    { board: 'fbise', level: 1, subject: 'urdu', medium: 'Urdu' },
    { board: 'fbise', level: 1, subject: 'mathematics', medium: 'English' },
    { board: 'fbise', level: 1, subject: 'islamic-studies', medium: 'English' },
    { board: 'fbise', level: 1, subject: 'pakistan-studies', medium: 'English' },

    // Matric (Grade 10) - Commerce Track - FBISE
    { board: 'fbise', level: 2, subject: 'accounting', medium: 'English' },
    { board: 'fbise', level: 2, subject: 'accounting', medium: 'Urdu' },
    { board: 'fbise', level: 2, subject: 'commerce', medium: 'English' },
    { board: 'fbise', level: 2, subject: 'commerce', medium: 'Urdu' },
    { board: 'fbise', level: 2, subject: 'economics', medium: 'English' },
    { board: 'fbise', level: 2, subject: 'english', medium: 'English' },
    { board: 'fbise', level: 2, subject: 'urdu', medium: 'Urdu' },
    { board: 'fbise', level: 2, subject: 'mathematics', medium: 'English' },
    { board: 'fbise', level: 2, subject: 'islamic-studies', medium: 'English' },
    { board: 'fbise', level: 2, subject: 'pakistan-studies', medium: 'English' },

    // Intermediate (Grade 11) - Commerce - FBISE
    { board: 'fbise', level: 3, subject: 'accounting', medium: 'English' },
    { board: 'fbise', level: 3, subject: 'accounting', medium: 'Urdu' },
    { board: 'fbise', level: 3, subject: 'business-studies', medium: 'English' },
    { board: 'fbise', level: 3, subject: 'economics', medium: 'English' },
    { board: 'fbise', level: 3, subject: 'english', medium: 'English' },
    { board: 'fbise', level: 3, subject: 'urdu', medium: 'Urdu' },
    { board: 'fbise', level: 3, subject: 'mathematics', medium: 'English' },

    // Intermediate (Grade 12) - Commerce - FBISE
    { board: 'fbise', level: 4, subject: 'accounting', medium: 'English' },
    { board: 'fbise', level: 4, subject: 'accounting', medium: 'Urdu' },
    { board: 'fbise', level: 4, subject: 'business-studies', medium: 'English' },
    { board: 'fbise', level: 4, subject: 'economics', medium: 'English' },
    { board: 'fbise', level: 4, subject: 'english', medium: 'English' },
    { board: 'fbise', level: 4, subject: 'urdu', medium: 'Urdu' },
    { board: 'fbise', level: 4, subject: 'mathematics', medium: 'English' },

    // Sindh Board (BISE Karachi) - Commerce
    { board: 'bise-karachi', level: 1, subject: 'accounting', medium: 'English' },
    { board: 'bise-karachi', level: 1, subject: 'commerce', medium: 'English' },
    { board: 'bise-karachi', level: 1, subject: 'english', medium: 'English' },
    { board: 'bise-karachi', level: 1, subject: 'urdu', medium: 'Urdu' },
    { board: 'bise-karachi', level: 1, subject: 'mathematics', medium: 'English' },
    
    { board: 'bise-karachi', level: 2, subject: 'accounting', medium: 'English' },
    { board: 'bise-karachi', level: 2, subject: 'commerce', medium: 'English' },
    { board: 'bise-karachi', level: 2, subject: 'economics', medium: 'English' },
    { board: 'bise-karachi', level: 2, subject: 'english', medium: 'English' },
    { board: 'bise-karachi', level: 2, subject: 'urdu', medium: 'Urdu' },
    { board: 'bise-karachi', level: 2, subject: 'mathematics', medium: 'English' },
    
    { board: 'bise-karachi', level: 3, subject: 'accounting', medium: 'English' },
    { board: 'bise-karachi', level: 3, subject: 'business-studies', medium: 'English' },
    { board: 'bise-karachi', level: 3, subject: 'economics', medium: 'English' },
    { board: 'bise-karachi', level: 3, subject: 'english', medium: 'English' },
    { board: 'bise-karachi', level: 3, subject: 'mathematics', medium: 'English' },
    
    { board: 'bise-karachi', level: 4, subject: 'accounting', medium: 'English' },
    { board: 'bise-karachi', level: 4, subject: 'business-studies', medium: 'English' },
    { board: 'bise-karachi', level: 4, subject: 'economics', medium: 'English' },
    { board: 'bise-karachi', level: 4, subject: 'english', medium: 'English' },
    { board: 'bise-karachi', level: 4, subject: 'mathematics', medium: 'English' },

    // Cambridge/CAIE - Commerce
    { board: 'cambridge', level: 1, subject: 'accounting', medium: 'English' },
    { board: 'cambridge', level: 1, subject: 'business-studies', medium: 'English' },
    { board: 'cambridge', level: 1, subject: 'english', medium: 'English' },
    
    { board: 'cambridge', level: 3, subject: 'accounting', medium: 'English' },
    { board: 'cambridge', level: 3, subject: 'business-studies', medium: 'English' },
    { board: 'cambridge', level: 3, subject: 'economics', medium: 'English' },
    { board: 'cambridge', level: 3, subject: 'english', medium: 'English' },

    // Aga Khan Examination Board - Commerce
    { board: 'akeb', level: 1, subject: 'accounting', medium: 'English' },
    { board: 'akeb', level: 1, subject: 'commerce', medium: 'English' },
    { board: 'akeb', level: 1, subject: 'english', medium: 'English' },
    { board: 'akeb', level: 1, subject: 'urdu', medium: 'Urdu' },
    { board: 'akeb', level: 1, subject: 'mathematics', medium: 'English' },
    
    { board: 'akeb', level: 2, subject: 'accounting', medium: 'English' },
    { board: 'akeb', level: 2, subject: 'commerce', medium: 'English' },
    { board: 'akeb', level: 2, subject: 'economics', medium: 'English' },
    { board: 'akeb', level: 2, subject: 'english', medium: 'English' },
    { board: 'akeb', level: 2, subject: 'urdu', medium: 'Urdu' },
    { board: 'akeb', level: 2, subject: 'mathematics', medium: 'English' },
  ];

  // One insert for every course; the `nullsNotDistinct` unique index makes the
  // repeat of a (board, level, subject, medium) a no-op instead of a duplicate.
  const courseValues = courseSeed.map((courseData) => ({
    boardId: boardMap[courseData.board],
    levelId: levelMap[courseData.level],
    subjectId: subjectMap[courseData.subject],
    medium: courseData.medium || null,
    active: true,
  }));

  const inserted = await db
    .insert(courses)
    .values(courseValues)
    .onConflictDoNothing()
    .returning({ id: courses.id });

  console.log(`✓ Created ${inserted.length} courses`);

  console.log('\n✓ Development data seeding complete!');
  console.log('\nSummary:');
  console.log(`- ${boardDocs.length} boards`);
  console.log(`- ${levelDocs.length} levels`);
  console.log(`- ${subjectDocs.length} subjects`);
  console.log(`- ${inserted.length} new courses + existing`);
  console.log('\nBoards: FBISE, Sindh Board (BISE Karachi), Aga Khan, Cambridge');
  console.log('Specialization: Commerce (Accounting, Economics, Business Studies)');

  process.exit(0);
}

seedData().catch((error) => {
  console.error('Seed error:', error.message);
  process.exit(1);
});
