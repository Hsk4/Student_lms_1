#!/usr/bin/env node
/**
 * Development catalog only. Nothing in app code contains mock data; this script
 * is the one place dev data lives. Safe to run more than once.
 *
 *   bun run seed:dev
 */
import { connectDB } from "../lib/db";
import { Board } from "../models/board";
import { Level } from "../models/level";
import { Subject } from "../models/subject";
import { Course } from "../models/course";
import { Book } from "../models/book";

const BOARDS = [
  { name: "Sindh Board", slug: "sindh-board" },
  { name: "Aga Khan Board", slug: "aga-khan-board" },
];

const LEVELS = [
  { name: "Class 9", order: 1 },
  { name: "Class 10", order: 2 },
  { name: "O Level", order: 3 },
  { name: "A Level", order: 4 },
];

const SUBJECTS = [
  { name: "Mathematics", slug: "mathematics" },
  { name: "Physics", slug: "physics" },
  { name: "English", slug: "english" },
  { name: "Urdu", slug: "urdu" },
];

async function main() {
  await connectDB();

  const boards: Record<string, string> = {};
  for (const board of BOARDS) {
    const doc = await Board.findOneAndUpdate(
      { slug: board.slug },
      { $setOnInsert: { ...board, active: true } },
      { upsert: true, new: true },
    );
    boards[board.slug] = String(doc._id);
  }

  const levels: Record<string, string> = {};
  for (const level of LEVELS) {
    const doc = await Level.findOneAndUpdate(
      { name: level.name },
      { $setOnInsert: { ...level, active: true } },
      { upsert: true, new: true },
    );
    levels[level.name] = String(doc._id);
  }

  const subjects: Record<string, string> = {};
  for (const subject of SUBJECTS) {
    const doc = await Subject.findOneAndUpdate(
      { slug: subject.slug },
      { $setOnInsert: { ...subject, active: true } },
      { upsert: true, new: true },
    );
    subjects[subject.slug] = String(doc._id);
  }

  const courseIds: string[] = [];
  for (const slug of Object.keys(boards)) {
    for (const level of ["Class 9", "Class 10"]) {
      for (const subject of ["mathematics"]) {
        const doc = await Course.findOneAndUpdate(
          {
            boardId: boards[slug],
            levelId: levels[level],
            subjectId: subjects[subject],
            medium: "English",
          },
          { $setOnInsert: { active: true } },
          { upsert: true, new: true },
        );
        courseIds.push(String(doc._id));
      }
    }
  }

  await Book.findOneAndUpdate(
    { title: "Mathematics for Class 9" },
    {
      $setOnInsert: {
        author: "Punjab Textbook Board",
        courseIds: [courseIds[0]],
        note: "Recommended courseware. Students buy their own copy.",
      },
    },
    { upsert: true },
  );

  console.log(
    `Seeded ${Object.keys(boards).length} boards, ${Object.keys(levels).length} levels, ` +
      `${Object.keys(subjects).length} subjects, ${courseIds.length} courses and 1 book.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
