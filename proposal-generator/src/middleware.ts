import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData } from './lib/session'

// Routes that don't require authentication
const publicPaths = ['/', '/getintowebsite', '/api/auth/login', '/api/auth/logout', '/api/public']
const publicPrefixes = ['/share/', '/api/public/']

// Routes that require admin role
const adminPrefixes = ['/centralsystem/admin', '/api/admin']

// HTTP methods that mutate state
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isPublicRoute(pathname: string): boolean {
  if (publicPaths.includes(pathname)) return true
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}

function isAdminRoute(pathname: string): boolean {
  return adminPrefixes.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Add security headers to every response.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
  return response
}

/**
 * CSRF protection: verify that the Origin or Referer header matches the Host
 * for state-changing requests.
 */
function validateCSRF(request: NextRequest): boolean {
  if (!MUTATION_METHODS.has(request.method)) return true

  const host = request.headers.get('host')
  if (!host) return false

  const origin = request.headers.get('origin')
  if (origin) {
    try {
      const originUrl = new URL(origin)
      return originUrl.host === host
    } catch {
      return false
    }
  }

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      return refererUrl.host === host
    } catch {
      return false
    }
  }

  // No Origin or Referer on a mutation request -- reject
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return applySecurityHeaders(NextResponse.next())
  }

  // CSRF protection for mutation requests on API routes
  if (pathname.startsWith('/api/') && !validateCSRF(request)) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      )
    )
  }

  // Public routes don't need auth
  if (isPublicRoute(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Read the session from the cookie
  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'fourthwall_session',
  })

  // Check if user is logged in
  if (!session.isLoggedIn || !session.userId) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/', request.url)))
  }

  // Check admin routes
  if (isAdminRoute(pathname) && session.role !== 'ADMIN') {
    return applySecurityHeaders(NextResponse.redirect(new URL('/', request.url)))
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
