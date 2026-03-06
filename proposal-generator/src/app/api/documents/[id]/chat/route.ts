import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

type RouteContext = { params: Promise<{ id: string }> };

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a helpful assistant that modifies merchandise proposal documents.
The user will ask you to make changes to their proposal.
You have access to the current document data as JSON.
When the user asks for changes, return a JSON response with:
{
  "message": "Human-readable description of what you changed",
  "updates": {
    // Only include fields that changed
    "clientName": "New Name",  // if changing client name
    "clientTagline": "New Tagline",  // if changing tagline
    "products": [...] // if changing product data, include the FULL updated products array
  }
}
Always return valid JSON. Only modify what the user asks for.
If the user asks a question that doesn't require changes, return:
{
  "message": "Your helpful response here",
  "updates": {}
}`;

export async function POST(request: NextRequest, context: RouteContext) {
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

    const body = await request.json();
    const userMessage = body.message;

    if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build current document context
    const documentContext = {
      clientName: document.clientName,
      clientTagline: document.clientTagline || "",
      products: document.productsJson || [],
    };

    // Get recent chat history for context (last 10 messages)
    const recentMessages = await prisma.chatMessage.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Build conversation history for Claude (oldest first)
    const conversationHistory: { role: "user" | "assistant"; content: string }[] =
      recentMessages.reverse().map((msg) => ({
        role: msg.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      }));

    // Add the new user message
    conversationHistory.push({
      role: "user",
      content: `Current document data:\n${JSON.stringify(documentContext, null, 2)}\n\nUser request: ${userMessage.trim()}`,
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
    });

    const assistantContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse Claude's response
    let parsedResponse: {
      message: string;
      updates: Record<string, unknown>;
    };

    try {
      // Try to extract JSON from the response (Claude might wrap it in markdown code blocks)
      let jsonStr = assistantContent;
      const jsonMatch = assistantContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      parsedResponse = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, treat the whole response as a message with no updates
      parsedResponse = {
        message: assistantContent,
        updates: {},
      };
    }

    // Apply updates to document if any
    const updates = parsedResponse.updates || {};
    const hasUpdates = Object.keys(updates).length > 0;

    if (hasUpdates) {
      const updateData: Record<string, unknown> = {};

      if (updates.clientName !== undefined) {
        updateData.clientName = updates.clientName;
      }
      if (updates.clientTagline !== undefined) {
        updateData.clientTagline = updates.clientTagline;
      }
      if (updates.products !== undefined) {
        updateData.productsJson = updates.products;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.document.update({
          where: { id },
          data: updateData,
        });
      }
    }

    // Save both messages to the database
    await prisma.chatMessage.createMany({
      data: [
        {
          documentId: id,
          userId: session.userId,
          role: "USER",
          content: userMessage.trim(),
        },
        {
          documentId: id,
          userId: session.userId,
          role: "ASSISTANT",
          content: parsedResponse.message,
          metadata: hasUpdates
            ? JSON.stringify({ updates: Object.keys(updates) })
            : undefined,
        },
      ],
    });

    // Return response
    return NextResponse.json({
      message: parsedResponse.message,
      updates: hasUpdates ? updates : null,
      document: hasUpdates
        ? {
            clientName:
              (updates.clientName as string) ?? document.clientName,
            clientTagline:
              (updates.clientTagline as string) ?? document.clientTagline,
            productsJson: updates.products ?? document.productsJson,
          }
        : undefined,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

// GET handler returns chat history (paginated)
export async function GET(request: NextRequest, context: RouteContext) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { documentId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatMessage.count({ where: { documentId: id } }),
    ]);

    return NextResponse.json({
      messages: messages.reverse(), // return oldest first for display
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Chat history error:", error);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}
