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
import { ConfirmMeetingForm, RequestNewSlotButton } from "../teacher-forms";

type MeetingRow = {
  id: string;
  parentName: string;
  parentEmail: string;
  studentName: string;
  slots: string;
  state: string;
  confirmedAt: string | null;
};

export default function TeacherMeetingsPage() {
  const meetingsQuery = useQuery({
    queryKey: ["teacher", "meetings"],
    queryFn: () => api.get<MeetingRow[]>("/teacher/meetings"),
  });
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
        description="Parents request meetings about their child. Confirm a time or ask for another slot."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Open ({open.length})
      </h2>
      {open.length === 0 ? (
        <Empty>No meeting requests.</Empty>
      ) : (
        <div className="space-y-3">
          {open.map((meeting) => (
            <Card key={meeting.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{meeting.parentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.parentEmail}
                  </p>
                  <p className="mt-1 text-sm">About {meeting.studentName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preferred: {meeting.slots || "Not given"}
                  </p>
                </div>
                <Chip tone={toneFor(meeting.state)}>{meeting.state}</Chip>
              </div>
              {meeting.confirmedAt ? (
                <p className="mt-2 text-sm">
                  Scheduled for {formatDate(meeting.confirmedAt)}
                </p>
              ) : null}
              <ConfirmMeetingForm
                meetingId={meeting.id}
                confirmedAt={meeting.confirmedAt}
              />
              {meeting.confirmedAt ? (
                <div className="mt-2">
                  <RequestNewSlotButton meetingId={meeting.id} />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {closed.length ? (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Closed ({closed.length})
          </h2>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Scheduled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell>{meeting.parentName}</TableCell>
                    <TableCell>{meeting.studentName}</TableCell>
                    <TableCell>
                      <Chip tone={toneFor(meeting.state)}>{meeting.state}</Chip>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(meeting.confirmedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
