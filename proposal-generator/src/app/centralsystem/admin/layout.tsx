'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminNavItems = [
  {
    href: '/admin',
    label: 'Overview',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="6" cy="5" r="3" />
        <path d="M1 14c0-3 2.5-5 5-5s5 2 5 5" />
        <circle cx="12" cy="5" r="2" />
        <path d="M13 9c1.5.5 2.5 2 2.5 4" />
      </svg>
    ),
  },
  {
    href: '/admin/logs',
    label: 'Audit Logs',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="1" width="10" height="14" rx="1.5" />
        <path d="M6 5h4M6 8h4M6 11h3" />
      </svg>
    ),
  },
  {
    href: '/admin/documents',
    label: 'Documents',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M1 5v8.5A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5V7a1.5 1.5 0 00-1.5-1.5H9L7.5 3.5H2.5A1.5 1.5 0 001 5z" />
      </svg>
    ),
  },
  {
    href: '/admin/share-links',
    label: 'Share Links',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="4" cy="8" r="2" />
        <circle cx="12" cy="4" r="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M5.8 7l4.4-2M5.8 9l4.4 2" />
      </svg>
    ),
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {/* Admin Panel Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="8" cy="8" r="3" />
                <circle cx="8" cy="8" r="6" strokeDasharray="3 3" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full uppercase tracking-wide">Admin</span>
          </div>
        </div>

        {/* Sub-navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto pb-1">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap
                  ${isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {children}
    </div>
  )
}
