import jsPDF from "jspdf";

interface Product {
  name: string;
  subtitle: string;
  printing: string;
  colors: string;
  sizes: string;
  size_note: string;
  description: string;
  pricing: [number, string][];
  timeline: string;
  images: string[];
}

export interface PdfInput {
  products: Product[];
  clientName: string;
  clientTagline: string;
  imageData?: Record<string, string>;
}

const PURPLE = [147, 51, 234] as const;
const PURPLE_DARK = [107, 33, 168] as const;
const WHITE = [255, 255, 255] as const;
const BLACK = [30, 30, 30] as const;
const GRAY = [107, 114, 128] as const;
const GRAY_LIGHT = [243, 244, 246] as const;

const PAGE_W = 210;
const MARGIN = 10;
const CONTENT_W = PAGE_W - MARGIN * 2;

function buildPdf(input: PdfInput): jsPDF {
  const { products, clientName, clientTagline, imageData = {} } = input;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  const totalPages = 1 + products.length;
  let currentPage = 0;

  function addHeader() {
    pdf.setFillColor(...PURPLE);
    pdf.rect(0, 0, PAGE_W, 10, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...WHITE);
    pdf.text(
      `PLUCKY REACH  |  pluckyreach.com  |  Custom Merch Proposal for ${clientName}`,
      PAGE_W / 2,
      6,
      { align: "center" }
    );
  }

  function addFooter(pageNum: number) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...GRAY);
    pdf.text("Plucky Reach  |  pluckyreach.com", MARGIN, 290);
    pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, 290, {
      align: "right",
    });
  }

  // ── COVER PAGE ──
  pdf.setFillColor(...PURPLE);
  pdf.rect(0, 0, PAGE_W, 120, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(36);
  pdf.setTextColor(...WHITE);
  pdf.text("PLUCKY REACH", PAGE_W / 2, 48, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(233, 213, 255);
  pdf.text("pluckyreach.com", PAGE_W / 2, 58, { align: "center" });

  pdf.setDrawColor(...WHITE);
  pdf.setLineWidth(0.5);
  pdf.line(75, 68, 135, 68);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...WHITE);
  pdf.text("MERCHANDISE PROPOSAL", PAGE_W / 2, 82, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...GRAY);
  pdf.text("Prepared exclusively for", PAGE_W / 2, 140, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  pdf.setTextColor(...BLACK);
  pdf.text(clientName, PAGE_W / 2, 155, { align: "center" });

  if (clientTagline) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...GRAY);
    pdf.text(clientTagline, PAGE_W / 2, 165, { align: "center" });
  }

  pdf.setDrawColor(...PURPLE);
  pdf.setLineWidth(0.6);
  pdf.line(85, 175, 125, 175);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...GRAY);
  pdf.text(
    "Contact: hello@pluckyreach.com  |  +1 (323) 870-1005  |  Los Angeles, CA",
    PAGE_W / 2,
    188,
    { align: "center" }
  );

  // ── PRODUCT PAGES ──
  for (const product of products) {
    pdf.addPage();
    currentPage++;
    addHeader();
    addFooter(currentPage);

    let y = 16;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...PURPLE_DARK);
    pdf.text(product.name, MARGIN, y);
    y += 6;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...GRAY);
    pdf.text(product.subtitle, MARGIN, y);
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...BLACK);
    pdf.text(
      `Printing: ${product.printing}  |  Sizes: ${product.sizes}  |  ${product.size_note}`,
      MARGIN,
      y
    );
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...GRAY);
    pdf.text(`Colors: ${product.colors}`, MARGIN, y);
    y += 7;

    // ── Image grid ──
    const images = product.images;
    const heroSize = 60;
    const heroGap = 8;
    const heroX = MARGIN + (CONTENT_W - heroSize * 2 - heroGap) / 2;

    for (let i = 0; i < Math.min(2, images.length); i++) {
      const imgSrc = imageData[images[i]];
      if (imgSrc) {
        try {
          pdf.addImage(imgSrc, "PNG", heroX + i * (heroSize + heroGap), y, heroSize, heroSize);
        } catch {
          // skip broken image
        }
      }
    }
    y += heroSize + 4;

    const remaining = images.slice(2);
    if (remaining.length > 0) {
      const cols = 4;
      const thumbGap = 4;
      const thumbSize = (CONTENT_W - (cols - 1) * thumbGap) / cols;

      for (let idx = 0; idx < remaining.length; idx++) {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const ix = MARGIN + col * (thumbSize + thumbGap);
        const iy = y + row * (thumbSize + thumbGap);

        if (iy + thumbSize > 220) break;

        const imgSrc = imageData[remaining[idx]];
        if (imgSrc) {
          try {
            pdf.addImage(imgSrc, "PNG", ix, iy, thumbSize, thumbSize);
          } catch {
            // skip broken image
          }
        }
      }

      const lastRow = Math.min(remaining.length - 1, 11);
      const thumbSize2 = (CONTENT_W - 3 * 4) / 4;
      y += (Math.floor(lastRow / cols) + 1) * (thumbSize2 + 4) + 2;
    }

    if (y > 240) y = 240;

    // ── Pricing table ──
    const pricing = product.pricing;
    const LABEL_COL_W = 18;
    const ROW_H = 7.5;
    const BORDER_W = 0.3;
    const MIN_COL_W = 14;

    const availableW = CONTENT_W - LABEL_COL_W;
    const rawDataColW = pricing.length > 0 ? availableW / pricing.length : availableW;
    const dataColW = Math.max(rawDataColW, MIN_COL_W);

    const totalTableW = LABEL_COL_W + dataColW * pricing.length;
    const tableOverflow = totalTableW > CONTENT_W;
    const tableFontSize = tableOverflow
      ? Math.max(5.5, 8 * (CONTENT_W / totalTableW))
      : 8;
    const priceFontSize = tableOverflow
      ? Math.max(6, 9 * (CONTENT_W / totalTableW))
      : 9;

    const finalDataColW = tableOverflow
      ? (CONTENT_W - LABEL_COL_W) / pricing.length
      : dataColW;
    const finalTableW = LABEL_COL_W + finalDataColW * pricing.length;

    const tableX = MARGIN + (CONTENT_W - finalTableW) / 2;

    // QTY row - purple bg, white text
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(tableFontSize);

    // QTY label cell
    pdf.setFillColor(...PURPLE_DARK);
    pdf.rect(tableX, y, LABEL_COL_W, ROW_H, "F");
    pdf.setTextColor(...WHITE);
    pdf.text("QTY", tableX + LABEL_COL_W / 2, y + ROW_H * 0.7, {
      align: "center",
    });

    // QTY data cells
    for (let i = 0; i < pricing.length; i++) {
      const x = tableX + LABEL_COL_W + i * finalDataColW;
      pdf.setFillColor(...PURPLE);
      pdf.rect(x, y, finalDataColW, ROW_H, "F");
      pdf.setTextColor(...WHITE);
      pdf.text(String(pricing[i][0]), x + finalDataColW / 2, y + ROW_H * 0.7, {
        align: "center",
      });
    }

    // PRICE row - light bg, dark text
    y += ROW_H;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(priceFontSize);

    // PRICE label cell
    pdf.setFillColor(...GRAY_LIGHT);
    pdf.rect(tableX, y, LABEL_COL_W, ROW_H, "F");
    pdf.setTextColor(...BLACK);
    pdf.text("PRICE", tableX + LABEL_COL_W / 2, y + ROW_H * 0.7, {
      align: "center",
    });

    // PRICE data cells
    for (let i = 0; i < pricing.length; i++) {
      const x = tableX + LABEL_COL_W + i * finalDataColW;
      pdf.setFillColor(...WHITE);
      pdf.rect(x, y, finalDataColW, ROW_H, "F");
      pdf.setTextColor(...PURPLE_DARK);
      pdf.text(`$${pricing[i][1]}`, x + finalDataColW / 2, y + ROW_H * 0.7, {
        align: "center",
      });
    }

    // Table borders
    pdf.setDrawColor(...PURPLE);
    pdf.setLineWidth(BORDER_W);
    pdf.rect(tableX, y - ROW_H, finalTableW, ROW_H * 2, "S");
    pdf.line(tableX, y, tableX + finalTableW, y);

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(BORDER_W);
    for (let i = 1; i <= pricing.length; i++) {
      const x = tableX + LABEL_COL_W + (i - 1) * finalDataColW;
      pdf.line(x, y - ROW_H, x, y + ROW_H);
    }
    pdf.line(tableX + LABEL_COL_W, y - ROW_H, tableX + LABEL_COL_W, y + ROW_H);

    // Description
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...GRAY);
    const descLines = pdf.splitTextToSize(product.description, CONTENT_W);
    pdf.text(descLines, MARGIN, y);
    y += descLines.length * 3.5 + 3;

    // Timeline
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(...PURPLE_DARK);
    pdf.text(`Timeline: ${product.timeline}`, MARGIN, y);
  }

  return pdf;
}

/**
 * Fetch all product images and convert to base64 data URIs.
 */
export async function fetchImageData(
  products: Product[]
): Promise<Record<string, string>> {
  const imageBase = "https://files.commonsku.com/large/";
  const allImageIds = new Set<string>();
  for (const p of products) {
    for (const id of p.images) {
      allImageIds.add(id);
    }
  }

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
  return imageData;
}

/**
 * Generate a PDF buffer from document data.
 * Optionally fetches images from CommonSKU if imageData is not provided.
 */
export async function generatePdfBuffer(input: PdfInput): Promise<Buffer> {
  let imageData = input.imageData;

  // If no pre-fetched image data, fetch it
  if (!imageData || Object.keys(imageData).length === 0) {
    imageData = await fetchImageData(input.products);
  }

  const pdf = buildPdf({ ...input, imageData });
  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
