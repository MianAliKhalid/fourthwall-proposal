import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/folders/[id] - Rename folder
const renameFolderSchema = z.object({
  name: z.string().min(1).max(255).trim(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const parsed = renameFolderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    const existing = await prisma.folder.findFirst({
      where: { id, userId: session.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Check for duplicate name at same level
    const duplicate = await prisma.folder.findFirst({
      where: {
        userId: session.userId,
        name: parsed.data.name,
        parentId: existing.parentId,
        id: { not: id },
      },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'A folder with this name already exists at this level' },
        { status: 409 }
      )
    }

    const folder = await prisma.folder.update({
      where: { id },
      data: { name: parsed.data.name },
      include: {
        _count: { select: { documents: { where: { isActive: true } } } },
      },
    })

    await createAuditLog(
      session.userId,
      'FOLDER_RENAMED',
      'Folder',
      id,
      { oldName: existing.name, newName: parsed.data.name }
    )

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('Rename folder error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// DELETE /api/folders/[id] - Delete folder (moves docs to no folder)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id } = await context.params

    const existing = await prisma.folder.findFirst({
      where: { id, userId: session.userId },
      include: {
        children: { select: { id: true } },
        _count: { select: { documents: { where: { isActive: true } } } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Don't delete if it has child folders
    if (existing.children.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a folder that contains sub-folders. Please remove or move sub-folders first.' },
        { status: 400 }
      )
    }

    // Move documents to no folder, then delete the folder
    await prisma.$transaction([
      prisma.document.updateMany({
        where: { folderId: id },
        data: { folderId: null },
      }),
      prisma.folder.delete({
        where: { id },
      }),
    ])

    await createAuditLog(
      session.userId,
      'FOLDER_DELETED',
      'Folder',
      id,
      { name: existing.name, documentsOrphaned: existing._count.documents }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete folder error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
