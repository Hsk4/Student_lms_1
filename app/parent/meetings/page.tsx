export const instant = false;

import {
  Card,
  Chip,
  Empty,
  PageHeader,
  formatDate,
  toneFor,
} from "@/components/ui/nila";
import { listChildOverviews } from "@/actions/parent-panel";
import { requireRole } from "@/lib/auth/guards";
import { requireRequestTime } from "@/lib/auth/panels";
import { connectDB } from "@/lib/db";
import { Meeting } from "@/models/meeting";
import { RequestMeetingForm, RescheduleMeetingForm } from "../parent-forms";

export default async function ParentMeetingsPage() {
  await requireRequestTime();
  const session = await requireRole(["parent"]);
  await connectDB();

  const [children, meetings] = await Promise.all([
    listChildOverviews(),
    Meeting.find({ parentId: session.actorId })
      .populate("teacherId", "name email")
      .populate("studentId", "name")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

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
                  <Card key={String(meeting._id)} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {(
                            meeting.teacherId as unknown as {
                              name?: string;
                            } | null
                          )?.name ?? "Teacher"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          About{" "}
                          {(
                            meeting.studentId as unknown as {
                              name?: string;
                            } | null
                          )?.name ?? "your child"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Preferred:{" "}
                          {meeting.requestedSlots?.join(", ") || "Not given"}
                        </p>
                      </div>
                      <Chip tone={toneFor(meeting.state)}>{meeting.state}</Chip>
                    </div>

                    {meeting.confirmedAt ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <p className="text-sm">
                          Scheduled for {formatDate(meeting.confirmedAt)}
                        </p>
                        <RescheduleMeetingForm
                          meetingId={String(meeting._id)}
                        />
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
                <table className="table">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Child</th>
                      <th>State</th>
                      <th>Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closed.map((meeting) => (
                      <tr key={String(meeting._id)}>
                        <td>
                          {(
                            meeting.teacherId as unknown as {
                              name?: string;
                            } | null
                          )?.name ?? "Teacher"}
                        </td>
                        <td>
                          {(
                            meeting.studentId as unknown as {
                              name?: string;
                            } | null
                          )?.name ?? "Child"}
                        </td>
                        <td>
                          <Chip tone={toneFor(meeting.state)}>
                            {meeting.state}
                          </Chip>
                        </td>
                        <td className="text-muted-foreground">
                          {formatDate(meeting.confirmedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
