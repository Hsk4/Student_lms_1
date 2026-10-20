"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reassignStudent } from "@/actions/enrollment-admin";

export function ReassignForm({
  enrollmentId,
  currentTeacherId,
  teachers,
}: {
  enrollmentId: string;
  currentTeacherId: string;
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
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
          const result = await reassignStudent({ enrollmentId, teacherId });
          if (result.ok) {
            setMessage("Reassigned.");
            router.refresh();
          } else {
            setMessage(result.message ?? "Could not reassign");
          }
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
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Moving..." : "Reassign"}
      </button>
      {message ? (
        <span className="text-sm text-muted-foreground">{message}</span>
      ) : null}
    </form>
  );
}
