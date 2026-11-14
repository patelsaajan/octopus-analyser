import { Outlet, ScrollRestoration } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-background text-foreground">
          {/* The sidebar collapses into a sheet on small screens, so they get a button to open it */}
          <div className="p-4 pb-0 md:hidden">
            <SidebarTrigger />
          </div>
          <Outlet />
        </SidebarInset>
        <ScrollRestoration />
      </SidebarProvider>
    </TooltipProvider>
  )
}
