import { getSession } from '@/lib/session'
import { requireAuth } from '@/lib/auth'
import DashboardShell from './dashboard-shell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const user = await requireAuth(session)

  return (
    <DashboardShell
      initialUser={{
        id: user.id,
        username: user.username,
        displayName: user.displayName ?? null,
        role: user.role as 'ADMIN' | 'USER',
      }}
    >
      {children}
    </DashboardShell>
  )
}
