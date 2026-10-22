import mongoose, { Schema, Document } from "mongoose";

export interface IAttendanceRecord {
  studentId: Schema.Types.ObjectId;
  present: boolean;
}

export interface IAttendance extends Document {
  classId?: Schema.Types.ObjectId | null;
  enrollmentId?: Schema.Types.ObjectId | null;
  date: Date;
  records: IAttendanceRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      default: null,
      index: true,
    },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
      index: true,
    },
    date: { type: Date, required: true },
    records: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        present: { type: Boolean, required: true },
      },
    ],
  },
  { timestamps: true },
);

attendanceSchema.pre("validate", function validateTarget() {
  if (Boolean(this.classId) === Boolean(this.enrollmentId)) {
    throw new Error("Attendance needs exactly one of classId or enrollmentId");
  }
});

export const Attendance =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>("Attendance", attendanceSchema);
