import { spawn } from "child_process"
import readline from "readline"

const options = [
    {
        id: "dev",
        label: "Dev (Telegram auth)",
        frontendEnv: {},
        backendEnv: {}
    },
    {
        id: "demo",
        label: "Demo (no Telegram auth)",
        frontendEnv: { VITE_DEMO_MODE: "true" },
        backendEnv: { DEMO_MODE: "true" }
    },
    {
        id: "build-deploy",
        label: "Build deploy (package release)",
        aliases: ["build:deploy"],
        action: "build-deploy"
    },
    {
        id: "exit",
        label: "Exit",
        action: "exit"
    }
]

const children = []

function render(selectedIndex) {
    console.clear()
    console.log("Select run mode:\n")
    options.forEach((opt, idx) => {
        const prefix = idx === selectedIndex ? "> " : "  "
        console.log(`${prefix}${opt.label}`)
    })
    console.log("\nUse Up/Down, Enter.")
}

function killTree(child) {
    if (!child || child.killed) return
    if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" })
    } else {
        child.kill("SIGTERM")
    }
}

function shutdown(code = 0) {
    children.forEach(killTree)
    process.exit(code)
}

function runBuildDeploy() {
    console.clear()
    console.log("Running build:deploy...\n")

    const build = spawn(
        "npm",
        ["run", "build:deploy"],
        {
            stdio: "inherit",
            shell: true,
            env: { ...process.env }
        }
    )

    build.on("exit", (code) => {
        console.log(`\nBuild:deploy exited with code ${code ?? "unknown"}`)
        shutdown(code ?? 0)
    })
}

function startServers(mode) {
    if (mode.action === "exit") {
        return shutdown(0)
    }
    if (mode.action === "build-deploy") {
        return runBuildDeploy()
    }

    console.clear()
    console.log(`Starting ${mode.label}...\n`)

    const frontend = spawn(
        "npm",
        ["run", "dev", "--", "--host"],
        {
            stdio: "inherit",
            shell: true,
            env: { ...process.env, ...mode.frontendEnv }
        }
    )

    const backend = spawn(
        "npm",
        ["--prefix", "server", "run", "dev"],
        {
            stdio: "inherit",
            shell: true,
            env: { ...process.env, ...mode.backendEnv }
        }
    )

    children.push(frontend, backend)

    frontend.on("exit", (code) => {
        console.log(`\nFrontend exited with code ${code ?? "unknown"}`)
    })
    backend.on("exit", (code) => {
        console.log(`\nBackend exited with code ${code ?? "unknown"}`)
    })

    console.log("\nPress Ctrl+C to stop both processes.")
}

function startInteractive() {
    let selected = 0

    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true)
    }

    render(selected)

    const onKeypress = (_str, key) => {
        if (key?.name === "up") {
            selected = (selected - 1 + options.length) % options.length
            render(selected)
        } else if (key?.name === "down") {
            selected = (selected + 1) % options.length
            render(selected)
        } else if (key?.name === "return") {
            process.stdin.off("keypress", onKeypress)
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false)
            }
            process.stdin.pause()
            startServers(options[selected])
        } else if (key?.ctrl && key?.name === "c") {
            shutdown(0)
        }
    }

    process.stdin.on("keypress", onKeypress)
}

const arg = (process.argv[2] || "").toLowerCase()
const direct = options.find((opt) => opt.id === arg || opt.aliases?.includes(arg))

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

if (direct) {
    startServers(direct)
} else if (!process.stdin.isTTY) {
    startServers(options[0])
} else {
    startInteractive()
}
