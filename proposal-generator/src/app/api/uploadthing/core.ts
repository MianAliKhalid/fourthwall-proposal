import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hashFileName } from "@/lib/security";

const f = createUploadthing();

async function authMiddleware() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    throw new Error("Unauthorized: You must be logged in to upload files.");
  }

  return { userId: session.userId, username: session.username };
}

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const auth = await authMiddleware();
      return auth;
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const hashedName = hashFileName(file.name);

      // Log to audit log
      await prisma.auditLog.create({
        data: {
          userId: metadata.userId,
          action: "UPLOAD",
          resourceType: "pdf",
          resourceId: file.key,
          details: {
            originalName: file.name,
            hashedName,
            size: file.size,
            url: file.url,
          },
        },
      });

      return { url: file.url, key: file.key };
    }),
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .middleware(async () => {
      const auth = await authMiddleware();
      return auth;
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const hashedName = hashFileName(file.name);

      // Log to audit log
      await prisma.auditLog.create({
        data: {
          userId: metadata.userId,
          action: "UPLOAD",
          resourceType: "image",
          resourceId: file.key,
          details: {
            originalName: file.name,
            hashedName,
            size: file.size,
            url: file.url,
          },
        },
      });

      return { url: file.url, key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
