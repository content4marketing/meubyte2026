import { Shield } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
            {/* Header */}
            <header className="p-6">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white">MeuByte</span>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {children}
                </div>
            </main>

            {/* Footer */}
            <footer className="p-6 text-center text-white/60 text-sm">
                <p>Compartilhamento seguro de dados pessoais</p>
            </footer>
        </div>
    )
}
