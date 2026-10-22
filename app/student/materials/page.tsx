export const instant = false;

import { Card, Empty, PageHeader, formatDay } from "@/components/ui/nila";
import { listMyMaterials } from "@/actions/student-panel";

const TYPES = [
  { key: "notes", label: "Notes" },
  { key: "past_paper", label: "Past papers" },
  { key: "worksheet", label: "Worksheets" },
  { key: "other", label: "Other" },
] as const;

export default async function StudentMaterialsPage() {
  const materials = await listMyMaterials();

  return (
    <div>
      <PageHeader
        title="Course materials"
        description="Notes, past papers and worksheets for your active courses."
      />

      {materials.length === 0 ? (
        <Empty>No materials yet for your courses.</Empty>
      ) : null}

      {TYPES.map((type) => {
        const rows = materials.filter((item) => item.type === type.key);
        if (!rows.length) return null;
        return (
          <section key={type.key} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {type.label} ({rows.length})
            </h2>
            <div className="space-y-2">
              {rows.map((item) => (
                <Card
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.courseLabel} / {formatDay(item.createdAt)}
                    </p>
                  </div>
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary h-9"
                  >
                    Open
                  </a>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
