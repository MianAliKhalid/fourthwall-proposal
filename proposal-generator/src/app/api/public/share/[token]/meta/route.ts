import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ token: string }> }

// GET /api/public/share/[token]/meta - Returns share link metadata (no PDF, no auth)
// Used by the public share page to check if a link is valid before rendering the PDF iframe
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params

    if (!token || token.length < 10 || token.length > 100) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      select: {
        isActive: true,
        expiresAt: true,
        document: {
          select: {
            title: true,
            clientName: true,
            isActive: true,
            pdfUrl: true,
            productsJson: true,
          },
        },
      },
    })

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found.' }, { status: 404 })
    }

    if (!shareLink.isActive) {
      return NextResponse.json({ error: 'This share link has been disabled.' }, { status: 410 })
    }

    if (shareLink.expiresAt && shareLink.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'This share link has expired.' }, { status: 410 })
    }

    if (!shareLink.document.isActive) {
      return NextResponse.json({ error: 'This document is no longer available.' }, { status: 410 })
    }

    const products = shareLink.document.productsJson as unknown[]
    if (!shareLink.document.pdfUrl && (!products || !Array.isArray(products) || products.length === 0)) {
      return NextResponse.json({ error: 'PDF not available for this document.' }, { status: 404 })
    }

    // Return only safe metadata - no internal IDs
    return NextResponse.json({
      title: shareLink.document.title,
      clientName: shareLink.document.clientName,
    })
  } catch (error) {
    console.error('Public share meta error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
