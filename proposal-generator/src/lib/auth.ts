import { compare } from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from './prisma'
import { SessionData } from './session'
import { IronSession } from 'iron-session'
import { headers } from 'next/headers'

/**
 * Verify a plaintext password against a bcrypt hash.
 * bcryptjs.compare is already timing-safe internally.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash)
}

/**
 * Create an audit log entry in the database.
 */
export async function createAuditLog(
  userId: string | null,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const headersList = await headers()
    const ipAddress =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown'
    const userAgent = headersList.get('user-agent') || undefined

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType: resourceType || '',
        resourceId: resourceId || null,
        details: details ? JSON.stringify(details) : undefined,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    // Log to console but don't fail the request if audit logging fails
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Fetch the full user record from the database (excluding passwordHash).
 */
export async function getCurrentUser(session: IronSession<SessionData>) {
  if (!session.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      // Never select passwordHash
    },
  })

  return user
}

/**
 * Require authentication. Redirects to /login if not logged in.
 * Use in server components / route handlers.
 */
export async function requireAuth(session: IronSession<SessionData>) {
  if (!session.isLoggedIn || !session.userId) {
    redirect('/login')
  }

  const user = await getCurrentUser(session)
  if (!user || !user.isActive) {
    session.destroy()
    redirect('/login')
  }

  return user
}

/**
 * Require admin role. Redirects to /login if not admin.
 */
export async function requireAdmin(session: IronSession<SessionData>) {
  const user = await requireAuth(session)

  if (user.role !== 'ADMIN') {
    redirect('/login')
  }

  return user
}
