export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Simple header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <h1 className="text-lg font-semibold text-gray-900">Visualização de Dados</h1>
                    <p className="text-sm text-gray-500">Acesso protegido por token</p>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-2xl mx-auto px-4 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 mt-auto">
                <div className="max-w-2xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
                    <p>Todos os acessos são registrados para fins de auditoria.</p>
                    <p className="mt-1">Powered by <span className="font-medium">MeuByte</span></p>
                </div>
            </footer>
        </div>
    )
}
