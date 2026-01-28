import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function SubjectLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/subject/wallet" className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-600 rounded-lg">
                            <Shield className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-semibold text-gray-900">MeuByte</span>
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className="pt-16 pb-20">
                <div className="max-w-lg mx-auto px-4">
                    {children}
                </div>
            </main>

            {/* Bottom navigation (PWA style) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb">
                <div className="max-w-lg mx-auto flex justify-around py-2">
                    <Link href="/subject/wallet" className="flex flex-col items-center gap-1 px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span className="text-xs">Carteira</span>
                    </Link>
                    <Link href="/subject/share" className="flex flex-col items-center gap-1 px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span className="text-xs">Compartilhar</span>
                    </Link>
                </div>
            </nav>
        </div>
    )
}
