import postgres from "postgres";

async function probe(label: string, url: string | undefined) {
  if (!url) {
    console.log(label, "-> missing");
    return;
  }
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 25 });
  try {
    const rows = await sql`select count(*)::int as n from "users"`;
    console.log(label, "-> ok, users:", rows[0].n);
  } catch (e) {
    console.log(label, "-> ERR:", (e as Error).message);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function main() {
  await probe("pooled  ", process.env.DATABASE_URL);
  await probe("unpooled", process.env.DATABASE_URL_UNPOOLED);
}

void main();
