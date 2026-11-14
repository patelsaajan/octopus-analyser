import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import OverviewPage from './app/overview/page'
import UsagePage from './app/page'
import SettingsPage from './app/settings/page'
import './app/globals.css'

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: '/', element: <UsagePage /> },
      { path: '/overview', element: <OverviewPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
