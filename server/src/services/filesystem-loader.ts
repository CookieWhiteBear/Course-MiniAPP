import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { CloudflareStreamService } from './cloudflare-stream.service.js'
import { getAuthorConfig, getCourseConfig } from '../config/app-config.js'

function resolveCoursesDir(): string {
    if (process.env.COURSES_DIR) {
        return process.env.COURSES_DIR
    }

    const cwdCourses = path.join(process.cwd(), 'courses')
    if (existsSync(cwdCourses)) {
        return cwdCourses
    }

    const parentCourses = path.resolve(process.cwd(), '..', 'courses')
    if (existsSync(parentCourses)) {
        return parentCourses
    }

    return cwdCourses
}

// Base directory for courses
// In production (pterodactyl/), courses/ should be at the same level as the app
// From pterodactyl/services/ we go up one level to pterodactyl/, then look for ../courses/
export const COURSES_DIR = resolveCoursesDir()

interface ParsedQuiz {
    type: 'single' | 'multi'
    remconFile?: string
    questions: Array<{
        question: string
        answers: string[]
        correctAnswers: number[]
    }>
}

interface ParsedLesson {
    id: number
    title: string
    type: 'text' | 'image' | 'video' | 'quiz'
    content: string
    imageUrl?: string
    videoUrl?: string
    quiz?: ParsedQuiz
}

/**
 * Parse markdown content and extract quiz data
 */
function parseQuiz(content: string): ParsedQuiz | null {
    const quizTypeMatch = content.match(/<quiz:(single|multi)>/)
    if (!quizTypeMatch) return null

    const quizType = quizTypeMatch[1] as 'single' | 'multi'

    // Extract remcon file if present
    const remconMatch = content.match(/<quiz-remcon:([^>]+)>/)
    const remconFile = remconMatch ? remconMatch[1].trim() : undefined

    // Remove quiz tags from content
    let cleanContent = content
        .replace(/<quiz:(single|multi)>/g, '')
        .replace(/<quiz-remcon:[^>]+>/g, '')
        .trim()

    // Extract questions (everything between # headers and before <q:> tags)
    const questions: ParsedQuiz['questions'] = []

    // Split by headers
    const sections = cleanContent.split(/(?=^# )/m).filter(s => s.trim())

    for (const section of sections) {
        // Extract question (first line after #)
        const questionMatch = section.match(/^#\s+(.+)$/m)
        if (!questionMatch) continue

        const question = questionMatch[1].trim()

        // Extract answers (lines starting with 1. 2. 3. etc)
        const answers: string[] = []
        const answerMatches = section.matchAll(/^\d+\.\s+(.+)$/gm)
        for (const match of answerMatches) {
            answers.push(match[1].trim())
        }

        // Extract correct answers (<q:1> <q:2>)
        const correctAnswers: number[] = []
        const correctMatches = section.matchAll(/<q:(\d+)>/g)
        for (const match of correctMatches) {
            correctAnswers.push(parseInt(match[1], 10))
        }

        if (question && answers.length > 0 && correctAnswers.length > 0) {
            questions.push({
                question,
                answers,
                correctAnswers
            })
        }
    }

    if (questions.length === 0) return null

    return {
        type: quizType,
        remconFile,
        questions
    }
}

/**
 * Parse markdown content and replace custom tags
 * Supports:
 * - <img:path> for local images
 * - <vid:path> for local videos
 * - <vid:cloudflare-id> for Cloudflare Stream videos
 */
function parseMarkdown(content: string, courseDir: string): string {
    let parsed = content

    // Replace <img:path> tags
    parsed = parsed.replace(/<img:([^>]+)>/g, (_, imgPath) => {
        const fullPath = imgPath.startsWith('/') ? imgPath : `/courses/${path.basename(courseDir)}/${imgPath}`
        return `![Image](${fullPath})`
    })

    // Replace <vid:path-or-id> tags
    // Detects Cloudflare Stream video IDs vs local paths
    parsed = parsed.replace(/<vid:([^>]+)>/g, (_, vidInput) => {
        const trimmedInput = vidInput.trim()

        // Check if it's a Cloudflare Stream video ID
        const videoId = CloudflareStreamService.extractVideoId(trimmedInput)

        if (videoId) {
            // Cloudflare Stream video - use special markdown-safe marker
            // Frontend will detect this and replace with React component
            return `\n\n{{CLOUDFLARE_STREAM:${videoId}}}\n\n`
        } else {
            // Local video file
            const fullPath = trimmedInput.startsWith('/')
                ? trimmedInput
                : `/courses/${path.basename(courseDir)}/${trimmedInput}`
            return `<video src="${fullPath}" controls></video>`
        }
    })

    return parsed
}

/**
 * Get lesson type from file extension
 */
function getLessonType(filename: string): 'text' | 'image' | 'video' | 'quiz' {
    const ext = path.extname(filename).toLowerCase()

    if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
        return 'video'
    }

    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        return 'image'
    }

    return 'text' // .md files
}

/**
 * Parse a single lesson file
 */
async function parseLesson(
    courseId: number,
    lessonId: number,
    filename: string,
    courseDir: string
): Promise<ParsedLesson> {
    const filePath = path.join(courseDir, filename)
    const type = getLessonType(filename)
    const baseName = path.basename(filename, path.extname(filename))

    // For video/image files, the whole lesson is that media
    if (type === 'video') {
        return {
            id: lessonId,
            title: `Video Lesson ${lessonId}`,
            type: 'video',
            content: '',
            videoUrl: `/courses/${courseId}/${filename}`
        }
    }

    if (type === 'image') {
        return {
            id: lessonId,
            title: `Image Lesson ${lessonId}`,
            type: 'image',
            content: '',
            imageUrl: `/courses/${courseId}/${filename}`
        }
    }

    // For .md files, parse the content
    const rawContent = await fs.readFile(filePath, 'utf-8')

    // Check if it's a quiz
    const quiz = parseQuiz(rawContent)

    if (quiz) {
        // Remove quiz sections from content
        const contentWithoutQuiz = rawContent
            .replace(/<quiz:(single|multi)>/g, '')
            .replace(/<quiz-remcon:[^>]+>/g, '')
            .replace(/^#\s+.+$/gm, '') // Remove question headers
            .replace(/^\d+\.\s+.+$/gm, '') // Remove answer lines
            .replace(/<q:\d+>/g, '') // Remove correct answer markers
            .trim()

        return {
            id: lessonId,
            title: `Quiz ${lessonId}`,
            type: 'quiz',
            content: parseMarkdown(contentWithoutQuiz, courseDir),
            quiz
        }
    }

    // Regular text lesson
    const parsedContent = parseMarkdown(rawContent, courseDir)

    // Extract title from first heading (prefer non-numeric), fallback to filename
    const headingMatches = Array.from(rawContent.matchAll(/^#{1,6}\s+(.+)$/gm))
    const preferredHeading = headingMatches.find(match => {
        const heading = match[1]?.trim()
        return heading && !/^\d+$/.test(heading)
    }) ?? headingMatches[0]
    const title = preferredHeading?.[1]?.trim() || baseName

    return {
        id: lessonId,
        title,
        type: 'text',
        content: parsedContent
    }
}

/**
 * Load remedial content for a quiz
 */
async function loadRemedialContent(
    courseDir: string,
    remconFile: string
): Promise<string> {
    try {
        const remconPath = path.join(courseDir, remconFile)
        const content = await fs.readFile(remconPath, 'utf-8')
        return parseMarkdown(content, courseDir)
    } catch (error) {
        console.error(`Failed to load remedial content: ${remconFile}`, error)
        return ''
    }
}

/**
 * Get all lessons for a course from filesystem
 */
export async function loadCourseFromFilesystem(courseId: number): Promise<ParsedLesson[]> {
    const courseDir = path.join(COURSES_DIR, courseId.toString())

    try {
        const files = await fs.readdir(courseDir)

        // Filter and sort lesson files (ignore remcon files)
        const lessonFiles = files
            .filter(f => {
                // Ignore hidden files and remcon files
                if (f.startsWith('.') || f.startsWith('_')) return false

                // Only include numbered files (1.md, 2.mp4, etc)
                const baseName = path.basename(f, path.extname(f))
                return /^\d+$/.test(baseName)
            })
            .sort((a, b) => {
                // Sort by number
                const aNum = parseInt(path.basename(a, path.extname(a)), 10)
                const bNum = parseInt(path.basename(b, path.extname(b)), 10)
                return aNum - bNum
            })

        // Parse each lesson
        const lessons: ParsedLesson[] = []

        for (const file of lessonFiles) {
            const lessonNum = parseInt(path.basename(file, path.extname(file)), 10)
            const lesson = await parseLesson(courseId, lessonNum, file, courseDir)
            lessons.push(lesson)
        }

        return lessons
    } catch (error) {
        console.error(`Failed to load course ${courseId} from filesystem:`, error)
        return []
    }
}

/**
 * Check if a course exists in filesystem
 */
export async function courseExistsInFilesystem(courseId: number): Promise<boolean> {
    const courseDir = path.join(COURSES_DIR, courseId.toString())

    try {
        const stat = await fs.stat(courseDir)
        return stat.isDirectory()
    } catch {
        return false
    }
}

/**
 * Get course metadata from config.yaml
 */
export async function loadCourseMetadata(courseId: number): Promise<{
    title: string
    author: string
    authorAvatar?: string
    description?: string
    category?: string
    imageUrl?: string
    price?: number
    starsPrice?: number
    duration?: string
    program?: string[]
    currency?: string
} | null> {
    const config = await getCourseConfig(courseId)
    if (!config) {
        return {
            title: `Course ${courseId}`,
            author: 'Unknown'
        }
    }

    const authorConfig = config.authorId ? await getAuthorConfig(config.authorId) : null
    const authorName = authorConfig?.name ?? config.author ?? 'Unknown'
    const authorAvatar = authorConfig?.avatarUrl

    return {
        title: config.title,
        author: authorName,
        authorAvatar,
        description: config.description,
        category: config.category,
        imageUrl: config.imageUrl,
        price: config.price,
        starsPrice: config.starsPrice,
        duration: config.duration,
        program: config.program,
        currency: config.currency
    }
}

/**
 * Load remedial content for a specific lesson
 */
export async function loadLessonRemedialContent(
    courseId: number,
    lessonId: number
): Promise<string | null> {
    const courseDir = path.join(COURSES_DIR, courseId.toString())
    const lessons = await loadCourseFromFilesystem(courseId)
    const lesson = lessons.find(l => l.id === lessonId)

    if (!lesson || !lesson.quiz || !lesson.quiz.remconFile) {
        return null
    }

    return loadRemedialContent(courseDir, lesson.quiz.remconFile)
}
