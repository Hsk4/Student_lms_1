"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Card,
  Chip,
  Empty,
  PageHeader,
  formatDate,
  toneFor,
} from "@/components/ui/nila";
import { RequestMeetingForm, RescheduleMeetingForm } from "../parent-forms";

type MeetingRow = {
  id: string;
  teacherName: string;
  studentName: string;
  requestedSlots: string[];
  confirmedAt: string | null;
  state: string;
};
type ChildRow = { id: string; name: string };

export default function ParentMeetingsPage() {
  const childrenQuery = useQuery({
    queryKey: ["parent", "children"],
    queryFn: () => api.get<ChildRow[]>("/parent/overview"),
  });
  const meetingsQuery = useQuery({
    queryKey: ["parent", "meetings"],
    queryFn: () => api.get<MeetingRow[]>("/parent/meetings"),
  });

  const children = childrenQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];

  const open = meetings.filter(
    (meeting) => meeting.state !== "done" && meeting.state !== "cancelled",
  );
  const closed = meetings.filter(
    (meeting) => meeting.state === "done" || meeting.state === "cancelled",
  );

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Request time with a child's teacher and follow what is scheduled."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <Empty>No meeting request yet.</Empty>
            ) : (
              <div className="space-y-3">
                {open.map((meeting) => (
                  <Card key={meeting.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{meeting.teacherName}</p>
                        <p className="text-sm text-muted-foreground">
                          About {meeting.studentName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Preferred: {meeting.requestedSlots.join(", ") || "Not given"}
                        </p>
                      </div>
                      <Chip tone={toneFor(meeting.state)}>{meeting.state}</Chip>
                    </div>

                    {meeting.confirmedAt ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <p className="text-sm">
                          Scheduled for {formatDate(meeting.confirmedAt)}
                        </p>
                        <RescheduleMeetingForm meetingId={meeting.id} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Waiting for the teacher to confirm a time.
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          {closed.length ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Closed ({closed.length})
              </h2>
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Child</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Scheduled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closed.map((meeting) => (
                      <TableRow key={meeting.id}>
                        <TableCell>{meeting.teacherName}</TableCell>
                        <TableCell>{meeting.studentName}</TableCell>
                        <TableCell>
                          <Chip tone={toneFor(meeting.state)}>
                            {meeting.state}
                          </Chip>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(meeting.confirmedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          ) : null}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">New request</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The teacher of the child&apos;s active course receives the request.
          </p>
          <div className="mt-3">
            <RequestMeetingForm childRows={children.map(({ id, name }) => ({ id, name }))} />
          </div>
        </Card>
      </div>
    </div>
  );
}
