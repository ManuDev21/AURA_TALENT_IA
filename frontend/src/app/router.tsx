import { createBrowserRouter } from 'react-router'
import { HomeRedirect, PublicOnly, RequireArea } from '@/app/guards'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { AuthLayout } from '@/layouts/AuthLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { ModuleRoute } from '@/pages/ModuleRoute'
import { PublicPortfolioPage } from '@/pages/PublicPortfolioPage'
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/pages/StatusPages'
import type { AuraArea } from '@/utils/roles'

const areaRoute = (area: AuraArea) => ({
  path: area,
  element: <RequireArea area={area} />,
  children: [
    { index: true, element: null },
    { path: ':moduleId', element: <ModuleRoute area={area} /> },
  ],
})

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        element: <PublicOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      areaRoute('candidate'),
      areaRoute('company'),
      areaRoute('admin'),
      { path: 'p/:slug', element: <PublicPortfolioPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
