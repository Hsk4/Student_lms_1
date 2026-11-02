#!/usr/bin/env node

/**
 * Idempotent starter catalogue for the live LMS.
 *
 * Safe to run more than once: boards, levels and subjects are upserted by
 * their schema-level unique keys, while existing course combinations are
 * left untouched. This seeds a broad Pakistani curriculum starter set; the
 * school can refine offerings from the admin catalogue screens.
 *
 * Run from the repository root or Render Shell:
 *   bun run --cwd apps/api seed:catalog
 */

import { sql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { boards, courses, levels, subjects } from "@/db/schema";

const boardSeed = [
  { name: "Federal Board (FBISE)", slug: "fbise" },
  { name: "Sindh Board (BISE Karachi)", slug: "bise-karachi" },
  { name: "Punjab Board (BISE Lahore)", slug: "bise-lahore" },
  { name: "Aga Khan Examination Board", slug: "akeb" },
  { name: "Cambridge (CAIE)", slug: "cambridge" },
] as const;

const levelSeed = [
  { name: "Matric (Grade 9)", order: 1 },
  { name: "Matric (Grade 10)", order: 2 },
  { name: "Intermediate (Grade 11)", order: 3 },
  { name: "Intermediate (Grade 12)", order: 4 },
  { name: "O Level", order: 5 },
  { name: "AS Level", order: 6 },
  { name: "A Level", order: 7 },
] as const;

const subjectSeed = [
  { name: "Accounting", slug: "accounting" },
  { name: "Biology", slug: "biology" },
  { name: "Business Studies", slug: "business-studies" },
  { name: "Chemistry", slug: "chemistry" },
  { name: "Commerce", slug: "commerce" },
  { name: "Computer Science", slug: "computer-science" },
  { name: "Economics", slug: "economics" },
  { name: "English", slug: "english" },
  { name: "General Science", slug: "general-science" },
  { name: "Islamic Studies", slug: "islamic-studies" },
  { name: "Mathematics", slug: "mathematics" },
  { name: "Pakistan Studies", slug: "pakistan-studies" },
  { name: "Physics", slug: "physics" },
  { name: "Urdu", slug: "urdu" },
] as const;

const matricSubjects = [
  "english",
  "urdu",
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "computer-science",
  "pakistan-studies",
  "islamic-studies",
] as const;

const intermediateSubjects = [
  ...matricSubjects,
  "accounting",
  "economics",
  "business-studies",
  "commerce",
] as const;

const cambridgeSubjects = [
  "english",
  "urdu",
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "computer-science",
  "pakistan-studies",
  "islamic-studies",
  "accounting",
  "economics",
  "business-studies",
] as const;

async function seedCatalog() {
  const boardRows = await db
    .insert(boards)
    .values(boardSeed.map((item) => ({ ...item, active: true })))
    .onConflictDoUpdate({
      target: boards.slug,
      set: { name: sql`excluded.name` },
    })
    .returning({ id: boards.id, slug: boards.slug });

  const levelRows = await db
    .insert(levels)
    .values(levelSeed.map((item) => ({ ...item, active: true })))
    .onConflictDoUpdate({
      target: levels.order,
      set: { name: sql`excluded.name`, active: true },
    })
    .returning({ id: levels.id, order: levels.order });

  const subjectRows = await db
    .insert(subjects)
    .values(subjectSeed.map((item) => ({ ...item, active: true })))
    .onConflictDoUpdate({
      target: subjects.slug,
      set: { name: sql`excluded.name`, active: true },
    })
    .returning({ id: subjects.id, slug: subjects.slug });

  const boardId = new Map(boardRows.map((row) => [row.slug, row.id]));
  const levelId = new Map(levelRows.map((row) => [row.order, row.id]));
  const subjectId = new Map(subjectRows.map((row) => [row.slug, row.id]));

  const combinations: {
    board: (typeof boardSeed)[number]["slug"];
    level: number;
    subject: (typeof subjectSeed)[number]["slug"];
  }[] = [];

  const add = (
    board: (typeof boardSeed)[number]["slug"],
    levelsForBoard: number[],
    subjectSlugs: readonly (typeof subjectSeed)[number]["slug"][],
  ) => {
    for (const level of levelsForBoard) {
      for (const subject of subjectSlugs) {
        combinations.push({ board, level, subject });
      }
    }
  };

  // Pakistani SSC and HSSC starter subjects across the major local boards.
  for (const board of ["fbise", "bise-karachi", "bise-lahore", "akeb"] as const) {
    add(board, [1, 2], matricSubjects);
    add(board, [3, 4], intermediateSubjects);
  }

  // Cambridge qualifications are represented as levels, not as boards.
  add("cambridge", [5], cambridgeSubjects);
  add("cambridge", [6, 7], [
    "english",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "computer-science",
    "accounting",
    "economics",
    "business-studies",
  ]);

  const courseValues = combinations.map((item) => {
    const board = boardId.get(item.board);
    const level = levelId.get(item.level);
    const subject = subjectId.get(item.subject);
    if (!board || !level || !subject) {
      throw new Error(`Missing catalogue reference for ${item.board}/${item.level}/${item.subject}`);
    }
    return {
      boardId: board,
      levelId: level,
      subjectId: subject,
      medium: null,
      active: true,
    };
  });

  const insertedCourses = await db
    .insert(courses)
    .values(courseValues)
    .onConflictDoNothing()
    .returning({ id: courses.id });

  console.log("Catalogue seed complete.");
  console.log(`Boards available: ${boardRows.length}`);
  console.log(`Levels available: ${levelRows.length}`);
  console.log(`Subjects available: ${subjectRows.length}`);
  console.log(`New course combinations added: ${insertedCourses.length}`);
  console.log(`Course combinations in this seed: ${courseValues.length}`);
}

seedCatalog()
  .catch((error: unknown) => {
    console.error("Catalogue seed failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
