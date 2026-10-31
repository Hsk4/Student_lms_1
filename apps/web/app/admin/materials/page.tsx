export const instant = false;

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { materials as materialRows, users } from '@/db/schema';
import { listCourseLabels } from '@/lib/queries/teacher-courses';

async function Body() {
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  const [rawMaterials, courses] = await Promise.all([
    db
      .select({
        id: materialRows.id,
        title: materialRows.title,
        type: materialRows.type,
        courseId: materialRows.courseId,
        uploadedBy: users.name,
      })
      .from(materialRows)
      .innerJoin(users, eq(users.id, materialRows.uploadedBy))
      .orderBy(desc(materialRows.createdAt)),
    listCourseLabels({ active: true }),
  ]);
  const courseLabel = new Map(courses.map((course) => [course.id, course.label]));
  const materials = rawMaterials.map((row) => ({
    ...row,
    courseLabel: courseLabel.get(row.courseId) ?? 'Course',
  }));

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Upload course materials: notes, past papers, worksheets."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {materials.length === 0 ? (
            <Empty>No materials uploaded yet.</Empty>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((mat) => (
                    <TableRow key={mat.id}>
                      <TableCell className="font-medium">{mat.title}</TableCell>
                      <TableCell>{mat.courseLabel}</TableCell>
                      <TableCell className="capitalize">{mat.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{mat.uploadedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h3 className="text-sm font-semibold">Upload material</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Form coming soon. Supports PDF, DOCX, images.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function AdminMaterialsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
