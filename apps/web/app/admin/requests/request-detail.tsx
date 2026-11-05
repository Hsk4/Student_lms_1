"use client";

import type { AdminRequestView } from "@lms/shared";
import { PARENT_RELATIONSHIP_LABELS } from "@lms/shared";
import { formatDate } from "@/components/ui/nila";

/**
 * The application itself, laid out for whichever role filed it.
 *
 * The panel renders the role's actual answers — a teacher application shows the
 * teaching profile and experience, a parent application shows the student and
 * the relationship. Legacy requests (filed before the split) only have a note,
 * which is labelled as such rather than pretending to be a full application.
 */

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-foreground">
        {children || <span className="text-muted-foreground">-</span>}
      </dd>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
        {title}
      </h4>
      <dl className="space-y-2 rounded-[var(--radius-card)] bg-secondary/60 p-3">
        {children}
      </dl>
    </section>
  );
}

export function RequestDetail({ request }: { request: AdminRequestView }) {
  const teacher = request.application.teacher;
  const parent = request.application.parent;
  const isStructured = Boolean(teacher || parent);

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <Block title="Applicant">
        <Row label="Name">{request.name}</Row>
        <Row label="Email">{request.email}</Row>
        <Row label="Phone">{request.phone}</Row>
      </Block>

      {teacher ? (
        <>
          <Block title="Teaching profile">
            <Row label="Subjects">{request.subjectLabels.join(", ")}</Row>
            <Row label="Grade levels">{request.levelLabels.join(", ")}</Row>
            <Row label="Experience">{teacher.experienceYears} years</Row>
            <Row label="Institution">{teacher.previousInstitution}</Row>
            <Row label="Qualifications">{teacher.qualifications}</Row>
            <Row label="Certifications">{teacher.certifications}</Row>
            <Row label="Professional bio">{teacher.bio}</Row>
          </Block>
          <Block title="Application">
            <Row label="Why teach here">{teacher.motivation}</Row>
            <Row label="Teaching experience">{teacher.experience}</Row>
            <Row label="Availability">{teacher.availability}</Row>
            <Row label="Additional information">
              {teacher.additionalInformation}
            </Row>
          </Block>
        </>
      ) : null}

      {parent ? (
        <>
          <Block title="Parent / guardian profile">
            <Row label="Relationship">
              {PARENT_RELATIONSHIP_LABELS[parent.relationship] ??
                parent.relationship}
            </Row>
            <Row label="Student">{parent.studentName}</Row>
            <Row label="Student identifier">
              {parent.studentEmail || parent.studentKey}
            </Row>
          </Block>
          <Block title="Application">
            <Row label="Reason for access">{parent.motivation}</Row>
            <Row label="Additional information">
              {parent.additionalInformation}
            </Row>
          </Block>
        </>
      ) : null}

      {!isStructured ? (
        <Block title="Legacy application">
          <Row label="Stated role">
            {request.requestedRole ? (
              <span className="capitalize">{request.requestedRole}</span>
            ) : (
              "Not stated"
            )}
          </Row>
          <Row label="Board / level">
            {[request.board, request.level].filter(Boolean).join(" / ")}
          </Row>
          <Row label="Subjects">{request.subjectLabels.join(", ")}</Row>
          <Row label="Note">
            {request.note || (
              <span className="text-muted-foreground">
                No message was submitted with this request.
              </span>
            )}
          </Row>
        </Block>
      ) : null}

      <Block title="Review">
        <Row label="Submitted">{formatDate(request.createdAt)}</Row>
        <Row label="Status">
          <span className="capitalize">{request.state}</span>
        </Row>
        {request.decidedAt ? (
          <>
            <Row label="Reviewed by">{request.decidedBy ?? "An admin"}</Row>
            <Row label="Reviewed at">{formatDate(request.decidedAt)}</Row>
            <Row label="Decision reason">{request.decisionReason}</Row>
          </>
        ) : null}
      </Block>
    </div>
  );
}
