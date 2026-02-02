import { Router } from 'express'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { webhookRateLimiter } from '../middleware/rateLimit.middleware.js'

// Controllers
import * as courseController from '../controllers/course.controller.js'
import * as userController from '../controllers/user.controller.js'
import * as reviewController from '../controllers/review.controller.js'
import * as progressController from '../controllers/progress.controller.js'
import * as paypalController from '../controllers/paypal.controller.js'
import * as telegramStarsController from '../controllers/telegram-stars.controller.js'
import * as quizController from '../controllers/quiz.controller.js'
import * as videoController from '../controllers/video.controller.js'
import * as dynamicCourseController from '../controllers/dynamic-course.controller.js'
import * as telegramController from '../controllers/telegram.controller.js'
import * as cloudflareStreamController from '../controllers/cloudflare-stream.controller.js'
import * as supportController from '../controllers/support.controller.js'
import * as adminController from '../controllers/admin.controller.js'
import * as configController from '../controllers/config.controller.js'
import * as bootstrapController from '../controllers/bootstrap.controller.js'

const router = Router()

// ==================
// Course Routes
// ==================
router.get('/courses/featured', courseController.getFeaturedCourses)
router.get('/courses/:id', optionalAuthMiddleware, courseController.getCourseById)
router.get('/courses/:id/lessons', authMiddleware, courseController.getCourseLessons)
router.get('/courses/:id/reviews', optionalAuthMiddleware, courseController.getCourseReviews)

// ==================
// Public UI Config
// ==================
router.get('/config/ui', configController.getUiConfig)

// ==================
// User Routes
// ==================
router.get('/bootstrap', authMiddleware, bootstrapController.getBootstrap)
router.get('/user/profile', authMiddleware, userController.getProfile)
router.put('/user/settings', authMiddleware, userController.updateSettings)
router.get('/user/courses', authMiddleware, userController.getUserCourses)
router.put('/user/courses/:id/favorite', authMiddleware, userController.toggleFavorite)
router.get('/user/transactions', authMiddleware, userController.getTransactions)

// ==================
// Progress Routes
// ==================
router.post('/progress/:courseId/lesson/:lessonId', authMiddleware, progressController.markLessonComplete)
router.get('/progress/:courseId', authMiddleware, progressController.getCourseProgress)

// ==================
// Quiz Routes
// ==================
router.get('/quiz/:lessonId', authMiddleware, quizController.getQuizData)
router.post('/quiz/:lessonId/submit', authMiddleware, quizController.submitQuizAttempt)
router.get('/quiz/:lessonId/remedial', authMiddleware, quizController.getRemedialContent)

// ==================
// Video Routes
// ==================
router.post('/video/access/:lessonId', authMiddleware, videoController.generateVideoAccess)
router.get('/video/verify/:token', videoController.verifyVideoToken)
router.get('/video/analytics/:courseId', authMiddleware, videoController.getVideoAnalytics)
router.post('/video/report-piracy', videoController.reportPiracy)

// ==================
// Cloudflare Stream Routes
// ==================
router.post('/stream/sign-url', authMiddleware, cloudflareStreamController.generateSignedUrl)
router.get('/stream/metadata/:videoId', authMiddleware, cloudflareStreamController.getVideoMetadata)
router.get('/stream/analytics/:videoId', authMiddleware, cloudflareStreamController.getVideoAnalytics)
router.get('/stream/validate/:videoId', cloudflareStreamController.validateVideoId)

// ==================
// Review Routes
// ==================
router.post('/reviews', authMiddleware, reviewController.createReview)
router.get('/reviews/:courseId/me', authMiddleware, reviewController.getMyReview)
router.post('/reviews/:id/reaction', authMiddleware, reviewController.setReviewReaction)
router.post('/reviews/:id/reply', authMiddleware, adminMiddleware, reviewController.replyToReview)
router.delete('/reviews/:id', authMiddleware, adminMiddleware, reviewController.deleteReview)

// ==================
// Purchase Routes
// ==================
router.post('/purchase/create', authMiddleware, paypalController.createPurchaseOrder)
router.post('/purchase/telegram-stars', authMiddleware, telegramStarsController.createStarsInvoiceLink)

// ==================
// Dynamic Course Routes (Filesystem-based)
// ==================
router.get('/dynamic/courses/:id', dynamicCourseController.getDynamicCourse)
router.get('/dynamic/courses/:id/lessons', authMiddleware, dynamicCourseController.getDynamicCourseLessons)
router.post('/dynamic/quiz/:courseId/:lessonId/submit', authMiddleware, dynamicCourseController.submitDynamicQuizAttempt)
router.get('/dynamic/quiz/:courseId/:lessonId/remedial', authMiddleware, dynamicCourseController.getDynamicRemedialContent)

// ==================
// Webhook Routes
// ==================
// Test endpoint to verify webhook URL is accessible
router.get('/webhooks/paypal/test', paypalController.testWebhookEndpoint)
router.get('/paypal-hook/test', paypalController.testWebhookEndpoint)
// PayPal webhook handlers
router.post('/webhooks/paypal', webhookRateLimiter, paypalController.handlePayPalWebhook)
router.post('/paypal-hook', webhookRateLimiter, paypalController.handlePayPalWebhook)
// Telegram bot webhook
router.post('/webhooks/telegram', webhookRateLimiter, telegramController.handleTelegramWebhook)

// ==================
// Support/Tickets
// ==================
router.get('/support/messages', authMiddleware, supportController.getMessages)
router.get('/support/messages/:userId', authMiddleware, adminMiddleware, supportController.getMessagesForUser)
router.post('/support/messages', authMiddleware, supportController.sendMessage)
router.put('/support/messages/:id', authMiddleware, adminMiddleware, supportController.editMessage)
router.delete('/support/messages/:id', authMiddleware, adminMiddleware, supportController.deleteMessage)
router.post('/support/messages/read', authMiddleware, supportController.markAsRead)
router.get('/support/unread-count', authMiddleware, supportController.getUnreadCount)
router.get('/support/users', authMiddleware, adminMiddleware, supportController.getSupportUsers)
router.get('/support/users/search', authMiddleware, adminMiddleware, supportController.searchSupportUsers)

// ==================
// Admin tools
// ==================
router.get('/admin/metrics', authMiddleware, adminMiddleware, adminController.getMetrics)
router.get('/admin/users', authMiddleware, adminMiddleware, adminController.listUsers)
router.patch('/admin/users/:userId', authMiddleware, adminMiddleware, adminController.updateUser)
router.get('/admin/users/:userId/overview', authMiddleware, adminMiddleware, adminController.getUserOverview)
router.post('/admin/users/:userId/courses/:courseId', authMiddleware, adminMiddleware, adminController.grantCourseToUser)
router.delete('/admin/users/:userId/courses/:courseId', authMiddleware, adminMiddleware, adminController.revokeCourseFromUser)
router.get('/admin/transactions', authMiddleware, adminMiddleware, adminController.listTransactions)
router.get('/admin/reviews', authMiddleware, adminMiddleware, adminController.listReviews)
router.get('/admin/courses', authMiddleware, adminMiddleware, adminController.listCourses)

export default router
