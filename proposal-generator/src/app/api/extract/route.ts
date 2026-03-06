import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Supported URL patterns
const SUPPORTED_DOMAINS = [
  "commonsku.com",
  "fourthwall.com",
];

function isValidProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SUPPORTED_DOMAINS.some((domain) => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

function detectSource(url: string): "commonsku" | "fourthwall" | "unknown" {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("commonsku.com")) return "commonsku";
    if (parsed.hostname.endsWith("fourthwall.com")) return "fourthwall";
  } catch {
    // fall through
  }
  return "unknown";
}

function buildPrompt(html: string, source: "commonsku" | "fourthwall" | "unknown"): string {
  const baseSchema = `Return ONLY valid JSON (no markdown, no code fences) with this exact structure:

{
  "products": [
    {
      "name": "Product Name",
      "subtitle": "Brand Model - SKU",
      "printing": "Screen Print / Embroidered / etc",
      "colors": "Color1, Color2, Color3",
      "sizes": "S - 2XL",
      "size_note": "Sizes beyond XL: +$1.50 each",
      "description": "Full product description with all specs, materials, features",
      "pricing": [[quantity, "price"], [quantity, "price"]],
      "timeline": "Sample and bulk timeline info",
      "images": ["url1", "url2", "url3"]
    }
  ]
}`;

  if (source === "commonsku") {
    return `Extract ALL product information from this CommonSKU presentation HTML. ${baseSchema}

IMPORTANT:
- Extract EVERY image UUID from image src URLs (pattern: files.commonsku.com/large/UUID or files.commonsku.com/medium/UUID). For images, include the full UUID (these will be resolved later).
- This may be a present.php page, a shop page, or any other CommonSKU URL format — adapt extraction accordingly.
- Include the COMPLETE description with all fabric details, construction features, certifications.
- Pricing should be [quantity_number, "price_string"] pairs.
- Get ALL colors mentioned for each product.
- If timeline info exists, include sample and bulk production timelines.

HTML content:
${html}`;
  }

  if (source === "fourthwall") {
    return `Extract ALL product information from this Fourthwall product page HTML. ${baseSchema}

IMPORTANT:
- Extract ALL product image URLs (look for img tags, og:image meta tags, product gallery images, srcset attributes, and JSON-LD structured data).
- For images, include the full URL (https://...) as found in the HTML.
- Include the COMPLETE description with all specs, materials, features.
- Pricing: if only a single price is shown, return it as [[1, "price"]].
- Look for variant information (sizes, colors) in select dropdowns, radio buttons, or JavaScript data.
- Fourthwall pages may use Next.js or similar frameworks — check __NEXT_DATA__ or similar embedded JSON for product data.

HTML content:
${html}`;
  }

  // Unknown source — generic extraction
  return `Extract ALL product information from this product page HTML. ${baseSchema}

IMPORTANT:
- Extract ALL product image URLs found in the page (full URLs).
- Include the COMPLETE description with all specs, materials, features.
- Pricing should be [quantity_number, "price_string"] pairs. If only one price, use [[1, "price"]].
- Get ALL colors/variants mentioned.
- Look for structured data (JSON-LD, Open Graph tags) for additional product info.

HTML content:
${html}`;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !isValidProductUrl(url)) {
      return NextResponse.json(
        { error: "Please provide a valid CommonSKU or Fourthwall product URL" },
        { status: 400 }
      );
    }

    const source = detectSource(url);

    // Fetch the product/presentation page
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch page" }, { status: 502 });
    }
    const html = await res.text();

    const prompt = buildPrompt(html, source);

    // Use Claude to intelligently extract all product data
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON response
    let data;
    try {
      // Try direct parse first
      data = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
      }
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Extract error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
