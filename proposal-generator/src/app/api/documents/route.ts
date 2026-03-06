import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

// GET /api/documents - List documents with pagination, search, folder filter
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const search = searchParams.get('search') || ''
    const folderId = searchParams.get('folderId') || undefined
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const validSortFields = ['createdAt', 'title', 'clientName', 'updatedAt']
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'

    const where: Record<string, unknown> = {
      createdById: session.role === 'ADMIN' ? undefined : session.userId,
      isActive: true,
    }

    // Remove undefined createdById for admin
    if (session.role === 'ADMIN') {
      delete where.createdById
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (folderId === 'null') {
      where.folderId = null
    } else if (folderId) {
      where.folderId = folderId
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          folder: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, displayName: true } },
          shareLinks: { where: { isActive: true }, select: { id: true } },
        },
      }),
      prisma.document.count({ where }),
    ])

    return NextResponse.json({
      documents: documents.map((doc) => ({
        ...doc,
        activeShareLinks: doc.shareLinks.length,
        shareLinks: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// POST /api/documents - Create new document
const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  clientName: z.string().min(1).max(500),
  clientTagline: z.string().max(500).optional(),
  productsJson: z.unknown().optional(),
  pdfUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  folderId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    const { title, clientName, clientTagline, productsJson, pdfUrl, thumbnailUrl, folderId } = parsed.data

    // Verify folder belongs to user if provided
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.userId },
      })
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    const document = await prisma.document.create({
      data: {
        title,
        clientName,
        clientTagline: clientTagline || null,
        productsJson: productsJson || undefined,
        pdfUrl: pdfUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        createdById: session.userId,
        folderId: folderId || null,
      },
      include: {
        folder: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    })

    await createAuditLog(
      session.userId,
      'DOCUMENT_CREATED',
      'Document',
      document.id,
      { title, clientName }
    )

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
