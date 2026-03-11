import { prisma } from "@/lib/prisma";

function isRetryablePrismaError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("connectorerror") ||
    (message.includes("connection") && message.includes("closed")) ||
    message.includes("kind: closed") ||
    message.includes("pool timed out") ||
    message.includes("server closed the connection") ||
    message.includes("p1001") ||
    message.includes("p1017")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withPrismaRetry<T>(
  run: () => Promise<T>,
  retries = 6,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (retries > 0 && isRetryablePrismaError(error)) {
      const attempt = 7 - retries;
      // Force a reconnect before retrying when Neon/pg connection is closed.
      try {
        await prisma.$disconnect();
      } catch {
        // ignore disconnect failures
      }
      try {
        await prisma.$connect();
      } catch {
        // connect may still fail; retry loop will handle it
      }
      const delay = Math.min(2000, 250 * attempt * attempt);
      await sleep(delay);
      return withPrismaRetry(run, retries - 1);
    }
    throw error;
  }
}
