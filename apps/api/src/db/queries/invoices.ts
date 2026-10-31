import { desc, eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { invoices } from "@/db/schema";
import type { Id, Invoice, InvoiceState } from "@/db/types";

/**
 * Invoices. Postgres-backed.
 *
 * `amount` is `numeric(12,2)`, which `postgres-js` returns as a **string** to
 * avoid float rounding. The mapper converts it once, here, so nothing downstream
 * has to remember that.
 */

type InvoiceRow = typeof invoices.$inferSelect;

export function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    studentId: row.studentId,
    period: row.period,
    amount: Number(row.amount),
    dueDate: row.dueDate,
    state: row.state,
    paidAt: row.paidAt,
    markedBy: row.markedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listInvoicesForStudent(
  studentId: Id,
  conn: Tx | typeof db = db,
): Promise<Invoice[]> {
  const rows = await conn
    .select()
    .from(invoices)
    .where(eq(invoices.studentId, studentId))
    .orderBy(desc(invoices.dueDate));
  return rows.map(toInvoice);
}

export async function findInvoiceById(
  id: Id,
  conn: Tx | typeof db = db,
): Promise<Invoice | null> {
  const [row] = await conn
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  return row ? toInvoice(row) : null;
}

export async function createInvoice(
  input: { studentId: Id; period: string; amount: number; dueDate: Date },
  conn: Tx | typeof db = db,
): Promise<Invoice> {
  const [row] = await conn
    .insert(invoices)
    .values({
      studentId: input.studentId,
      period: input.period,
      // The column is numeric; passing a string keeps the cents exact.
      amount: input.amount.toFixed(2),
      dueDate: input.dueDate,
    })
    .returning();
  return toInvoice(row);
}

export async function setInvoiceState(
  id: Id,
  input: { state: InvoiceState; paidAt?: Date | null; markedBy?: Id | null },
  conn: Tx | typeof db = db,
): Promise<void> {
  await conn
    .update(invoices)
    .set({
      state: input.state,
      ...(input.paidAt === undefined ? {} : { paidAt: input.paidAt }),
      ...(input.markedBy === undefined ? {} : { markedBy: input.markedBy }),
    })
    .where(eq(invoices.id, id));
}
