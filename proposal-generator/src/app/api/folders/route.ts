import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

// GET /api/folders - List folders as tree structure
export async function GET() {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const folders = await prisma.folder.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { documents: { where: { isActive: true } } } },
      },
    })

    // Build tree structure
    type FolderNode = (typeof folders)[number] & { children: FolderNode[] }
    const folderMap = new Map<string, FolderNode>()
    const roots: FolderNode[] = []

    // First pass: create nodes
    for (const folder of folders) {
      folderMap.set(folder.id, { ...folder, children: [] })
    }

    // Second pass: build tree
    for (const folder of folders) {
      const node = folderMap.get(folder.id)!
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return NextResponse.json({ folders: roots, flatFolders: folders })
  } catch (error) {
    console.error('List folders error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// POST /api/folders - Create folder
const createFolderSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  parentId: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    const { name, parentId } = parsed.data

    // Verify parent folder belongs to user if provided
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, userId: session.userId },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
      }
    }

    // Check for duplicate name at same level
    const existing = await prisma.folder.findFirst({
      where: {
        userId: session.userId,
        name,
        parentId: parentId || null,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A folder with this name already exists at this level' },
        { status: 409 }
      )
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        userId: session.userId,
      },
      include: {
        _count: { select: { documents: { where: { isActive: true } } } },
      },
    })

    await createAuditLog(
      session.userId,
      'FOLDER_CREATED',
      'Folder',
      folder.id,
      { name, parentId }
    )

    return NextResponse.json({ folder }, { status: 201 })
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
