import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePdfBuffer } from '@/lib/pdf-server'

type RouteContext = { params: Promise<{ token: string }> }

// Simple in-memory rate limiter for public share access
const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 30 // max requests per window per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(ip)

  // Clean up stale entries periodically
  if (rateLimit.size > 10000) {
    for (const [key, val] of rateLimit) {
      if (val.resetAt < now) rateLimit.delete(key)
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

// GET /api/public/share/[token] - Returns PDF binary for the shared document
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params

    // Validate token format (UUID)
    if (!token || token.length < 10 || token.length > 100) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Find share link by token
    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            clientName: true,
            clientTagline: true,
            pdfUrl: true,
            productsJson: true,
            isActive: true,
          },
        },
      },
    })

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    // Check if link is active
    if (!shareLink.isActive) {
      return NextResponse.json({ error: 'This share link has been disabled.' }, { status: 410 })
    }

    // Check if link has expired
    if (shareLink.expiresAt && shareLink.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'This share link has expired.' }, { status: 410 })
    }

    // Check if document is active
    if (!shareLink.document.isActive) {
      return NextResponse.json({ error: 'This document is no longer available.' }, { status: 410 })
    }

    // Check if document has content
    const products = shareLink.document.productsJson as unknown[]
    if ((!products || !Array.isArray(products) || products.length === 0) && !shareLink.document.pdfUrl) {
      return NextResponse.json({ error: 'PDF not available for this document.' }, { status: 404 })
    }

    // Increment access count
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { accessCount: { increment: 1 } },
    })

    // Log access (no userId since this is public)
    const userAgent = request.headers.get('user-agent') || undefined
    try {
      await prisma.auditLog.create({
        data: {
          userId: null,
          action: 'SHARE_LINK_ACCESSED',
          resourceType: 'ShareLink',
          resourceId: shareLink.id,
          details: JSON.stringify({
            token,
            documentId: shareLink.document.id,
            documentTitle: shareLink.document.title,
          }),
          ipAddress: ip,
          userAgent,
        },
      })
    } catch {
      // Don't fail the request if audit logging fails
    }

    let pdfBuffer: ArrayBuffer

    if (shareLink.document.pdfUrl) {
      // Fetch from stored URL
      const pdfResponse = await fetch(shareLink.document.pdfUrl)
      if (!pdfResponse.ok) {
        return NextResponse.json({ error: 'Failed to retrieve PDF.' }, { status: 502 })
      }
      pdfBuffer = await pdfResponse.arrayBuffer()
    } else {
      // Generate PDF on the fly from productsJson
      const buffer = await generatePdfBuffer({
        products: products as Parameters<typeof generatePdfBuffer>[0]['products'],
        clientName: shareLink.document.clientName,
        clientTagline: shareLink.document.clientTagline || '',
      })
      pdfBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }

    const filename = `${shareLink.document.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Public share PDF error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
