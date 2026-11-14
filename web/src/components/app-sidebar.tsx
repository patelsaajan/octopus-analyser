import { ChartColumnIcon, LayoutDashboardIcon, SettingsIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const NAV_ITEMS = [
  { to: '/', label: 'Usage', icon: ChartColumnIcon },
  { to: '/overview', label: 'Plan analysis', icon: LayoutDashboardIcon },
]

function NavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof SettingsIcon }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to={to} onClick={() => setOpenMobile(false)} />}
        isActive={pathname === to}
        size="lg"
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 shrink-0" />
          <span className="text-lg font-bold tracking-heading">Octopus Analyser</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <NavLink to="/settings" label="Settings" icon={SettingsIcon} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
