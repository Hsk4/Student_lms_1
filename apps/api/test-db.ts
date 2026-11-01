import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error("DATABASE_URL is missing");
}

const sql = postgres(url, {
  ssl: "require",
  connect_timeout: 15,
  max: 1,
});

try {
  const result = await sql`SELECT version()`;
  console.log("Database connection successful!");
  console.log(result);
} catch (error) {
  console.error("Database connection failed:", error);
} finally {
  await sql.end();
}