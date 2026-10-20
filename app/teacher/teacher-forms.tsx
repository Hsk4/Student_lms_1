'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClass, decideEnrollment } from '@/actions/enrollment';

type ClassOption = { id: string; name: string; courseLabel: string };
type CourseOption = { id: string; label: string };

export function DecisionForm({ enrollmentId, classes }: { enrollmentId: string; classes: ClassOption[] }) {
  const router = useRouter();
  const [classId, setClassId] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function decide(decision: 'accept' | 'decline') {
    setPending(true);
    setMessage(null);
    try {
      const result = await decideEnrollment({ enrollmentId, decision, classId: classId || undefined });
      if (result.ok) {
        setMessage(decision === 'accept' ? 'Accepted.' : 'Declined.');
        router.refresh();
      } else {
        setMessage(result.message ?? 'Could not decide');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label" htmlFor={`class-${enrollmentId}`}>Class</label>
        <select id={`class-${enrollmentId}`} className="input w-56" value={classId} onChange={(event) => setClassId(event.target.value)}>
          <option value="">One-on-one</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>{item.name} - {item.courseLabel}</option>
          ))}
        </select>
      </div>
      <button type="button" className="btn-primary" disabled={pending} onClick={() => decide('accept')}>Accept</button>
      <button type="button" className="btn-danger" disabled={pending} onClick={() => decide('decline')}>Decline</button>
      {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
    </div>
  );
}

export function ClassForm({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage(null);
        try {
          const result = await createClass({
            courseId: form.get('courseId'),
            name: form.get('name'),
            schedule: form.get('schedule') ?? '',
          });
          if (result.ok) {
            setMessage('Class created.');
            router.refresh();
          } else {
            setMessage(result.message ?? 'Could not create class');
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="className">Name</label>
        <input id="className" name="name" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="courseId">Course</label>
        <select id="courseId" name="courseId" className="input" required defaultValue="">
          <option value="" disabled>Choose a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="schedule">Schedule</label>
        <input id="schedule" name="schedule" className="input" placeholder="Tue/Thu 6pm" />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Creating...' : 'Create class'}
      </button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
