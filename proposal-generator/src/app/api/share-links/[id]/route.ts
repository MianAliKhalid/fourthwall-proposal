import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/share-links/[id] - Enable/disable share link
const updateShareLinkSchema = z.object({
  isActive: z.boolean(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const parsed = updateShareLinkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    const existing = await prisma.shareLink.findFirst({
      where: {
        id,
        ...(session.role !== 'ADMIN' ? { createdById: session.userId } : {}),
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    const shareLink = await prisma.shareLink.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
      include: {
        document: { select: { id: true, title: true, clientName: true } },
      },
    })

    await createAuditLog(
      session.userId,
      parsed.data.isActive ? 'SHARE_LINK_ENABLED' : 'SHARE_LINK_DISABLED',
      'ShareLink',
      id,
      { documentId: shareLink.documentId }
    )

    return NextResponse.json({ shareLink })
  } catch (error) {
    console.error('Update share link error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// DELETE /api/share-links/[id] - Delete share link
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params

    const existing = await prisma.shareLink.findFirst({
      where: {
        id,
        ...(session.role !== 'ADMIN' ? { createdById: session.userId } : {}),
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    await prisma.shareLink.delete({ where: { id } })

    await createAuditLog(
      session.userId,
      'SHARE_LINK_DELETED',
      'ShareLink',
      id,
      { documentId: existing.documentId, token: existing.token }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete share link error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
