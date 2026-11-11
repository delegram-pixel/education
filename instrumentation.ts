/**
 * Next.js calls `register` once per server process, before it serves a request.
 *
 * This is the only place the environment is validated eagerly. Doing it here
 * means a malformed URL or budget value stops the deployment with the variable
 * named, instead of surfacing later as a fallback that hides a real problem.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { assertEnv } = await import('./lib/env')
  assertEnv()
}
