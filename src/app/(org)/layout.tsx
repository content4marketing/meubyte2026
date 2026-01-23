import { Sidebar } from '@/components/org/sidebar'

export default function OrgLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />

            {/* Main content */}
            <div className="lg:pl-64">
                <main className="min-h-screen">
                    {children}
                </main>
            </div>
        </div>
    )
}
