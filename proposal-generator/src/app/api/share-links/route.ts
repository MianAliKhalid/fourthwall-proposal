import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

// GET /api/share-links - List share links
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active' | 'disabled' | 'expired' | null (all)

    const where: Record<string, unknown> = {
      createdById: session.role === 'ADMIN' ? undefined : session.userId,
    }

    if (session.role === 'ADMIN') {
      delete where.createdById
    }

    if (status === 'active') {
      where.isActive = true
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ]
    } else if (status === 'disabled') {
      where.isActive = false
    } else if (status === 'expired') {
      where.isActive = true
      where.expiresAt = { lte: new Date() }
    }

    const shareLinks = await prisma.shareLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        document: { select: { id: true, title: true, clientName: true, isActive: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    })

    // Compute effective status for each link
    const now = new Date()
    const enriched = shareLinks.map((link) => {
      let effectiveStatus: 'active' | 'disabled' | 'expired' = 'active'
      if (!link.isActive) {
        effectiveStatus = 'disabled'
      } else if (link.expiresAt && link.expiresAt <= now) {
        effectiveStatus = 'expired'
      }
      return { ...link, effectiveStatus }
    })

    return NextResponse.json({ shareLinks: enriched })
  } catch (error) {
    console.error('List share links error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// POST /api/share-links - Create share link
const createShareLinkSchema = z.object({
  documentId: z.string().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createShareLinkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: parsed.data.documentId,
        isActive: true,
        ...(session.role !== 'ADMIN' ? { createdById: session.userId } : {}),
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const token = crypto.randomUUID()

    const shareLink = await prisma.shareLink.create({
      data: {
        token,
        documentId: parsed.data.documentId,
        createdById: session.userId,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
      include: {
        document: { select: { id: true, title: true, clientName: true } },
      },
    })

    await createAuditLog(
      session.userId,
      'SHARE_LINK_CREATED',
      'ShareLink',
      shareLink.id,
      { documentId: parsed.data.documentId, token }
    )

    return NextResponse.json({ shareLink }, { status: 201 })
  } catch (error) {
    console.error('Create share link error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
