import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

type EmojiProps = {
    emoji: string
    label?: string
    className?: string
    size?: number
}

const TWEMOJI_SOURCES = [
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg",
    "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/svg",
    "https://twemoji.maxcdn.com/v/latest/svg",
    "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72",
    "https://cdn.jsdelivr.net/npm/twemoji@14.0.2/72x72",
    "https://twemoji.maxcdn.com/v/latest/72x72",
]

function emojiToCodePoint(emoji: string) {
    return Array.from(emoji)
        .map((char) => char.codePointAt(0)?.toString(16))
        .filter(Boolean)
        .join("-")
}

function getTwemojiSrc(source: string, code: string) {
    const isPng = source.includes("/72x72")
    return `${source}/${code}.${isPng ? "png" : "svg"}`
}

export function Emoji({ emoji, label, className, size = 16 }: EmojiProps) {
    const code = useMemo(() => emojiToCodePoint(emoji), [emoji])
    const [sourceIndex, setSourceIndex] = useState(0)

    const src = useMemo(() => {
        if (!code) return ""
        const source = TWEMOJI_SOURCES[sourceIndex]
        return source ? getTwemojiSrc(source, code) : ""
    }, [code, sourceIndex])

    if (!emoji || !code || !src) {
        return (
            <span className={cn("inline-block", className)} aria-hidden="true">
                {emoji}
            </span>
        )
    }

    return (
        <img
            src={src}
            alt={label || emoji}
            width={size}
            height={size}
            loading="lazy"
            className={cn("inline-block align-[-0.15em]", className)}
            onError={() => setSourceIndex((prev) => prev + 1)}
        />
    )
}
