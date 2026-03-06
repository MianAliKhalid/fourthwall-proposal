import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { products, clientName, clientTagline } = await req.json();

    // Return the data needed for client-side PDF generation
    // We proxy images and generate the PDF on the client with jsPDF
    // This route prepares image data as base64

    const imageBase = "https://files.commonsku.com/large/";
    const allImageIds = new Set<string>();
    for (const p of products) {
      for (const id of p.images) {
        allImageIds.add(id);
      }
    }

    // Download all images and convert to base64
    const imageData: Record<string, string> = {};
    const fetchPromises = Array.from(allImageIds).map(async (id) => {
      try {
        const res = await fetch(imageBase + id);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = res.headers.get("content-type") || "image/png";
          imageData[id] = `data:${contentType};base64,${base64}`;
        }
      } catch (e) {
        console.error(`Failed to fetch image ${id}:`, e);
      }
    });

    await Promise.all(fetchPromises);

    return NextResponse.json({
      products,
      clientName,
      clientTagline,
      imageData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
