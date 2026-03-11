import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Keep warn only to avoid noisy transient connection error spam in dev logs.
    log: ["warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
