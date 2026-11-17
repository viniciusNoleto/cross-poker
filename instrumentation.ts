// Runs once when the Next.js server starts. Only the Node.js runtime has the DB pool and the
// in-memory pub/sub, so the inactivity sweeper is started there (see libs/staleGames.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { startStaleGameSweeper } = await import('./libs/staleGames');

  startStaleGameSweeper();
}
