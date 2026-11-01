import type { UserRole, UserStatus } from "./roles";

/**
 * Response payload types shared by the API and the web client.
 *
 * These describe what crosses the wire: dates are ISO-8601 strings (UTC), money
 * is whole PKR integers, ids are the Postgres uuids as strings.
 */

export type Id = string;

/** `GET /api/v1/me` */
export type MeResponse = {
  id: Id;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole | null;
  status: UserStatus;
  onboarded: boolean;
  rejectedAt: string | null;
  rejectionReason: string | null;
  /** Where the account may land, from `homeFor`. */
  home: string;
  /** Open access requests, for the admin nav badge. */
  pendingRequests: number;
};

export type CatalogOption = { id: Id; label: string };

export type RequestStatusResponse = {
  status: UserStatus;
  role: UserRole | null;
  rejectionReason: string | null;
  rejectedAt: string | null;
  hasOpenRequest: boolean;
  requestedRole: string | null;
};
