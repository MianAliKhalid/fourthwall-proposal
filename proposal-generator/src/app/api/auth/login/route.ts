import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createAuditLog } from '@/lib/auth'

// ---------------------------------------------------------------------------
// In-memory rate limiter
// Map<username, { count: number, firstAttempt: number }>
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()

// Periodic cleanup to prevent memory leak (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(key)
    }
  }
}, 5 * 60 * 1000)

function checkRateLimit(username: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = loginAttempts.get(username)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    // Window expired or first attempt
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - record.count }
}

function recordFailedAttempt(username: string): number {
  const now = Date.now()
  const record = loginAttempts.get(username)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(username, { count: 1, firstAttempt: now })
    return MAX_ATTEMPTS - 1
  }

  record.count += 1
  return Math.max(0, MAX_ATTEMPTS - record.count)
}

function clearAttempts(username: string): void {
  loginAttempts.delete(username)
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      )
    }

    const normalizedUsername = username.trim().toLowerCase()

    // Check rate limit
    const rateCheck = checkRateLimit(normalizedUsername)
    if (!rateCheck.allowed) {
      await createAuditLog(
        null,
        'LOGIN_RATE_LIMITED',
        'User',
        undefined,
        { username: normalizedUsername }
      )
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again in 15 minutes.',
          attemptsRemaining: 0,
        },
        { status: 429 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    })

    if (!user || !user.isActive) {
      // Record attempt even for non-existent users (prevent user enumeration)
      const remaining = recordFailedAttempt(normalizedUsername)
      // Add small delay to prevent timing attacks on user existence
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 100))

      await createAuditLog(
        user?.id || null,
        'LOGIN_FAILED',
        'User',
        user?.id,
        { username: normalizedUsername, reason: !user ? 'user_not_found' : 'user_inactive' }
      )

      return NextResponse.json(
        {
          error: 'Invalid username or password.',
          attemptsRemaining: remaining,
        },
        { status: 401 }
      )
    }

    // Verify password (bcryptjs compare is already timing-safe)
    const isValid = await verifyPassword(password, user.passwordHash)

    if (!isValid) {
      const remaining = recordFailedAttempt(normalizedUsername)

      await createAuditLog(
        user.id,
        'LOGIN_FAILED',
        'User',
        user.id,
        { username: normalizedUsername, reason: 'invalid_password' }
      )

      return NextResponse.json(
        {
          error: 'Invalid username or password.',
          attemptsRemaining: remaining,
        },
        { status: 401 }
      )
    }

    // Success - clear rate limit and set session
    clearAttempts(normalizedUsername)

    // Update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    // Create session
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    })

    const session = await getIronSession<SessionData>(request, response, {
      password: process.env.SESSION_SECRET as string,
      cookieName: 'fourthwall_session',
      ttl: 8 * 60 * 60,
      cookieOptions: {
        httpOnly: true,
        secure: request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:',
        sameSite: 'lax' as const,
      },
    })

    session.userId = user.id
    session.username = user.username
    session.role = user.role as 'ADMIN' | 'USER'
    session.isLoggedIn = true
    await session.save()

    await createAuditLog(
      user.id,
      'LOGIN_SUCCESS',
      'User',
      user.id,
      { username: normalizedUsername }
    )

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred.' },
      { status: 500 }
    )
  }
}
