import clsx from 'clsx'
import { Banknote, BookOpen, Building2, Calendar, PlaneTakeoff, CalendarCheck, FileText, LayoutDashboard, Lock, Megaphone, MoreHorizontal, Plane, Ticket, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Aircraft from './pages/Aircraft'
import AircraftDetail from './pages/aircraft/AircraftDetail'
import Club from './pages/Club'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Finance from './pages/Finance'
import FormsPage from './pages/FormsPage'
import FlightPage, { flightPath } from './pages/FlightPage'
import { TODAY_DAY } from './pages/manifest/data'
import Logbook from './pages/Logbook'
import Manifest from './pages/Manifest'
import DayBoard from './pages/manifest/DayBoard'
import TandemCheckin from './pages/TandemCheckin'
import MemberFile from './pages/members/MemberFile'
import Members from './pages/Members'
import PublicApplication from './pages/PublicApplication'
import MyAccount from './pages/MyAccount'
import Reservations from './pages/Reservations'
import Settings from './pages/Settings'
import Shop from './pages/Shop'
import Tickets from './pages/Tickets'
import MassBalanceTool from './pages/aircraft/MassBalanceTool'
import ModuleGate from './pages/club/ModuleOff'
import { areaOn, type Area } from './modules'
import { labelOf, type Permission } from './permissions'
import { useApp } from './state'
import { Banner, Card, Logo } from './ui'
import DevicePill from './session/DeviceMenu'
import UserMenu from './session/UserMenu'
import { useSession } from './session/session'

type Need = Permission | Permission[] // an array means "any of these", like V1's requiredAnyPermission
interface Item { to: string; label: string; icon: LucideIcon; perm?: Need; mobile?: boolean; group: string; area?: Area }

/** Menu and permissions as in V1 (lib/main-nav.ts): every item names the permission that shows it. */
const nav: Item[] = [
  { to: '/dashboard', label: 'Übersicht', icon: LayoutDashboard, mobile: true, group: '' },
  { to: '/reservierungen', label: 'Reservierungen', icon: Calendar, perm: 'aircraft.view', mobile: true, group: 'Fliegen', area: 'charter' },
  { to: '/flugzeuge', label: 'Flugzeuge', icon: Plane, perm: 'aircraft.view', group: 'Fliegen' },
  { to: '/bordbuch', label: 'Bordbuch', icon: BookOpen, perm: 'flight.log.view', group: 'Fliegen' },
  { to: '/manifest', label: 'Manifest', icon: CalendarCheck, perm: 'manifest.view', mobile: true, group: 'Skydive', area: 'skydive' },
  { to: '/tickets', label: 'Tickets und Voucher', icon: Ticket, perm: 'vouchers.view', group: 'Skydive', area: 'skydive' },
  { to: '/mitglieder', label: 'Mitglieder', icon: Users, perm: 'members.view.all', group: 'Verein' },
  { to: '/formulare', label: 'Formulare', icon: FileText, perm: 'pdf_templates.manage', group: 'Verein' },
  { to: '/verein', label: 'Vereinseinstellungen', icon: Building2, perm: 'settings.edit.system', group: 'Verein' },
  { to: '/shop', label: 'Shop und Mails', icon: Megaphone, perm: ['store.content.manage', 'store.requirements.manage', 'manifest.settings.edit'], group: 'Verein', area: 'skydive' },
  { to: '/finanzen', label: 'Finanzen', icon: Banknote, perm: 'billing.view.all', group: 'Finanzen' },
  { to: '/mein-konto', label: 'Mein Konto', icon: Wallet, perm: 'billing.view.own', mobile: true, group: 'Finanzen' },
]
const groups = ['', 'Fliegen', 'Skydive', 'Verein', 'Finanzen']
const pcOnly = ['/finanzen', '/mitglieder', '/shop', '/tickets', '/formulare', '/verein']

export default function App() {
  const { persona, can, grants, club, fnName, loads, afpConfig, modules } = useApp()
  const { session } = useSession()
  const { pathname } = useLocation()
  const [more, setMore] = useState(false)
  // "Mein Flug" exists only while the person is entered as pilot on a flight of today that has not landed: it leads straight into the AFP of the next one.
  const myNext = !afpConfig.enabled || !modules.skydive ? undefined : loads.filter((l) => l.dayId === TODAY_DAY && l.pilotId === persona.memberId && l.status !== 'gelandet').sort((a, b) => a.time.localeCompare(b.time))[0]
  const mine: Item[] = myNext ? [{ to: flightPath({ kind: 'load', loadId: myNext.id }), label: 'Mein Flug', icon: PlaneTakeoff, mobile: true, group: 'Fliegen' }] : []
  const visible = [...mine, ...nav.filter((i) => can(i.perm) && areaOn(modules, i.area))]
  const mobile = visible.filter((i) => i.mobile)
  const rest = visible.filter((i) => !i.mobile)
  const needers = (perm: Need) => [perm].flat().flatMap((p) => Object.entries(grants).filter(([, codes]) => codes.includes(p)).map(([fn]) => fnName(fn)))

  const link = (i: Item, compact = false) => (
    <NavLink key={i.to} to={i.to} onClick={() => setMore(false)}
      className={({ isActive }) => clsx(compact ? 'flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-medium' : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand-soft text-brand' : 'text-slate-600 hover:bg-slate-50')}>
      <i.icon size={20} />{i.label}
    </NavLink>
  )

  // Public pages have no menu and no login: the link from the mail goes straight to the form.
  if (pathname.startsWith('/antrag/')) return <PublicApplication id={pathname.split('/')[2]} />
  // The tandem check-in runs on a second device (tablet at the entrance): no login, no menu.
  if (pathname.startsWith('/checkin/')) return <ModuleGate area="skydive"><TandemCheckin dayId={pathname.split('/')[2]} /></ModuleGate>
  if (!session) return <Login />

  const guard = (need: Need, el: ReactNode) => (can(need) ? el : <NoAccess need={need} holders={needers(need)} role={persona.role} />)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="order-2 hidden shrink-0 border-line bg-surface md:order-1 md:flex md:w-60 md:flex-col md:border-r">
        <div className="flex items-center gap-3 px-5 py-5"><Logo size={36} /><div className="min-w-0"><div className="text-lg font-semibold leading-tight tracking-tight">FlightHub</div><div className="truncate text-xs text-muted">{club.name}</div></div></div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((g) => {
            const items = visible.filter((i) => i.group === g)
            return items.length > 0 && (
              <div key={g}>{g && <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</div>}<div className="space-y-0.5">{items.map((i) => link(i))}</div></div>
            )
          })}
        </nav>
      </aside>

      <div className="order-1 flex min-h-0 flex-1 flex-col md:order-2">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:justify-end md:px-6">
        <span className="flex items-center gap-2 font-semibold md:hidden"><Logo size={26} />FlightHub</span>
        <div className="flex items-center gap-2"><DevicePill /><UserMenu /></div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          {pcOnly.some((p) => pathname.startsWith(p)) && <div className="mb-4 md:hidden"><Banner>Diese Seite ist für den PC gedacht. Am Handy siehst du eine verkleinerte Ansicht.</Banner></div>}
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reservierungen" element={guard('aircraft.view', <ModuleGate area="charter"><Reservations /></ModuleGate>)} />
            <Route path="/flugzeuge" element={guard('aircraft.view', <Aircraft />)} />
            <Route path="/flugzeuge/:id" element={guard('aircraft.view', <AircraftDetail />)} />
            <Route path="/flugzeuge/:id/rechner" element={guard('aircraft.view', <MassBalanceTool />)} />
            <Route path="/flug/:key" element={guard('afp.view', <FlightPage />)} />
            <Route path="/bordbuch" element={guard('flight.log.view', <Logbook />)} />
            <Route path="/manifest" element={guard('manifest.view', <ModuleGate area="skydive"><Manifest /></ModuleGate>)} />
            <Route path="/manifest/:dayId" element={guard('manifest.view', <ModuleGate area="skydive"><DayBoard /></ModuleGate>)} />
            <Route path="/sprungtag" element={<Navigate to="/manifest" replace />} />
            <Route path="/tickets" element={guard('vouchers.view', <ModuleGate area="skydive"><Tickets /></ModuleGate>)} />
            <Route path="/mitglieder" element={guard('members.view.all', <Members />)} />
            <Route path="/mitglieder/:id" element={guard('members.view.all', <MemberFile />)} />
            <Route path="/formulare" element={guard('pdf_templates.manage', <FormsPage />)} />
            <Route path="/shop" element={guard(['store.content.manage', 'store.requirements.manage', 'manifest.settings.edit'], <ModuleGate area="skydive"><Shop /></ModuleGate>)} />
            <Route path="/finanzen" element={guard('billing.view.all', <Finance />)} />
            <Route path="/verein" element={guard('settings.edit.system', <Club />)} />
            <Route path="/einstellungen" element={<Settings />} />
            <Route path="/mein-konto" element={guard('billing.view.own', <MyAccount />)} />
          </Routes>
        </div>
      </main>
      </div>

      <nav className="order-3 flex border-t border-line bg-surface p-1 md:hidden">
        {mobile.map((i) => link(i, true))}
        {rest.length > 0 && (
          <div className="relative flex flex-1">
            <button onClick={() => setMore(!more)} className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-medium text-slate-600"><MoreHorizontal size={20} />Mehr</button>
            {more && <div className="absolute bottom-14 right-0 w-52 space-y-0.5 rounded-xl border border-line bg-surface p-1 shadow-lg">{rest.map((i) => link(i))}</div>}
          </div>
        )}
      </nav>
    </div>
  )
}

function NoAccess({ need, holders, role }: { need: Need; holders: string[]; role: string }) {
  const first = [need].flat()[0]
  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <Lock className="mx-auto mb-3 text-muted" />
      <div className="font-semibold">Dafür fehlt dir die Berechtigung</div>
      <p className="mt-1 text-sm text-muted">Du hast die Funktionen: {role}. Benötigt wird „{labelOf(first)}“{holders.length > 0 && <>, die haben aktuell: {[...new Set(holders)].join(', ')}</>}.</p>
    </Card>
  )
}
