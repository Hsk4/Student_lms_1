"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PageHeader, Card, Empty } from "@/components/ui/nila";
import { api } from "@/lib/api-client";

type MaterialRow = {
  id: string;
  title: string;
  type: string;
  courseId: string;
  courseLabel: string;
  uploadedBy: string;
};

export default function AdminMaterialsPage() {
  const materialsQuery = useQuery({
    queryKey: ["admin-materials"],
    queryFn: () => api.get<MaterialRow[]>("/admin/materials"),
  });
  const materials = materialsQuery.data ?? [];

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
                      <TableCell className="text-sm text-muted-foreground">
                        {mat.uploadedBy}
                      </TableCell>
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
