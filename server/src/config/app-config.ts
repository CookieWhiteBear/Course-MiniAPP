import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import YAML from 'yaml'
import { z } from 'zod'

const AuthorSchema = z.object({
    id: z.string().min(1),
    name: z.string(),
    avatarUrl: z.string().optional()
}).passthrough()

const HomeHeroSchema = z.object({
    imageUrl: z.string().optional(),
    wave: z.object({
        colors: z.array(z.string()).max(10).optional(),
        fps: z.number().int().optional(),
        seed: z.number().optional(),
        speed: z.number().optional()
    }).optional()
}).passthrough()

const UiSchema = z.object({
    homeHero: HomeHeroSchema.optional()
}).passthrough()

const CourseSchema = z.object({
    id: z.number().int().nonnegative(),
    title: z.string(),
    authorId: z.string().optional(),
    author: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    imageUrl: z.string().optional(),
    price: z.number().optional(),
    starsPrice: z.number().optional(),
    duration: z.string().optional(),
    program: z.array(z.string()).optional(),
    currency: z.string().optional(),
    visibility: z.enum(['public', 'hidden']).optional()
}).passthrough()

const AppConfigSchema = z.object({
    app: z.record(z.any()).optional(),
    features: z.record(z.any()).optional(),
    payments: z.record(z.any()).optional(),
    demo: z.record(z.any()).optional(),
    ui: UiSchema.optional(),
    authors: z.array(AuthorSchema).default([]),
    courses: z.array(CourseSchema).default([])
}).passthrough()

export type AppConfig = z.infer<typeof AppConfigSchema>
export type UiConfig = z.infer<typeof UiSchema>
export type AuthorConfig = z.infer<typeof AuthorSchema>
export type CourseConfig = z.infer<typeof CourseSchema>

const defaultConfig: AppConfig = {
    authors: [],
    courses: []
}

function resolveConfigPath(): string {
    if (process.env.CONFIG_PATH) {
        return process.env.CONFIG_PATH
    }

    const cwdConfig = path.join(process.cwd(), 'config.yaml')
    if (existsSync(cwdConfig)) {
        return cwdConfig
    }

    const parentConfig = path.resolve(process.cwd(), '..', 'config.yaml')
    if (existsSync(parentConfig)) {
        return parentConfig
    }

    return cwdConfig
}

let cachedConfig: AppConfig | null = null
let cachedPath: string | null = null

export async function loadAppConfig(): Promise<AppConfig> {
    const configPath = resolveConfigPath()
    if (cachedConfig && cachedPath === configPath) {
        return cachedConfig
    }

    try {
        const raw = await fs.readFile(configPath, 'utf-8')
        const parsed = YAML.parse(raw) || {}
        const result = AppConfigSchema.safeParse(parsed)

        if (!result.success) {
            console.error('[config] Invalid config.yaml', result.error.format())
            cachedConfig = defaultConfig
            cachedPath = configPath
            return cachedConfig
        }

        cachedConfig = result.data
        cachedPath = configPath
        return cachedConfig
    } catch (error) {
        console.warn('[config] Failed to load config.yaml', error)
        cachedConfig = defaultConfig
        cachedPath = configPath
        return cachedConfig
    }
}

export async function getCourseConfig(courseId: number): Promise<CourseConfig | null> {
    const config = await loadAppConfig()
    return config.courses.find(course => course.id === courseId) ?? null
}

export async function getAuthorConfig(authorId: string): Promise<AuthorConfig | null> {
    const config = await loadAppConfig()
    return config.authors.find(author => author.id === authorId) ?? null
}
