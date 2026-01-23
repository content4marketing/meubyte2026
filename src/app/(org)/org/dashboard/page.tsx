import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import {
    Users,
    FileText,
    ListTodo,
    Clock,
    ArrowUpRight,
    QrCode
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Mock stats for now - will be replaced with real data
    const stats = {
        sessionsToday: 12,
        inQueue: 3,
        attended: 9,
        avgTime: '4:32'
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Visão geral do atendimento</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card variant="bordered">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Sessões hoje</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.sessionsToday}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="bordered">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Na fila</p>
                                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.inQueue}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <ListTodo className="h-6 w-6 text-yellow-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="bordered">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Atendidas</p>
                                <p className="text-3xl font-bold text-green-600 mt-1">{stats.attended}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <Users className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card variant="bordered">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Tempo médio</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgTime}</p>
                            </div>
                            <div className="p-3 bg-gray-100 rounded-lg">
                                <Clock className="h-6 w-6 text-gray-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Card variant="bordered" className="hover:border-blue-300 transition-colors">
                    <Link href="/org/queue" className="block">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-600 rounded-lg">
                                        <ListTodo className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Fila de Atendimento</h3>
                                        <p className="text-sm text-gray-500">Gerenciar sessões ativas</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {stats.inQueue > 0 && (
                                        <Badge variant="warning">{stats.inQueue}</Badge>
                                    )}
                                    <ArrowUpRight className="h-5 w-5 text-gray-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Link>
                </Card>

                <Card variant="bordered" className="hover:border-blue-300 transition-colors">
                    <Link href="/org/templates" className="block">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-600 rounded-lg">
                                        <QrCode className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Gerar QR Code</h3>
                                        <p className="text-sm text-gray-500">Criar novo ponto de coleta</p>
                                    </div>
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>
            </div>

            {/* Recent Sessions */}
            <Card variant="bordered">
                <CardHeader>
                    <CardTitle>Sessões Recentes</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {/* Placeholder for sessions list */}
                        <div className="px-6 py-12 text-center text-gray-500">
                            <p>Nenhuma sessão recente</p>
                            <p className="text-sm mt-1">As sessões do dia aparecerão aqui</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
