export const instant = false;

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader, Card, Empty } from '@/components/ui/nila';
import { checkAccess } from '@/lib/auth/roles';
import { Material } from '@/models/material';
import { Course } from '@/models/course';
import { connectDB } from '@/lib/db';

async function Body() {
  const { user, redirectTo } = await checkAccess(['admin', 'super_admin']);
  if (redirectTo) redirect(redirectTo);

  await connectDB();

  const materials = await Material.find({})
    .populate('courseId', 'name')
    .populate('uploadedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const courses = await Course.find({ active: true }).lean();

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
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Uploaded by</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat: any) => (
                    <tr key={String(mat._id)}>
                      <td className="font-medium">{mat.title}</td>
                      <td>{mat.courseId?.name}</td>
                      <td className="capitalize">{mat.type}</td>
                      <td className="text-sm text-muted-foreground">{mat.uploadedBy?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
