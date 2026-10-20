#!/usr/bin/env node

/**
 * Seed script for development data.
 * Populates Karachi boards, levels, subjects, and commerce-focused courses.
 * 
 * Usage: npx tsx scripts/seed-dev.ts
 */

import { connectDB } from '../lib/db';
import { Board } from '@/models/board';
import { Level } from '@/models/level';
import { Subject } from '@/models/subject';
import { Course } from '@/models/course';

async function seedData() {
  await connectDB();

  console.log('Seeding development data...');

  // ============ BOARDS ============
  const boards = [
    { name: 'Federal Board (FBISE)', slug: 'fbise' },
    { name: 'Sindh Board (BISE Karachi)', slug: 'bise-karachi' },
    { name: 'Aga Khan Examination Board', slug: 'akeb' },
    { name: 'Cambridge (CAIE)', slug: 'cambridge' },
  ];

  const boardDocs = await Promise.all(
    boards.map(async (board) => {
      return (
        (await Board.findOne({ slug: board.slug })) ||
        (await Board.create(board))
      );
    })
  );

  console.log(`✓ Created/found ${boardDocs.length} boards`);

  // ============ LEVELS ============
  const levels = [
    { name: 'Matric (Grade 9)', order: 1 },
    { name: 'Matric (Grade 10)', order: 2 },
    { name: 'Intermediate (Grade 11)', order: 3 },
    { name: 'Intermediate (Grade 12)', order: 4 },
  ];

  const levelDocs = await Promise.all(
    levels.map(async (level) => {
      return (
        (await Level.findOne({ name: level.name })) ||
        (await Level.create(level))
      );
    })
  );

  console.log(`✓ Created/found ${levelDocs.length} levels`);

  // ============ SUBJECTS ============
  const subjects = [
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

  const subjectDocs = await Promise.all(
    subjects.map(async (subject) => {
      return (
        (await Subject.findOne({ slug: subject.slug })) ||
        (await Subject.create(subject))
      );
    })
  );

  console.log(`✓ Created/found ${subjectDocs.length} subjects`);

  // ============ COURSES ============
  // Get IDs for easier reference
  const boardMap = Object.fromEntries(
    boardDocs.map((b) => [b.slug, b._id])
  );
  const levelMap = Object.fromEntries(
    levelDocs.map((l) => [l.order, l._id])
  );
  const subjectMap = Object.fromEntries(
    subjectDocs.map((s) => [s.slug, s._id])
  );

  const courses = [
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

  let createdCount = 0;

  for (const courseData of courses) {
    const existing = await Course.findOne({
      boardId: boardMap[courseData.board],
      levelId: levelMap[courseData.level],
      subjectId: subjectMap[courseData.subject],
      medium: courseData.medium || '',
    });

    if (!existing) {
      await Course.create({
        boardId: boardMap[courseData.board],
        levelId: levelMap[courseData.level],
        subjectId: subjectMap[courseData.subject],
        medium: courseData.medium || '',
        active: true,
      });
      createdCount++;
    }
  }

  console.log(`✓ Created ${createdCount} courses`);

  console.log('\n✓ Development data seeding complete!');
  console.log('\nSummary:');
  console.log(`- ${boardDocs.length} boards`);
  console.log(`- ${levelDocs.length} levels`);
  console.log(`- ${subjectDocs.length} subjects`);
  console.log(`- ${createdCount} new courses + existing`);
  console.log('\nBoards: FBISE, Sindh Board (BISE Karachi), Aga Khan, Cambridge');
  console.log('Specialization: Commerce (Accounting, Economics, Business Studies)');

  process.exit(0);
}

seedData().catch((error) => {
  console.error('Seed error:', error.message);
  process.exit(1);
});
