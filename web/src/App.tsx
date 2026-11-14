import { Outlet, ScrollRestoration } from 'react-router-dom'

export default function App() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <main className="flex-1">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}
