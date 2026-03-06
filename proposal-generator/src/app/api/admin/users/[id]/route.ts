import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/admin/users/[id] - Get user detail with recent activity
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    const user = await prisma.user.findUnique({
      where: { id },
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
            chatMessages: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch recent audit logs for this user
    const recentLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        details: true,
        ipAddress: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user, recentLogs })
  } catch (error) {
    console.error('Admin get user error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}

// PATCH /api/admin/users/[id] - Update user status/role
const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  displayName: z.string().min(1).max(200).optional(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    // Prevent admin from modifying themselves in dangerous ways
    if (id === session.userId) {
      const body = await request.json()
      if (body.isActive === false) {
        return NextResponse.json(
          { error: 'You cannot disable your own account.' },
          { status: 400 }
        )
      }
      if (body.role === 'USER') {
        return NextResponse.json(
          { error: 'You cannot demote your own account.' },
          { status: 400 }
        )
      }
      // Re-parse after consuming body
      const parsed = updateUserSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: z.flattenError(parsed.error) },
          { status: 400 }
        )
      }

      const data: Record<string, unknown> = {}
      if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      await createAuditLog(
        session.userId,
        'ADMIN_USER_UPDATED',
        'User',
        id,
        { changes: data }
      )

      return NextResponse.json({ user })
    }

    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive
    if (parsed.data.role !== undefined) data.role = parsed.data.role
    if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await createAuditLog(
      session.userId,
      'ADMIN_USER_UPDATED',
      'User',
      id,
      {
        changes: data,
        previousValues: {
          isActive: existing.isActive,
          role: existing.role,
          displayName: existing.displayName,
        },
      }
    )

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Admin update user error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
