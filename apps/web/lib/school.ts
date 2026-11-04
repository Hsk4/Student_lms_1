/**
 * Single-school identity.
 *
 * The brand kit ships `[SCHOOL NAME]` placeholders in its mockups. Every place
 * the product names the school reads this constant instead, so a deployment
 * renames the school once (`NEXT_PUBLIC_SCHOOL_NAME`) rather than hunting for
 * hardcoded strings.
 */
export const SCHOOL_NAME =
  process.env.NEXT_PUBLIC_SCHOOL_NAME?.trim() || "Fastly LMS";

/** Public product name — the platform, not the school. */
export const PRODUCT_NAME = "Fastly";

/** How the school office is addressed in copy (gate pages, empty states). */
export const SCHOOL_OFFICE = `the ${SCHOOL_NAME} office`;
