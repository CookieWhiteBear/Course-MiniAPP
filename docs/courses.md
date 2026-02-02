# Courses

Courses are loaded from filesystem. Metadata comes from `config.yaml`, lessons from `courses/` directory.

## Directory Structure

```
courses/
├── 1/
│   ├── 1.md
│   ├── 2.md
│   ├── 3.md
│   ├── remcon.md
│   └── ...
├── 2/
│   ├── 1.md
│   ├── 2.md
│   └── ...
└── ...
```

Location: `courses/` (relative to cwd, or `COURSES_DIR` env var)

## Course Metadata

Defined in `config.yaml` under `courses:` section:

```yaml
courses:
  - id: 1
    title: Course Title
    authorId: demo
    description: Course description
    category: Category
    imageUrl: https://...
    duration: 6h 30m
    price: 9.99
    starsPrice: 100
    currency: USD
    visibility: public
    program:
      - "<ico:video> Getting started"
      - "<ico:read> Core concepts"
```

### Program Icons

```
<ico:video>    - Video lesson
<ico:read>     - Text lesson
<ico:quiz>     - Quiz
<ico:practice> - Practice
<ico:project>  - Project
<ico:live>     - Live session
<ico:file>     - File/Download
<ico:clock>    - Timed content
<ico:code>     - Code exercise
```

## Authors

Defined in `config.yaml` under `authors:` section:

```yaml
authors:
  - id: demo
    name: Demo Instructor
    avatarUrl: https://...
```

## Lesson Files

Files must be numbered: `1.md`, `2.md`, `3.md`, etc.

Sorted numerically by filename.

### Text Lesson

```markdown
# Lesson Title

Content in markdown format.

**Bold**, *italic*, `code`

- List items
- More items
```

### With Images

```markdown
# Lesson with Image

<img:image.png>

More text...
```

Tag: `<img:filename>` - relative to course directory.

### With Video

Local video:
```markdown
<vid:video.mp4>
```

Cloudflare Stream video:
```markdown
<vid:abc123def456789012345678901234ab>
```

Or with full URL:
```markdown
<vid:https://customer-xxx.cloudflarestream.com/abc123.../manifest/video.m3u8>
```

### Quiz Lesson

Quizzes are markdown files with special tags:

```markdown
<quiz:single>
<quiz-remcon:remcon.md>

# What is 2+2?

1. 3
2. 4
3. 5

<q:2>

# Which color is the sky?

1. Red
2. Green
3. Blue

<q:3>
```

Quiz tags:
- `<quiz:single>` - single correct answer
- `<quiz:multi>` - multiple correct answers
- `<quiz-remcon:filename>` - remedial content file (shown on failure)
- `# Question text` - question (heading)
- `1. Answer` - answer options (numbered list)
- `<q:N>` - marks answer N as correct (1-indexed)

### Remedial Content

Separate markdown file referenced by `<quiz-remcon:filename>`:

```markdown
# Review Material

Here's what you need to know...

<vid:explanation-video-id>

Key points:
- Point 1
- Point 2
```

## File Types

| Extension | Lesson Type |
|-----------|-------------|
| `.md` | Text (or Quiz if contains `<quiz:>`) |
| `.mp4`, `.webm`, `.mov`, `.avi` | Video |
| `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | Image |

## Example Course

```
courses/1/
├── 1.md          # Intro text lesson
├── 2.md          # Text with video embed
├── 3.md          # Quiz lesson
├── remcon.md     # Remedial content for quiz
└── 4.md          # Conclusion
```

`1.md`:
```markdown
# Welcome to the Course

This course will teach you...
```

`2.md`:
```markdown
# Video Lesson

Watch this explanation:

<vid:abc123def456789012345678901234ab>

Key takeaways:
- Point 1
- Point 2
```

`3.md`:
```markdown
<quiz:single>
<quiz-remcon:remcon.md>

# What did you learn?

1. Nothing
2. Something useful
3. Everything

<q:2>
```

`remcon.md`:
```markdown
# Review the Material

Go back and watch the video again. Pay attention to:
- Key concept 1
- Key concept 2
```
