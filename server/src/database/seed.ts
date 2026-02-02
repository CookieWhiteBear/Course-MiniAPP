import { getDB, closeDB, insert } from '../config/database.js'

function seed() {
    console.log('🌱 Seeding database...')

    try {
        const db = getDB()

        // Check if course already exists
        const existing = db.prepare('SELECT id FROM courses WHERE title = ?').get('Web Development Fundamentals')

        let courseId: number

        if (existing) {
            courseId = (existing as any).id
            console.log(`📚 Course already exists with ID: ${courseId}`)
        } else {
            // Insert main course
            courseId = insert(`
                INSERT INTO courses (title, author, price, rating, category, image_url, description, duration, is_published)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'Web Development Fundamentals',
                'Course Platform',
                29.99,
                4.9,
                'General',
                'https://i.imgur.com/zOlPMhT.png',
                'Learn HTML, CSS, and JavaScript from scratch. Build responsive websites.',
                '2h 30m',
                1 // is_published
            ])

            console.log(`📚 Course created with ID: ${courseId}`)
        }

        // Check for module
        const existingModule = db.prepare('SELECT id FROM course_modules WHERE course_id = ?').get(courseId)

        let moduleId: number

        if (existingModule) {
            moduleId = (existingModule as any).id
        } else {
            // Insert module
            moduleId = insert(`
                INSERT INTO course_modules (course_id, title, sort_order)
                VALUES (?, ?, ?)
            `, [courseId, 'Full Course', 1])
        }

        // Delete existing lessons for this course
        db.prepare('DELETE FROM lessons WHERE course_id = ?').run(courseId)

        // Insert lessons
        const lessons = [
            {
                title: 'Introduction',
                content: 'Welcome to Web Development Fundamentals! In this course, you\'ll learn the core technologies that power the modern web: HTML, CSS, and JavaScript.',
                type: 'text',
                image_url: 'https://i.imgur.com/zOlPMhT.png',
                video_url: null,
                sort_order: 1
            },
            {
                title: 'HTML Basics',
                content: '• **HTML** stands for HyperText Markup Language\\n• It provides the structure of web pages\\n• Tags define elements like headings, paragraphs, links\\n• DOCTYPE declares the document type',
                type: 'text',
                image_url: null,
                video_url: null,
                sort_order: 2
            },
            {
                title: 'CSS Styling',
                content: '• **CSS** stands for Cascading Style Sheets\\n• Selectors target HTML elements\\n• Properties define how elements look\\n• Flexbox and Grid for layouts',
                type: 'text',
                image_url: null,
                video_url: null,
                sort_order: 3
            },
            {
                title: 'JavaScript Basics',
                content: '• Variables: const, let, var\\n• Functions: regular and arrow\\n• DOM manipulation\\n• Event listeners',
                type: 'text',
                image_url: null,
                video_url: null,
                sort_order: 4
            },
            {
                title: 'Practical Demo',
                content: '1. Create HTML structure\\n2. Add CSS styles\\n3. Make it interactive with JavaScript\\n4. Test in browser\\n5. Deploy your project',
                type: 'video',
                image_url: null,
                video_url: '/assets/videos/video.mp4',
                sort_order: 5
            },
            {
                title: 'Course Complete! 🎉',
                content: 'Congratulations! You\'ve learned the fundamentals of web development. Now go build something amazing!',
                type: 'completion',
                image_url: null,
                video_url: null,
                sort_order: 6
            }
        ]

        const insertLesson = db.prepare(`
            INSERT INTO lessons (module_id, course_id, title, content, type, image_url, video_url, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const lesson of lessons) {
            insertLesson.run(
                moduleId,
                courseId,
                lesson.title,
                lesson.content,
                lesson.type,
                lesson.image_url,
                lesson.video_url,
                lesson.sort_order
            )
        }

        console.log(`📝 Created ${lessons.length} lessons`)
        console.log('✅ Seeding completed!')
        closeDB()
    } catch (error) {
        console.error('❌ Seeding failed:', error)
        closeDB()
        process.exit(1)
    }
}

seed()
