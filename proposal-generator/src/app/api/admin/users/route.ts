import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

// GET /api/admin/users - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || ''
    const statusFilter = searchParams.get('status') || '' // 'active' | 'disabled' | ''

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (roleFilter === 'ADMIN' || roleFilter === 'USER') {
      where.role = roleFilter
    }

    if (statusFilter === 'active') {
      where.isActive = true
    } else if (statusFilter === 'disabled') {
      where.isActive = false
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            documents: true,
            shareLinks: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin list users error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// PATCH /api/admin/users - Bulk update (reserved for future use)
const bulkUpdateSchema = z.object({
  userIds: z.array(z.string().min(1)),
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = bulkUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    const { userIds, isActive, role } = parsed.data

    // Prevent admin from disabling themselves
    if (isActive === false && userIds.includes(session.userId)) {
      return NextResponse.json(
        { error: 'You cannot disable your own account.' },
        { status: 400 }
      )
    }

    // Prevent admin from demoting themselves
    if (role === 'USER' && userIds.includes(session.userId)) {
      return NextResponse.json(
        { error: 'You cannot demote your own account.' },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    if (isActive !== undefined) data.isActive = isActive
    if (role !== undefined) data.role = role

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data,
    })

    await createAuditLog(
      session.userId,
      'ADMIN_BULK_USER_UPDATE',
      'User',
      undefined,
      { userIds, changes: data }
    )

    return NextResponse.json({ success: true, updatedCount: userIds.length })
  } catch (error) {
    console.error('Admin bulk update users error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
