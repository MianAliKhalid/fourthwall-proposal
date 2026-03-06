import { randomBytes, randomUUID, createHash } from 'crypto'
import { NextRequest } from 'next/server'
import path from 'path'

/**
 * Strip common XSS vectors from user input.
 * This is a defense-in-depth measure; always escape output as well.
 */
export function sanitizeInput(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove javascript: protocol variants
    .replace(/javascript\s*:/gi, '')
    // Remove data: URIs that could contain scripts
    .replace(/data\s*:\s*text\/html/gi, '')
    // Remove event handler attributes
    .replace(/on\w+\s*=/gi, '')
}

/**
 * Validate that the request Origin or Referer matches the expected host.
 * Returns true if the request is safe, false if it should be rejected.
 */
export function validateCSRFToken(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')

  if (!host) return false

  // Check Origin header first (most reliable)
  if (origin) {
    try {
      const originUrl = new URL(origin)
      return originUrl.host === host
    } catch {
      return false
    }
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      return refererUrl.host === host
    } catch {
      return false
    }
  }

  // If neither Origin nor Referer is present, reject state-changing requests
  return false
}

/**
 * Sliding window rate limiter (in-memory).
 * Suitable for single-instance deployments. For multi-instance,
 * replace with Redis-backed implementation.
 */
export class RateLimiter {
  private windows: Map<string, number[]> = new Map()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Periodically clean up stale entries every 60 seconds
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60_000)
    }
  }

  /**
   * Check if a request from the given key should be allowed.
   * Returns { allowed: boolean, remaining: number, resetMs: number }
   */
  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let timestamps = this.windows.get(key) ?? []
    // Remove timestamps outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart)

    const remaining = Math.max(0, this.maxRequests - timestamps.length)
    const resetMs = timestamps.length > 0 ? timestamps[0] + this.windowMs - now : this.windowMs

    if (timestamps.length >= this.maxRequests) {
      this.windows.set(key, timestamps)
      return { allowed: false, remaining: 0, resetMs }
    }

    timestamps.push(now)
    this.windows.set(key, timestamps)

    return { allowed: true, remaining: remaining - 1, resetMs }
  }

  private cleanup(): void {
    const now = Date.now()
    const windowStart = now - this.windowMs

    for (const [key, timestamps] of this.windows.entries()) {
      const valid = timestamps.filter((ts) => ts > windowStart)
      if (valid.length === 0) {
        this.windows.delete(key)
      } else {
        this.windows.set(key, valid)
      }
    }
  }
}

/**
 * Generate a cryptographically secure token with additional entropy.
 */
export function generateSecureToken(): string {
  const uuid = randomUUID()
  const extra = randomBytes(16).toString('hex')
  return `${uuid}-${extra}`
}

/**
 * Create an obfuscated filename for uploaded files.
 * Preserves the file extension but replaces the name with a hash.
 */
export function hashFileName(originalName: string): string {
  const ext = path.extname(originalName)
  const timestamp = Date.now().toString()
  const random = randomBytes(8).toString('hex')
  const hash = createHash('sha256')
    .update(`${originalName}-${timestamp}-${random}`)
    .digest('hex')
    .slice(0, 24)

  return `${hash}${ext}`
}
