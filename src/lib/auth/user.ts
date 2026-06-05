import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: { email: email.toLowerCase().trim(), passwordHash, name },
  });
}

export async function verifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserWithSetup(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { xCredential: true, telegramSetup: true, userSettings: true },
  });
}

export function isSubscriptionActive(status: string) {
  return ["trialing", "active"].includes(status);
}
