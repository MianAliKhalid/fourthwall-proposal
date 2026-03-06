import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData } from '@/lib/session'
import { createAuditLog } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.redirect(new URL('/login', request.url))

    const session = await getIronSession<SessionData>(request, response, {
      password: process.env.SESSION_SECRET as string,
      cookieName: 'fourthwall_session',
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
      },
    })

    const userId = session.userId
    const username = session.username

    // Destroy the session
    session.destroy()

    // Audit log
    if (userId) {
      await createAuditLog(
        userId,
        'LOGOUT',
        'User',
        userId,
        { username }
      )
    }

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
