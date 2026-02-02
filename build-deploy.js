import { execSync } from 'child_process'
import { existsSync, rmSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const LATEST_DIR = join(__dirname, 'latest-build')
const BUILDS_DIR = join(__dirname, 'builds')

function logOk(message) {
    console.log(`OK: ${message}`)
}

function logWarn(message) {
    console.warn(`WARN: ${message}`)
}

function logError(message) {
    console.error(`ERROR: ${message}`)
}

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex += 1
    }
    const precision = value >= 10 || unitIndex === 0 ? 0 : 1
    return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function ensureEmptyDir(dir) {
    if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true })
    }
    mkdirSync(dir, { recursive: true })
}

function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
}

function getVersion() {
    const packageJson = JSON.parse(readFileSync(join(__dirname, 'server', 'package.json'), 'utf-8'))
    return packageJson.version
}

function getGitCommit() {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    } catch {
        return 'unknown'
    }
}

function getGitBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    } catch {
        return 'unknown'
    }
}

function createReleaseInfo(version, commit, branch) {
    const releaseInfo = {
        version,
        commit,
        branch,
        buildDate: new Date().toISOString()
    }

    writeFileSync(join(LATEST_DIR, 'release-info.json'), JSON.stringify(releaseInfo, null, 2))
}

function formatTimestampUtcPlus3() {
    const now = new Date()
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
    const plus3 = new Date(utcTime + 3 * 60 * 60000)

    const dd = String(plus3.getDate()).padStart(2, '0')
    const mm = String(plus3.getMonth() + 1).padStart(2, '0')
    const yy = String(plus3.getFullYear()).slice(-2)
    const hh = String(plus3.getHours()).padStart(2, '0')
    const min = String(plus3.getMinutes()).padStart(2, '0')

    return `${dd}.${mm}.${yy}-time-${hh}.${min}.UTC+3`
}

function createBuildArchive() {
    ensureDir(BUILDS_DIR)

    const archiveName = `${formatTimestampUtcPlus3()}.zip`
    const archivePath = join(BUILDS_DIR, archiveName)

    const command = `powershell -NoProfile -Command "Compress-Archive -Path '${LATEST_DIR}\\*' -DestinationPath '${archivePath}' -Force"`

    try {
        execSync(command, { stdio: 'inherit' })
        const stats = statSync(archivePath)
        logOk(`Build archive created: ${archiveName} (${formatBytes(stats.size)})`)
        return archiveName
    } catch (err) {
        logError(`Failed to create build archive: ${err.message}`)
        return null
    }
}

console.log('Starting build...\n')

const version = getVersion()
const commit = getGitCommit()
const branch = getGitBranch()

console.log('Build info:')
console.log(`  Version: ${version}`)
console.log(`  Commit:  ${commit}`)
console.log(`  Branch:  ${branch}`)
console.log('')

console.log('Preparing output directory...')
ensureEmptyDir(LATEST_DIR)
logOk('latest-build directory ready.')

console.log('\nBuilding frontend...')
try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname })
    logOk('Frontend built.')
} catch (err) {
    logError('Frontend build failed.')
    process.exit(1)
}

console.log('\nBuilding backend...')
try {
    execSync('npm run build', { stdio: 'inherit', cwd: join(__dirname, 'server') })
    logOk('Backend built.')
} catch (err) {
    logError('Backend build failed.')
    process.exit(1)
}

console.log('\nCopying backend...')
const serverDistDir = join(__dirname, 'server', 'dist')
cpSync(serverDistDir, LATEST_DIR, { recursive: true })
logOk('Backend copied.')

console.log('\nCopying backend locales...')
const localesSourceDir = join(__dirname, 'server', 'src', 'locales')
const localesDestDir = join(LATEST_DIR, 'locales')
if (existsSync(localesSourceDir)) {
    cpSync(localesSourceDir, localesDestDir, { recursive: true })
    logOk('Locales copied.')
} else {
    logWarn('locales directory not found in server/src')
}

console.log('\nCopying frontend...')
const frontendDistDir = join(__dirname, 'dist')
const publicDir = join(LATEST_DIR, 'public')
ensureDir(publicDir)
cpSync(frontendDistDir, publicDir, { recursive: true })
logOk('Frontend copied.')

console.log('\nCopying package.json...')
cpSync(
    join(__dirname, 'server', 'package.json'),
    join(LATEST_DIR, 'package.json')
)
logOk('package.json copied.')

console.log('\nCopying config.yaml...')
const configSourcePath = join(__dirname, 'config.yaml')
const configDestPath = join(LATEST_DIR, 'config.yaml')
if (existsSync(configSourcePath)) {
    cpSync(configSourcePath, configDestPath)
    logOk('config.yaml copied.')
} else {
    logWarn('config.yaml not found, skipping.')
}

console.log('\nCopying courses...')
const coursesSourceDir = join(__dirname, 'courses')
const coursesDestDir = join(LATEST_DIR, 'courses')
if (existsSync(coursesSourceDir)) {
    cpSync(coursesSourceDir, coursesDestDir, { recursive: true })
    logOk('Courses copied.')
} else {
    logWarn('courses/ directory not found, skipping.')
}

console.log('\nWriting release info...')
createReleaseInfo(version, commit, branch)
logOk('release-info.json created.')

console.log('\nlatest-build contents:')
const files = readdirSync(LATEST_DIR)
files.forEach(file => {
    console.log(`- ${file}`)
})

console.log('\nCreating build archive...')
const archiveName = createBuildArchive()

console.log('\nBuild complete.')
console.log('Output directory: latest-build/')
if (archiveName) {
    console.log(`Build archive: builds/${archiveName}`)
}
