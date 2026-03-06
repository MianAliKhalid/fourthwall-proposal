import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// GET /api/admin/logs - Paginated audit logs with filters (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn || !session.userId || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const userId = searchParams.get('userId') || ''
    const action = searchParams.get('action') || ''
    const resourceType = searchParams.get('resourceType') || ''
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const format = searchParams.get('format') || 'json' // 'json' | 'csv'

    const where: Record<string, unknown> = {}

    if (userId) {
      where.userId = userId
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' }
    }

    if (resourceType) {
      where.resourceType = { contains: resourceType, mode: 'insensitive' }
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        dateFilter.lte = to
      }
      where.createdAt = dateFilter
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    // For CSV export, fetch all matching records (up to 10000)
    if (format === 'csv') {
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
        include: {
          user: { select: { username: true, displayName: true } },
        },
      })

      const csvHeader = 'Timestamp,User,Action,Resource Type,Resource ID,IP Address,Details'
      const csvRows = logs.map((log) => {
        const username = log.user?.displayName || log.user?.username || 'System'
        const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : ''
        return `"${log.createdAt.toISOString()}","${username}","${log.action}","${log.resourceType}","${log.resourceId || ''}","${log.ipAddress || ''}","${details}"`
      })

      const csv = [csvHeader, ...csvRows].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    // Get distinct action types and resource types for filter dropdowns
    const [actionTypes, resourceTypes] = await Promise.all([
      prisma.auditLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      }),
      prisma.auditLog.findMany({
        select: { resourceType: true },
        distinct: ['resourceType'],
        orderBy: { resourceType: 'asc' },
      }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        actionTypes: actionTypes.map((a) => a.action),
        resourceTypes: resourceTypes.map((r) => r.resourceType).filter(Boolean),
      },
    })
  } catch (error) {
    console.error('Admin list logs error:', error)
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 })
  }
}
