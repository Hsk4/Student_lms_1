"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CatalogOption } from "@lms/shared";
import { PARENT_RELATIONSHIP_LABELS, PARENT_RELATIONSHIPS } from "@lms/shared";
import { Card } from "@/components/ui/nila";
import { ArchNumber } from "@/components/brand/primitives";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/**
 * The access application.
 *
 * A request is for one role — teacher or parent — and the two roles are asked
 * genuinely different questions. The role is picked first and decides which
 * form is shown; the API validates the same fields again and the admin panel
 * renders whichever half was submitted.
 */

const REQUEST_ROLES = [
  {
    value: "teacher",
    label: "Teacher",
    hint: "I teach, and I want a teacher account with classes.",
  },
  {
    value: "parent",
    label: "Parent",
    hint: "I am a guardian and want to follow my child's schoolwork.",
  },
  {
    value: "student",
    label: "Student",
    hint: "I am enrolled, or about to enrol, in a class.",
  },
] as const;

type RequestedRole = (typeof REQUEST_ROLES)[number]["value"];

type FieldErrors = Record<string, string>;

const MAX_YEARS = 60;

/* ---------------------------------------------------------------------------
 * Small building blocks, so both forms share one look
 * ------------------------------------------------------------------------- */

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-1 text-status-red" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-status-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputProps(id: string, error?: string) {
  return {
    id,
    name: id,
    className: `input ${error ? "border-status-red" : ""}`,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

function textareaProps(id: string, error?: string) {
  return {
    id,
    name: id,
    className: `textarea ${error ? "border-status-red" : ""}`,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

/** A multi-select rendered as toggle chips, matching the rest of the kit. */
function ChipMultiSelect({
  id,
  label,
  hint,
  options,
  selected,
  onToggle,
  error,
  emptyText,
}: {
  id: string;
  label: string;
  hint?: string;
  options: CatalogOption[];
  selected: string[];
  onToggle: (value: string) => void;
  error?: string;
  emptyText: string;
}) {
  return (
    <fieldset id={id}>
      <legend className="label">
        {label}
        <span className="ml-1 text-status-red" aria-hidden>
          *
        </span>
      </legend>
      {hint ? (
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                className={`chip h-8 px-3 transition-colors duration-150 ${
                  active
                    ? "border-primary bg-tint text-tint-foreground"
                    : "border-border text-muted-foreground hover:text-primary"
                }`}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-status-red">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function SectionTitle({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-2.5 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-cobalt">
      <ArchNumber n={n} size={24} tone="cobalt" />
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------------------
 * The form
 * ------------------------------------------------------------------------- */

export function RequestForm({
  defaults,
  boards,
  levels,
  subjects,
}: {
  defaults: {
    name: string;
    email: string;
    /** The door the applicant came through (`?role=…`). */
    requestedRole: RequestedRole;
  };
  boards: CatalogOption[];
  levels: CatalogOption[];
  subjects: CatalogOption[];
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [role, setRole] = useState<RequestedRole>(defaults.requestedRole);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  /* Teacher state */
  const [subjectsPicked, setSubjectsPicked] = useState<string[]>([]);
  const [levelsPicked, setLevelsPicked] = useState<string[]>([]);
  const [years, setYears] = useState("");

  const subjectName = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.label])),
    [subjects],
  );
  const levelName = useMemo(
    () => new Map(levels.map((l) => [l.id, l.label])),
    [levels],
  );

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) =>
    setter((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );

  function onRoleChange(next: RequestedRole) {
    setRole(next);
    setErrors({});
    setMessage(null);
  }

  return (
    <Card className="p-5 sm:p-6">
      <form
        noValidate
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);

          const form = new FormData(event.currentTarget);
          const text = (key: string) => String(form.get(key) ?? "").trim();

          const next: FieldErrors = {};
          const base = {
            name: text("name"),
            email: text("email"),
            phone: text("phone"),
          };
          if (base.name.length < 2) next.name = "Enter your full name.";
          if (!base.email || !base.email.includes("@"))
            next.email = "Enter a valid email.";
          if (base.phone && base.phone.length > 32)
            next.phone = "Keep the phone number under 32 characters.";

          let body: Record<string, unknown> = { requestedRole: role, ...base };
          if (role === "teacher") {
            if (subjectsPicked.length === 0)
              next.subjects = "Pick at least one subject you teach.";
            if (levelsPicked.length === 0)
              next["gradeLevels"] = "Pick at least one grade level.";
            if (!years.trim())
              next.experienceYears = "Enter your years of experience.";
            else if (!Number.isFinite(Number(years)) || Number(years) < 0)
              next.experienceYears = "Enter a valid number of years.";
            if (text("qualifications").length === 0)
              next.qualifications = "Add your highest qualification.";
            if (text("experience").length === 0)
              next.experience = "Describe your teaching experience.";
            if (text("motivation").length === 0)
              next.motivation = "Tell us why you want to teach here.";
            if (text("availability").length === 0)
              next.availability = "Tell us when you are available.";
            body = {
              ...body,
              application: {
                subjects: subjectsPicked,
                gradeLevels: levelsPicked,
                experienceYears: Number(years),
                previousInstitution: text("previousInstitution"),
                qualifications: text("qualifications"),
                certifications: text("certifications"),
                experience: text("experience"),
                motivation: text("motivation"),
                availability: text("availability"),
                bio: text("bio"),
                additionalInformation: text("additionalInformation"),
              },
            };
          } else if (role === "student") {
            /*
             * The legacy student application: the API still accepts it, and
             * board/level/subjects are what the office needs to place a
             * student. None is required — a new student may be "not sure yet".
             */
            body = {
              requestedRole: "student",
              name: base.name,
              email: base.email,
              boardId: text("boardId"),
              levelId: text("levelId"),
              subjectIds: subjectsPicked,
              note: text("note"),
            };
          } else {
            if (!text("relationship"))
              next.relationship = "Choose your relationship to the student.";
            if (text("studentName").length < 2)
              next.studentName = "Enter the student's name.";
            if (text("studentKey").length < 3)
              next.studentKey = "Add the student's email or student code.";
            if (text("motivation").length === 0)
              next.motivation = "Tell us why you need parent access.";
            body = {
              ...body,
              application: {
                relationship: text("relationship"),
                studentName: text("studentName"),
                studentKey: text("studentKey"),
                studentEmail: (() => {
                  const value = text("studentKey");
                  return value.includes("@") ? value.toLowerCase() : "";
                })(),
                motivation: text("motivation"),
                additionalInformation: text("additionalInformation"),
              },
            };
          }

          if (Object.keys(next).length > 0) {
            setErrors(next);
            // The first invalid control is announced, then brought into view.
            const first = Object.keys(next)[0];
            const el = document.getElementById(first);
            el?.scrollIntoView({ block: "center", behavior: "smooth" });
            el?.focus({ preventScroll: true });
            return;
          }
          setErrors({});

          setPending(true);
          try {
            await api.post("/me/request", body);
            await refresh();
            router.push("/pending");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Could not submit",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {/* 1. The role: it decides what the rest of the form asks. */}
        <fieldset>
          <legend className="label">What role are you requesting?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {REQUEST_ROLES.map((option) => {
              const active = role === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border px-3 py-2.5 transition-colors duration-150 ${
                    active
                      ? "border-primary bg-tint"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="requestedRole"
                    value={option.value}
                    checked={active}
                    onChange={() => onRoleChange(option.value)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/*
         * Sits outside the fieldset: a `<fieldset>` centres its contents in
         * some layouts, which pushed this line between the two role cards.
         */}
        {role === "parent" ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Already have a child&apos;s link code?{" "}
            <Link href="/parent/link" className="text-primary underline">
              Enter it after approval
            </Link>
            .
          </p>
        ) : null}

        {/* 2. Who is applying. The account email is pre-filled but editable. */}
        <SectionTitle n={2}>Your details</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Full name" required error={errors.name}>
            <input
              {...inputProps("name", errors.name)}
              defaultValue={defaults.name}
              autoComplete="name"
            />
          </Field>
          <Field id="email" label="Email" required error={errors.email}>
            <input
              {...inputProps("email", errors.email)}
              type="email"
              defaultValue={defaults.email}
              autoComplete="email"
            />
          </Field>
          <Field
            id="phone"
            label="Phone number"
            hint="Optional, but it is how the office calls you."
            error={errors.phone}
          >
            <input
              {...inputProps("phone", errors.phone)}
              type="tel"
              autoComplete="tel"
            />
          </Field>
        </div>

        {role === "teacher" ? (
          <>
            <SectionTitle n={3}>Teaching profile</SectionTitle>
            <div className="space-y-4">
              <ChipMultiSelect
                id="subjects"
                label="Subjects you teach"
                hint="Pick every subject you can teach. The office uses this to match you to courses."
                options={subjects}
                selected={subjectsPicked}
                onToggle={(id) => toggle(setSubjectsPicked, id)}
                error={errors.subjects}
                emptyText="The catalog is empty. An admin can add subjects under Courses."
              />
              <ChipMultiSelect
                id="gradeLevels"
                label="Grade levels you can teach"
                options={levels}
                selected={levelsPicked}
                onToggle={(id) => toggle(setLevelsPicked, id)}
                error={errors.gradeLevels}
                emptyText="No levels in the catalog yet."
              />
              {levelsPicked.length ? (
                <p className="text-xs text-muted-foreground">
                  Selected:{" "}
                  {levelsPicked
                    .map((id) => levelName.get(id) ?? "-")
                    .join(", ")}
                </p>
              ) : null}
              {subjectsPicked.length ? (
                <p className="text-xs text-muted-foreground">
                  Selected:{" "}
                  {subjectsPicked
                    .map((id) => subjectName.get(id) ?? "-")
                    .join(", ")}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="experienceYears"
                  label="Years of teaching experience"
                  required
                  error={errors.experienceYears}
                >
                  <input
                    {...inputProps("experienceYears", errors.experienceYears)}
                    type="number"
                    min={0}
                    max={MAX_YEARS}
                    step={1}
                    inputMode="numeric"
                    value={years}
                    onChange={(event) => setYears(event.target.value)}
                    placeholder="e.g. 5"
                  />
                </Field>
                <Field
                  id="previousInstitution"
                  label="Current / previous institution"
                  error={errors.previousInstitution}
                >
                  <input
                    {...inputProps(
                      "previousInstitution",
                      errors.previousInstitution,
                    )}
                    placeholder="School, college or academy"
                  />
                </Field>
                <Field
                  id="qualifications"
                  label="Highest qualification"
                  required
                  error={errors.qualifications}
                >
                  <input
                    {...inputProps("qualifications", errors.qualifications)}
                    placeholder="e.g. MSc Mathematics, B.Ed"
                  />
                </Field>
                <Field
                  id="certifications"
                  label="Teaching certifications"
                  hint="Optional. e.g. TEFL, IELTS, state licence."
                  error={errors.certifications}
                >
                  <input
                    {...inputProps("certifications", errors.certifications)}
                  />
                </Field>
              </div>
            </div>

            <SectionTitle n={4}>Application</SectionTitle>
            <div className="space-y-4">
              <Field
                id="experience"
                label="Teaching experience / background"
                hint="Grades taught, subjects, class sizes and results — what the office should know."
                required
                error={errors.experience}
              >
                <textarea
                  {...textareaProps("experience", errors.experience)}
                  rows={4}
                  placeholder="Where you taught, what you taught, and how long."
                />
              </Field>
              <Field
                id="motivation"
                label="Why do you want to teach on this platform?"
                required
                error={errors.motivation}
              >
                <textarea
                  {...textareaProps("motivation", errors.motivation)}
                  rows={3}
                />
              </Field>
              <Field
                id="availability"
                label="Availability"
                hint="Days and times you can teach, in your local time."
                required
                error={errors.availability}
              >
                <input
                  {...inputProps("availability", errors.availability)}
                  placeholder="e.g. Mon–Thu evenings, Saturday mornings"
                />
              </Field>
              <Field
                id="bio"
                label="Short professional bio"
                hint="Optional. Shown to the office; keep it to a few sentences."
                error={errors.bio}
              >
                <textarea {...textareaProps("bio", errors.bio)} rows={3} />
              </Field>
              <Field
                id="additionalInformation"
                label="Anything else we should know?"
                hint="Optional."
                error={errors.additionalInformation}
              >
                <textarea
                  {...textareaProps(
                    "additionalInformation",
                    errors.additionalInformation,
                  )}
                  rows={2}
                />
              </Field>
            </div>
          </>
        ) : role === "student" ? (
          <>
            {/*
              * The student application: enough for the office to place them in
              * a class. Everything here is voluntary — a new student often does
              * not know their board yet, and the admin confirms it on approval.
              */}
            <SectionTitle n={3}>Study details</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="boardId" label="Board" error={errors.boardId}>
                <select {...inputProps("boardId", errors.boardId)} defaultValue="">
                  <option value="">Not sure yet</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="levelId" label="Level" error={errors.levelId}>
                <select {...inputProps("levelId", errors.levelId)} defaultValue="">
                  <option value="">Not sure yet</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Optional here, unlike a teacher's: the admin confirms the class. */}
            <fieldset id="subjects">
              <legend className="label">Subjects you are studying</legend>
              <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                Optional. An admin confirms your classes when they approve you.
              </p>
              {subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  The catalog is empty. An admin can add subjects under Courses.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => {
                    const active = subjectsPicked.includes(subject.id);
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => toggle(setSubjectsPicked, subject.id)}
                        className={`chip h-8 px-3 transition-colors duration-150 ${
                          active
                            ? "border-primary bg-tint text-tint-foreground"
                            : "border-border text-muted-foreground hover:text-primary"
                        }`}
                        aria-pressed={active}
                      >
                        {subject.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <Field
              id="note"
              label="Anything we should know?"
              hint="Optional."
              error={errors.note}
            >
              <textarea {...textareaProps("note", errors.note)} rows={3} />
            </Field>
          </>
        ) : (
          <>
            <SectionTitle n={3}>Parent / guardian profile</SectionTitle>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="relationship"
                  label="Relationship to the student"
                  required
                  error={errors.relationship}
                >
                  <select
                    {...inputProps("relationship", errors.relationship)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {PARENT_RELATIONSHIPS.map((value) => (
                      <option key={value} value={value}>
                        {PARENT_RELATIONSHIP_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id="studentName"
                  label="Student's full name"
                  required
                  error={errors.studentName}
                >
                  <input {...inputProps("studentName", errors.studentName)} />
                </Field>
              </div>
              <Field
                id="studentKey"
                label="Student's email or student code"
                hint="Either the email the student uses here, or the code they gave you."
                required
                error={errors.studentKey}
              >
                <input {...inputProps("studentKey", errors.studentKey)} />
              </Field>
            </div>

            <SectionTitle n={4}>Application</SectionTitle>
            <div className="space-y-4">
              <Field
                id="motivation"
                label="Why are you requesting parent access?"
                required
                error={errors.motivation}
              >
                <textarea
                  {...textareaProps("motivation", errors.motivation)}
                  rows={4}
                />
              </Field>
              <Field
                id="additionalInformation"
                label="Anything else we should know?"
                hint="Optional."
                error={errors.additionalInformation}
              >
                <textarea
                  {...textareaProps(
                    "additionalInformation",
                    errors.additionalInformation,
                  )}
                  rows={2}
                />
              </Field>
            </div>
          </>
        )}

        {/* Submit. The summary line makes the role of the submission explicit. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending
              ? "Submitting…"
              : role === "teacher"
                ? "Submit teacher application"
                : role === "student"
                  ? "Submit student request"
                  : "Request parent access"}
          </button>
          <span className="text-xs text-muted-foreground">
            {role === "teacher"
              ? "Applying as a Teacher."
              : role === "student"
                ? "Requesting Student access."
                : "Requesting Parent access."}
          </span>
        </div>

        {message ? (
          <p className="rounded-[var(--radius-card)] border border-status-red bg-status-red-soft px-3 py-2 text-sm text-status-red">
            {message}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
