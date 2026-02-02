import DOMPurify from 'dompurify'

/**
 * Simple Markdown to HTML parser
 * Supports: headings, bold, italic, links, lists, code blocks, line breaks
 * Also processes Cloudflare Stream video embeds
 *
 * Output is sanitized with DOMPurify to prevent XSS attacks
 */

export function parseMarkdown(text: string): string {
    if (!text) return ''

    let html = text

    // First, convert Cloudflare Stream markers to HTML tags
    // These come from backend as {{CLOUDFLARE_STREAM:videoId}}
    const streamTags: string[] = []
    html = html.replace(/\{\{CLOUDFLARE_STREAM:([a-f0-9]{32})\}\}/g, (_, videoId) => {
        const tag = `<cloudflare-stream data-video-id="${videoId}"></cloudflare-stream>`
        streamTags.push(tag)
        return `@@STREAMTAG${streamTags.length - 1}@@`
    })

    // Escape HTML entities first (except for already processed tags)
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    // Code blocks (before other processing)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

    // Headings (must be at start of line)
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-3 mb-1">$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-4 mb-2">$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-4 mb-2">$1</h1>')

    // Bold and Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    html = html.replace(/__(.+?)__/g, '<strong class="text-white font-semibold">$1</strong>')
    html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>')

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accentpurple hover:underline" target="_blank" rel="noopener">$1</a>')

    // Unordered lists
    html = html.replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc text-white/80">$1</li>')

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-white/80">$1</li>')

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => {
        return `<ul class="my-1 space-y-0.5">${match}</ul>`
    })

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr class="my-4 border-white/10">')

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-accentpurple/50 pl-4 my-2 text-white/70 italic">$1</blockquote>')

    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p class="my-3 text-white/80">')

    // Single line breaks
    html = html.replace(/\n/g, '<br>')

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
        html = `<p class="my-3 text-white/80">${html}</p>`
    }

    // Restore Cloudflare Stream tags
    streamTags.forEach((tag, index) => {
        html = html.replace(`@@STREAMTAG${index}@@`, tag)
    })

    // Sanitize HTML to prevent XSS attacks
    return DOMPurify.sanitize(html, {
        ADD_TAGS: ['cloudflare-stream'],
        ADD_ATTR: ['data-video-id', 'class', 'target', 'rel'],
        ALLOW_DATA_ATTR: true
    })
}

/**
 * Strip Markdown formatting (for previews/excerpts)
 */
export function stripMarkdown(text: string): string {
    if (!text) return ''

    return text
        // Replace Cloudflare Stream markers with readable text
        .replace(/\{\{CLOUDFLARE_STREAM:[a-f0-9]{32}\}\}/g, '🎥 Video')
        // Also handle HTML tags if they slip through
        .replace(/<cloudflare-stream[^>]*><\/cloudflare-stream>/g, '🎥 Video')
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`([^`]+)`/g, '$1')    // Inline code
        .replace(/#{1,6}\s/g, '')       // Headings
        .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
        .replace(/\*(.+?)\*/g, '$1')    // Italic
        .replace(/__(.+?)__/g, '$1')    // Bold
        .replace(/_(.+?)_/g, '$1')      // Italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/^[*-] /gm, '')        // List items
        .replace(/^\d+\. /gm, '')       // Ordered list
        .replace(/^>/gm, '')            // Blockquotes
        .replace(/---+/g, '')           // HR
        .replace(/<[^>]+>/g, '')        // Remove any other HTML tags
        .trim()
}
