import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generatePdfBuffer } from "@/lib/pdf-server";
import crypto from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify ownership or admin
    const where: Record<string, unknown> = { id, isActive: true };
    if (session.role !== "ADMIN") {
      where.createdById = session.userId;
    }

    const document = await prisma.document.findFirst({ where });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const products = (document.productsJson as unknown[]) || [];
    const clientName = document.clientName || "Client";
    const clientTagline = document.clientTagline || "";

    const pdfBuffer = await generatePdfBuffer({
      products: products as Parameters<typeof generatePdfBuffer>[0]["products"],
      clientName,
      clientTagline,
    });

    // Generate ETag from content hash
    const hash = crypto.createHash("md5").update(pdfBuffer).digest("hex");
    const etag = `"${hash}"`;

    // Check If-None-Match header
    const ifNoneMatch = _request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposal-${id}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        ETag: etag,
        "Last-Modified": document.updatedAt.toUTCString(),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("PDF preview error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF preview" },
      { status: 500 }
    );
  }
}
