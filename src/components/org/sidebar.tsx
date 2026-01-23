'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    FileText,
    Users,
    ListTodo,
    Settings,
    Menu,
    X,
    LogOut,
    Building2,
    QrCode
} from 'lucide-react'

interface SidebarProps {
    orgName?: string
    userName?: string
}

const navigation = [
    { name: 'Dashboard', href: '/org/dashboard', icon: LayoutDashboard },
    { name: 'Receber', href: '/org/receive', icon: QrCode },
    { name: 'Templates', href: '/org/templates', icon: FileText },
    { name: 'Fila', href: '/org/queue', icon: ListTodo },
    { name: 'Usuários', href: '/org/users', icon: Users },
    { name: 'Configurações', href: '/org/settings', icon: Settings },
]

export function Sidebar({ orgName = 'Minha Organização', userName = 'Usuário' }: SidebarProps) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <>
            {/* Mobile menu button */}
            <button
                type="button"
                className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300',
                    'lg:translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Logo/Org header */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Building2 className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-sm font-semibold text-gray-900 truncate">{orgName}</h2>
                                <p className="text-xs text-gray-500">Painel Admin</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname?.startsWith(item.href)
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    )}
                                >
                                    <item.icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : 'text-gray-400')} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-9 w-9 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                    {userName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                                <p className="text-xs text-gray-500">Admin</p>
                            </div>
                        </div>
                        <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                            <LogOut className="h-4 w-4" />
                            Sair
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
