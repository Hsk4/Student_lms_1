import type { Response } from "express";

/** The only shape a successful handler writes: `{ ok: true, data }`. */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}
