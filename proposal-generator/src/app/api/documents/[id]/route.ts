import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/documents/[id] - Get single document
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params

    const where: Record<string, unknown> = { id, isActive: true }
    if (session.role !== 'ADMIN') {
      where.createdById = session.userId
    }

    const document = await prisma.document.findFirst({
      where,
      include: {
        folder: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
        shareLinks: {
          select: {
            id: true,
            token: true,
            isActive: true,
            expiresAt: true,
            accessCount: true,
            createdAt: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// PATCH /api/documents/[id] - Update document
const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  clientName: z.string().min(1).max(500).optional(),
  clientTagline: z.string().max(500).optional().nullable(),
  productsJson: z.unknown().optional(),
  pdfUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  folderId: z.string().optional().nullable(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const parsed = updateDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    // Check ownership
    const existing = await prisma.document.findFirst({
      where: {
        id,
        isActive: true,
        ...(session.role !== 'ADMIN' ? { createdById: session.userId } : {}),
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify folder belongs to user if changing folder
    if (parsed.data.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: parsed.data.folderId, userId: session.userId },
      })
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.clientName !== undefined) updateData.clientName = parsed.data.clientName
    if (parsed.data.clientTagline !== undefined) updateData.clientTagline = parsed.data.clientTagline
    if (parsed.data.productsJson !== undefined) updateData.productsJson = parsed.data.productsJson
    if (parsed.data.pdfUrl !== undefined) updateData.pdfUrl = parsed.data.pdfUrl
    if (parsed.data.thumbnailUrl !== undefined) updateData.thumbnailUrl = parsed.data.thumbnailUrl
    if ('folderId' in parsed.data) updateData.folderId = parsed.data.folderId

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        folder: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    })

    await createAuditLog(
      session.userId,
      'DOCUMENT_UPDATED',
      'Document',
      id,
      { changes: Object.keys(parsed.data) }
    )

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// DELETE /api/documents/[id] - Soft delete document
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params

    const existing = await prisma.document.findFirst({
      where: {
        id,
        isActive: true,
        ...(session.role !== 'ADMIN' ? { createdById: session.userId } : {}),
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Soft delete - also deactivate share links
    await prisma.$transaction([
      prisma.document.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.shareLink.updateMany({
        where: { documentId: id },
        data: { isActive: false },
      }),
    ])

    await createAuditLog(
      session.userId,
      'DOCUMENT_DELETED',
      'Document',
      id,
      { title: existing.title }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
