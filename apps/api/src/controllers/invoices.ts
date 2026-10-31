import type { Request } from "express";
import { z } from "zod";
import { recordIdSchema } from "@lms/shared";
import { db } from "@/db";
import { notFound } from "@/lib/http-error";
import { writeAudit } from "@/lib/audit";
import { actorOf } from "@/middleware/auth";
import { assertCanReadStudent } from "@/lib/ownership";
import {
  createInvoice,
  findInvoiceById,
  listInvoicesForStudent,
  listInvoices,
  setInvoiceState,
} from "@/db/queries/invoices";

const createInvoiceSchema = z.object({
  studentId: recordIdSchema,
  period: z.string().min(1),
  amount: z.number().int().positive(),
  dueDate: z.string().datetime(),
});

/** `POST /api/v1/admin/invoices` — whole PKR integers only. */
export async function createInvoiceRow(req: Request) {
  const actor = actorOf(req);
  const input = createInvoiceSchema.parse(req.body);

  await db.transaction(async (tx) => {
    const invoice = await createInvoice(
      {
        studentId: input.studentId,
        period: input.period,
        amount: input.amount,
        dueDate: new Date(input.dueDate),
      },
      tx,
    );
    await writeAudit(
      {
        actorId: actor.id,
        action: "createInvoice",
        targetType: "Invoice",
        targetId: invoice.id,
        after: {
          studentId: invoice.studentId,
          period: invoice.period,
          amount: invoice.amount,
          dueDate: invoice.dueDate.toISOString(),
        },
      },
      { tx },
    );
  });
}

/** `POST /api/v1/admin/invoices/:id/paid` */
export async function markInvoicePaid(req: Request) {
  const actor = actorOf(req);
  const invoiceId = recordIdSchema.parse(req.params.id);

  await db.transaction(async (tx) => {
    const invoice = await findInvoiceById(invoiceId, tx);
    if (!invoice) throw notFound("Invoice not found");

    await setInvoiceState(
      invoice.id,
      { state: "paid", paidAt: new Date(), markedBy: actor.id },
      tx,
    );
    await writeAudit(
      {
        actorId: actor.id,
        action: "markInvoicePaid",
        targetType: "Invoice",
        targetId: invoice.id,
        before: { state: invoice.state },
        after: { state: "paid" },
      },
      { tx },
    );
  });
}

/**
 * `GET /api/v1/invoices?studentId=`
 * Admin: any student. Student: only themselves. Parent: only a linked child.
 */
export async function studentInvoices(req: Request) {
  const actor = actorOf(req);
  const studentId = recordIdSchema.parse(req.query.studentId);
  await assertCanReadStudent(actor, studentId);
  return listInvoicesForStudent(studentId);
}

/** `GET /api/v1/admin/invoices` — every invoice, newest first. */
export async function allInvoices() {
  return listInvoices();
}
