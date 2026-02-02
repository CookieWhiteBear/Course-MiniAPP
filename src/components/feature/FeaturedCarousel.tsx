import { motion, useScroll, useTransform, useSpring, useVelocity, type MotionValue } from "framer-motion"
import { useRef, useState } from "react"
import { CourseCard } from "./CourseCard"

interface Course {
    id: number
    title: string
    author: string
    authorAvatar?: string
    price: string
    rating: number
    category: string
    image: string
    variant?: 'catalog' | 'my-course'
    progress?: number
    isFavorite?: boolean
}

interface FeaturedCarouselProps {
    courses: Course[]
    onCourseClick?: (_course: Course, _rect: DOMRect) => void
    onToggleFavorite?: (_courseId: number) => void
}

export function FeaturedCarousel({ courses, onCourseClick, onToggleFavorite }: FeaturedCarouselProps) {
    const [selectedId, setSelectedId] = useState<number | null>(null)

    const { scrollY } = useScroll()
    const scrollVelocity = useVelocity(scrollY)
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400
    })

    const velocityRotate = useTransform(smoothVelocity, [-2000, 0, 2000], [-30, 0, 30])
    const velocityScale = useTransform(smoothVelocity, [-2000, 0, 2000], [0.95, 1, 0.95])

    const handleCardClick = (course: Course, event: React.MouseEvent<HTMLDivElement>) => {
        // Prevent click if clicking specific controls if necessary, though current structure is fine
        // If we want to prevent navigation when clicking favorite, we handle that in CourseCard with e.stopPropagation

        setSelectedId(course.id)

        // Capture exact screen coordinates of the clicked card
        const rect = event.currentTarget.getBoundingClientRect()
        onCourseClick?.(course, rect) // Optional call
    }

    return (
        <div className="relative py-10 perspective-container">
            <div className="space-y-12">
                {courses.map((course) => (
                    <CarouselItem
                        key={course.id}
                        course={course}
                        velocityRotate={velocityRotate}
                        velocityScale={velocityScale}
                        isSelected={selectedId === course.id}
                        isAnySelected={selectedId !== null}
                        onClick={(e) => handleCardClick(course, e)}
                        onToggleFavorite={() => onToggleFavorite?.(course.id)}
                    />
                ))}
            </div>
        </div>
    )
}

function CarouselItem({
    course,
    velocityRotate,
    velocityScale,
    isSelected,
    isAnySelected,
    onClick,
    onToggleFavorite
}: {
    course: Course,
    velocityRotate: MotionValue<number>,
    velocityScale: MotionValue<number>,
    isSelected: boolean,
    isAnySelected: boolean,
    onClick: (_event: React.MouseEvent<HTMLDivElement>) => void
    onToggleFavorite?: () => void
}) {
    const itemRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: itemRef,
        offset: ["start end", "end start"]
    })

    // Physics for 3D
    const rotateXTransform = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [30, 0, 0, -30])
    const scaleTransform = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.8, 1, 1, 0.8])
    const opacityTransform = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.4, 1, 1, 0.4])

    const effectiveRotateX = isAnySelected ? 0 : rotateXTransform
    const effectiveScale = isAnySelected ? 1 : scaleTransform
    const effectiveOpacity = isAnySelected ? (isSelected ? 1 : 0) : opacityTransform

    // Disable physics velocity if selected
    const finalRotateX = isAnySelected ? 0 : velocityRotate
    const finalScale = isAnySelected ? 1 : velocityScale

    return (
        <motion.div
            ref={itemRef}
            style={{
                rotateX: effectiveRotateX,
                scale: effectiveScale,
                opacity: effectiveOpacity,
                width: "100%",
                maxWidth: "480px",
                margin: "0 auto",
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                zIndex: isSelected ? 50 : 0
            }}
            className="perspective-1000"
        >
            <motion.div
                style={{
                    rotateX: finalRotateX,
                    scale: finalScale,
                    transformOrigin: "center center",
                    backfaceVisibility: "hidden"
                }}
                onClick={onClick}
            >
                <CourseCard
                    {...course}
                    showFavorite={false}
                    onToggleFavorite={(e) => {
                        e.stopPropagation() // Prevent card click (navigation)
                        onToggleFavorite?.()
                    }}
                />
            </motion.div>
        </motion.div>
    )
}
