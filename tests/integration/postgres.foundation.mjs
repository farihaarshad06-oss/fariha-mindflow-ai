// Phase 2 integration test foundation.
//
// Real integration tests will spin up a PostgreSQL + pgvector container via
// @testcontainers/postgresql, run Prisma migrations, seed demo data and
// exercise the API end-to-end. This foundation documents the intended flow
// and runs as a no-op when the dependencies/Docker are not available.

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log(
      '[integration] Skipping: set DATABASE_URL (and have Docker + @testcontainers/postgresql available) to run integration tests.',
    );
    process.exit(0);
  }

  try {
    const pg = await import('pg');
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const result = await client.query('select 1 as ok');
    await client.end();
    if (result.rows[0]?.ok === 1) {
      console.log('[integration] PostgreSQL reachable.');
      process.exit(0);
    }
    process.exit(1);
  } catch (error) {
    console.error('[integration] PostgreSQL unreachable:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
