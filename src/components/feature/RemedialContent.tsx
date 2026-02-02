import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Video, FileText, PenTool, X, ArrowLeft } from 'lucide-react'
import { Button } from '../ui/button'
import type { RemedialContent as RemedialContentType } from '../../lib/api'
import { getRemedialContent } from '../../lib/api'
import { parseMarkdown, stripMarkdown } from '../../lib/markdown'
import { useI18n } from '@/lib/i18n'

interface RemedialContentProps {
    courseId: number
    lessonId: number
    onClose: () => void
    onRetry: () => void
}

export function RemedialContent({ courseId, lessonId, onClose, onRetry }: RemedialContentProps) {
    const [content, setContent] = useState<RemedialContentType[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedItem, setSelectedItem] = useState<RemedialContentType | null>(null)
    const { t } = useI18n()

    useEffect(() => {
        loadContent()
    }, [courseId, lessonId])

    const loadContent = async () => {
        try {
            setLoading(true)
            const data = await getRemedialContent(courseId, lessonId)
            setContent(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.loadingError'))
        } finally {
            setLoading(false)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'video':
                return <Video className="w-5 h-5" />
            case 'article':
                return <FileText className="w-5 h-5" />
            case 'practice':
                return <PenTool className="w-5 h-5" />
            default:
                return <BookOpen className="w-5 h-5" />
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'video':
                return t('remedial.type.video')
            case 'article':
                return t('remedial.type.article')
            case 'practice':
                return t('remedial.type.practice')
            default:
                return t('remedial.type.text')
        }
    }

    if (loading) {
        return (
            <div className="remedial-content p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-white/60">{t('remedial.loading')}</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="remedial-content p-6 text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={onClose} variant="outline">
                    {t('remedial.close')}
                </Button>
            </div>
        )
    }

    // Detail view
    if (selectedItem) {
        return (
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="remedial-detail"
            >
                <div className="sticky top-0 z-10 pb-4 border-b border-white/10 mb-6 bg-gradient-to-b from-[#0f0a1a] via-[#0f0a1a] to-transparent backdrop-blur-sm pt-2">
                    <button
                        onClick={() => setSelectedItem(null)}
                        className="flex items-center gap-2 text-accentpurple hover:text-accentpurple/80 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('remedial.backToList')}
                    </button>
                    <h2 className="text-2xl font-bold text-white">{selectedItem.title}</h2>
                    <span className="inline-flex items-center gap-1 text-sm text-white/60 mt-2">
                        {getIcon(selectedItem.contentType)}
                        {getTypeLabel(selectedItem.contentType)}
                    </span>
                </div>

                <div className="remedial-detail-content">
                    {selectedItem.contentType === 'video' && selectedItem.mediaUrl && (
                        <div className="mb-6">
                            <video
                                src={selectedItem.mediaUrl}
                                controls
                                className="w-full rounded-lg"
                            />
                        </div>
                    )}

                    <div className="prose prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedItem.content) }} />
                    </div>

                    {selectedItem.mediaUrl && selectedItem.contentType !== 'video' && (
                        <div className="mt-6">
                            <a
                                href={selectedItem.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accentpurple hover:text-accentpurple/80 underline"
                            >
                                {t('remedial.openExtra')}
                            </a>
                        </div>
                    )}
                </div>
            </motion.div>
        )
    }

    // List view
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="remedial-content"
        >
            <div className="sticky top-0 z-10 pb-4 border-b border-white/10 mb-6 bg-gradient-to-b from-[#0f0a1a] via-[#0f0a1a] to-transparent backdrop-blur-sm pt-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">
                        {t('remedial.title')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>
                <p className="text-white/60 mt-2">
                    {t('remedial.subtitle')}
                </p>
            </div>

            {content.length === 0 ? (
                <div className="text-center py-8">
                    <BookOpen className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">
                        {t('remedial.empty')}
                    </p>
                </div>
            ) : (
                <div className="space-y-4 mb-6">
                    {content.map((item) => (
                        <motion.button
                            key={item.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedItem(item)}
                            className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:border-accentpurple/30 hover:bg-white/10 transition-all text-left"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-accentpurple/20 rounded-lg flex items-center justify-center flex-shrink-0 text-accentpurple">
                                    {getIcon(item.contentType)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white mb-1">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm text-white/60 line-clamp-2">
                                        {stripMarkdown(item.content).substring(0, 150)}...
                                    </p>
                                    <span className="text-xs text-accentpurple mt-2 inline-block">
                                        {getTypeLabel(item.contentType)}
                                    </span>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}

            <div className="pt-4 border-t border-white/10">
                <Button onClick={onRetry} className="w-full">
                    {t('remedial.retry')}
                </Button>
            </div>
        </motion.div>
    )
}
