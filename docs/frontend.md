# Frontend

React + Vite + TypeScript + Tailwind CSS.

## Structure

```
src/
├── components/
│   ├── feature/        # Business components
│   │   ├── CourseCard.tsx
│   │   ├── Quiz.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── CloudflareStreamPlayer.tsx
│   │   └── ...
│   ├── layout/         # Layout components
│   │   ├── AppRoutes.tsx
│   │   ├── BottomNav.tsx
│   │   ├── MobileLayout.tsx
│   │   └── DashLayout.tsx
│   └── ui/             # Base UI components (shadcn)
│       ├── button.tsx
│       ├── drawer.tsx
│       └── ...
├── hooks/
│   ├── useApi.ts           # Data fetching hooks
│   ├── useSupport.ts       # Support chat hooks
│   └── useCloudflareStream.tsx
├── lib/
│   ├── api.ts          # API client
│   ├── demo.ts         # Demo mode utilities
│   ├── telegram.ts     # Telegram WebApp utils
│   ├── markdown.ts     # Markdown parser (with DOMPurify)
│   ├── i18n.tsx        # Internationalization
│   └── utils.ts        # Utility functions
├── locales/
│   ├── en.json
│   ├── ru.json
│   └── uk.json
├── pages/
│   ├── HomePage.tsx
│   ├── CoursePage.tsx
│   ├── LessonPage.tsx
│   ├── MyCoursesPage.tsx
│   ├── ProfilePage.tsx
│   ├── SupportPage.tsx
│   ├── DashHomePage.tsx
│   ├── DashUsersPage.tsx
│   ├── DashTransactionsPage.tsx
│   ├── DashReviewsPage.tsx
│   ├── DashCoursesPage.tsx
│   └── DashSupportPage.tsx
├── assets/
├── App.tsx
├── index.css
└── main.tsx
```

## Routing

```
/                       HomePage
/course/:id             CoursePage
/course/:id/learn       LessonPage (fullscreen, no bottom nav)
/my-courses             MyCoursesPage
/profile                ProfilePage
/support                SupportPage

/dash                   DashHomePage (admin)
/dash/users             DashUsersPage
/dash/transactions      DashTransactionsPage
/dash/reviews           DashReviewsPage
/dash/courses           DashCoursesPage
/dash/support           DashSupportPage
```

## API Client

```typescript
import * as api from '@/lib/api'

// Get featured courses
const courses = await api.getFeaturedCourses()

// Get course details
const course = await api.getCourse(id)

// Get lessons (requires purchase)
const lessons = await api.getCourseLessons(courseId)

// Mark lesson complete
await api.markLessonComplete(courseId, lessonId)

// Get user profile
const user = await api.getProfile()

// Submit review
await api.submitReview(courseId, rating, comment)
```

## Data Hooks

```typescript
import {
  useCourses,
  useCourse,
  useCourseLessons,
  useCourseProgress,
  useProfile
} from '@/hooks/useApi'

function Component() {
  const { data, loading, error, refetch } = useCourses()
  // ...
}
```

## Internationalization

```typescript
import { useI18n } from '@/lib/i18n'

function Component() {
  const { t, locale, setLocale } = useI18n()

  return <p>{t('home.welcome')}</p>
}
```

Supported locales: `en`, `ru`, `uk`

Language detected from:
1. Telegram WebApp language
2. Browser language
3. Falls back to `en`

## Telegram Integration

```typescript
import {
  getTelegramUser,
  getTelegramInitData,
  hapticFeedback,
  showPopup,
  openLink
} from '@/lib/telegram'

// Get user info
const user = getTelegramUser()

// Get initData for API calls
const initData = getTelegramInitData()

// Haptic feedback
hapticFeedback('impact', 'medium')

// Show popup
showPopup({ message: 'Hello!' })

// Open link
openLink('https://example.com')
```

## Demo Mode

For development without Telegram WebApp.

```typescript
import { isDemoMode, getDemoProfile, setDemoRole } from '@/lib/demo'

if (isDemoMode()) {
  const profile = getDemoProfile()
  setDemoRole('admin') // or 'user'
}
```

Demo data stored in localStorage with `cg_demo_` prefix.

## Build

```bash
npm run dev       # Development server (localhost:5173)
npm run demo      # Development with VITE_DEMO_MODE=true
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

Output: `dist/`

## Environment

`.env` for development:

```
VITE_API_URL=http://localhost:3001/api
VITE_DEMO_MODE=true
```

Production: API calls use relative URLs (`/api`).

## Styling

- Tailwind CSS for utility classes
- shadcn/ui for base components
- Framer Motion for animations
- Custom CSS in `index.css`

Theme colors defined in `tailwind.config.js`:
- `accentpurple` - Primary accent
- Dark theme by default

## Key Components

### CloudflareStreamPlayer
HLS video player for Cloudflare Stream videos.

### Quiz
Interactive quiz with single/multiple choice questions.

### PurchaseDrawer
Payment flow (PayPal, Telegram Stars).

### ReviewModal
Course review submission.

### HomeHero
Animated wave gradient hero section.
