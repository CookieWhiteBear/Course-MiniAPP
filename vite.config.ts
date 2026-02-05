import fs from "fs"
import path from "path"
import type { Connect, ViteDevServer } from "vite"
import type { IncomingMessage, ServerResponse } from "http"
import { defineConfig } from 'vite'
import YAML from "yaml"
import react from '@vitejs/plugin-react'

const HIDE_PUBLIC_QUERY_KEYS = ["tgWebAppData", "initData", "initdata"]
const HIDE_PUBLIC_DEV_COOKIE = "cg_hp_dev"
const HIDE_PUBLIC_COOKIE = "cg_hp"

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
  }
  return null
}

function readHidePublicFromConfig(): boolean {
  const configPath = path.resolve(__dirname, "config.yaml")
  if (!fs.existsSync(configPath)) return false
  try {
    const raw = fs.readFileSync(configPath, "utf-8")
    const parsed = (YAML.parse(raw) || {}) as {
      env?: Record<string, unknown>
      features?: Record<string, unknown>
    }
    const envValue = parsed.env?.hidePublic ?? parsed.env?.hidepublic
    const featureValue = parsed.features?.hidePublic ?? parsed.features?.hidepublic
    const resolved = parseBoolean(envValue ?? featureValue)
    return resolved ?? false
  } catch {
    return false
  }
}

function hasTelegramQuery(url: string): boolean {
  if (!url) return false
  const queryIndex = url.indexOf("?")
  const hashIndex = url.indexOf("#")
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1) : ""
  const hashQuery = hashIndex >= 0 ? url.slice(hashIndex + 1) : ""
  const searchParams = new URLSearchParams(query)
  const hashParams = new URLSearchParams(hashQuery)
  return HIDE_PUBLIC_QUERY_KEYS.some((key) => {
    const value = searchParams.get(key) || hashParams.get(key)
    return Boolean(value && value.trim())
  })
}

function hasAccessCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false
  const parts = cookieHeader.split(";")
  return parts.some((part) => {
    const [rawKey] = part.trim().split("=")
    return rawKey === HIDE_PUBLIC_DEV_COOKIE || rawKey === HIDE_PUBLIC_COOKIE
  })
}

// https://vite.dev/config/
export default defineConfig(() => {
  const envOverride = parseBoolean(process.env.VITE_HIDE_PUBLIC)
  const hidePublic = envOverride ?? readHidePublicFromConfig()
  const hidePublicEnv = hidePublic ? "true" : "false"

  const hidePublicPlugin = () => ({
    name: "hide-public-dev",
    configureServer(server: ViteDevServer) {
      if (!hidePublic) return
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        const url = req?.url || ""
        if (hasAccessCookie(req?.headers?.cookie)) {
          return next()
        }
        if (hasTelegramQuery(url)) {
          res.setHeader(
            "Set-Cookie",
            `${HIDE_PUBLIC_DEV_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=900`
          )
          return next()
        }
        return next()
      })
    }
  })

  return {
    plugins: [react(), hidePublicPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_HIDE_PUBLIC": JSON.stringify(hidePublicEnv),
    },
    server: {
      proxy: {
        "/api": "http://localhost:3001",
        "/paypal-hook": "http://localhost:3001",
      },
    },
  }
})
