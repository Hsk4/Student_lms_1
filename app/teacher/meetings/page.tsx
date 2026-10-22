export const instant = false;

import {
  Card,
  Chip,
  Empty,
  PageHeader,
  formatDate,
  toneFor,
} from "@/components/ui/nila";
import { listMyMeetings } from "@/actions/teacher-panel";
import { ConfirmMeetingForm, RequestNewSlotButton } from "../teacher-forms";

export default async function TeacherMeetingsPage() {
  const meetings = await listMyMeetings();
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
            <table className="table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Student</th>
                  <th>State</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((meeting) => (
                  <tr key={meeting.id}>
                    <td>{meeting.parentName}</td>
                    <td>{meeting.studentName}</td>
                    <td>
                      <Chip tone={toneFor(meeting.state)}>{meeting.state}</Chip>
                    </td>
                    <td className="text-muted-foreground">
                      {formatDate(meeting.confirmedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
