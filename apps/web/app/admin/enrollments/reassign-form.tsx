"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

export function ReassignForm({
  enrollmentId,
  currentTeacherId,
  teachers,
  onDone,
}: {
  enrollmentId: string;
  currentTeacherId: string;
  teachers: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        try {
          await api.post(`/admin/enrollments/${enrollmentId}/reassign`, {
            teacherId,
          });
          setMessage("Reassigned.");
          onDone?.();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Could not reassign",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor={`teacher-${enrollmentId}`}>
          Move to
        </label>
        <select
          id={`teacher-${enrollmentId}`}
          className="input w-56"
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose a teacher
          </option>
          {teachers
            .filter((teacher) => teacher.id !== currentTeacherId)
            .map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
        </select>
      </div>
      <button
        type="submit"
        className="border border-border bg-card text-foreground shadow-sm hover:bg-secondary"
        disabled={pending}
      >
        {pending ? "Moving..." : "Reassign"}
      </button>
      {message ? (
        <span className="text-sm text-muted-foreground">{message}</span>
      ) : null}
    </form>
  );
}
