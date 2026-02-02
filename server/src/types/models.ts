// =====================
// Database Models Types
// =====================

export interface User {
    id: number
    telegram_id: number
    username: string | null
    first_name: string
    last_name: string | null
    photo_url: string | null
    language_code?: string | null
    notifications_enabled: boolean
    has_started: number
    is_blocked_for_reviews?: number
    created_at: Date
    updated_at: Date
}

export interface Course {
    id: number
    title: string
    author: string
    price: number
    rating: number
    category: string
    image_url: string
    description: string | null
    duration: string | null
    is_published: boolean
    created_at: Date
}

export interface CourseModule {
    id: number
    course_id: number
    title: string
    sort_order: number
}

export interface Lesson {
    id: number
    module_id: number
    course_id: number
    title: string
    content: string | null
    type: 'text' | 'image' | 'video' | 'quiz' | 'completion'
    image_url: string | null
    video_url: string | null
    duration_seconds: number | null
    sort_order: number
}

export interface UserCourse {
    id: number
    user_id: number
    course_id: number
    is_favorite: boolean
    purchased_at: Date
}

export interface LessonProgress {
    id: number
    user_id: number
    course_id: number
    lesson_id: number
    completed_at: Date
}

export interface Review {
    id: number
    user_id: number
    course_id: number
    rating: number
    comment: string | null
    is_edited: number
    admin_reply?: string | null
    admin_reply_user_id?: number | null
    admin_reply_is_edited?: number
    admin_reply_created_at?: Date | null
    admin_reply_updated_at?: Date | null
    created_at: Date
    updated_at: Date
}

export interface Transaction {
    id: number
    user_id: number
    course_id: number | null
    payment_id: string | null
    amount: number
    currency: string
    status: 'pending' | 'success' | 'failed' | 'refunded'
    type: 'purchase' | 'subscription' | 'refund'
    notification_message_id: number | null
    created_at: Date
}

export interface QuizQuestion {
    id: number
    lesson_id: number
    question: string
    type: 'single' | 'multiple' | 'text'
    explanation: string | null
    hint: string | null
    points: number
    time_limit: number | null
    sort_order: number
}

export interface QuizAnswer {
    id: number
    question_id: number
    answer_text: string
    is_correct: number
    sort_order: number
}

export interface QuizSettings {
    id: number
    lesson_id: number
    passing_score: number
    max_attempts: number
    shuffle_questions: number
    shuffle_answers: number
    show_explanations: number
    require_pass: number
}

export interface QuizAttempt {
    id: number
    user_id: number
    lesson_id: number
    course_id: number
    score: number
    max_score: number
    percentage: number
    answers_data: string
    time_spent: number | null
    passed: number
    attempt_number: number
    created_at: Date
}

export interface RemedialContent {
    id: number
    lesson_id: number
    title: string
    content: string
    content_type: 'text' | 'video' | 'article' | 'practice'
    media_url: string | null
    sort_order: number
}

export interface VideoAccessLog {
    id: number
    user_id: number
    lesson_id: number
    course_id: number
    ip_address: string | null
    user_agent: string | null
    access_token: string | null
    accessed_at: Date
}

// =====================
// API Response Types
// =====================

export interface CourseResponse {
    id: number
    title: string
    author: string
    authorAvatar?: string
    price: string
    starsPrice?: number
    rating: number
    category: string
    image: string
    description?: string
    lessonsCount?: number
    duration?: string
    program?: string[]
}

export interface CourseDetailResponse extends CourseResponse {
    reviews: ReviewResponse[]
}

export interface ReviewResponse {
    id: number
    user: string
    date: string
    rating: number
    text: string
    isEdited?: boolean
    likes?: number
    dislikes?: number
    myReaction?: number
    reply?: {
        text: string
        author: string
        isEdited?: boolean
        createdAt?: string | null
        updatedAt?: string | null
    }
}

export interface LessonStepResponse {
    id: number
    title: string
    content: string
    type: 'text' | 'image' | 'video' | 'quiz' | 'completion'
    image?: string | null
    video?: string | null
    quiz?: QuizDataResponse | null
}

export interface UserCourseResponse extends CourseResponse {
    variant: 'my-course'
    progress: number
    isFavorite: boolean
}

export interface TransactionResponse {
    id: number
    title: string
    date: string
    amount: string
    status: 'success' | 'failed'
    type: 'purchase' | 'subscription' | 'refund' | 'error'
}

export interface QuizAnswerResponse {
    id: number
    text: string
    isCorrect?: boolean
}

export interface QuizQuestionResponse {
    id: number
    question: string
    type: 'single' | 'multiple' | 'text'
    answers: QuizAnswerResponse[]
    explanation?: string | null
    hint?: string | null
    points: number
    timeLimit?: number | null
}

export interface QuizDataResponse {
    questions: QuizQuestionResponse[]
    settings: {
        passingScore: number
        maxAttempts: number
        shuffleQuestions: boolean
        shuffleAnswers: boolean
        showExplanations: boolean
        requirePass: boolean
    }
    userAttempts?: QuizAttemptResponse[]
    canAttempt: boolean
    bestScore?: number
}

export interface QuizAttemptResponse {
    id: number
    score: number
    maxScore: number
    percentage: number
    passed: boolean
    attemptNumber: number
    timeSpent: number | null
    createdAt: string
    answersData?: any
}

export interface RemedialContentResponse {
    id: number
    title: string
    content: string
    contentType: 'text' | 'video' | 'article' | 'practice'
    mediaUrl?: string | null
}
