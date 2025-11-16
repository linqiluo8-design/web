"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "./Toast"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider defaultDuration={5000}>
        {children}
      </ToastProvider>
    </SessionProvider>
  )
}
