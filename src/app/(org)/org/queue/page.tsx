'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Alert } from '@/components/ui'
import { Clock, User, Eye, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { relativeTime } from '@/lib/utils'

interface Session {
    id: string
    ticket_code: string
    status: 'queued' | 'in_service' | 'ended' | 'expired'
    created_at: string
    expires_at: string
    claimed_at: string | null
    claimed_by: string | null
    templates: {
        name: string
        code_short: string
    }
}

export default function QueuePage() {
    const supabase = createClient()

    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Load sessions
    const loadSessions = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: member } = await supabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', user.id)
                .single()

            if (!member) return

            const { data } = await supabase
                .from('sessions')
                .select(`
          id,
          ticket_code,
          status,
          created_at,
          expires_at,
          claimed_at,
          claimed_by,
          templates(name, code_short)
        `)
                .eq('org_id', member.org_id)
                .in('status', ['queued', 'in_service'])
                .order('created_at', { ascending: false })

            if (data) setSessions(data as unknown as Session[])
        } catch (err) {
            console.error('Error loading sessions:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSessions()

        // Set up realtime subscription
        const channel = supabase
            .channel('sessions-queue')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sessions'
                },
                () => {
                    loadSessions()
                }
            )
            .subscribe()

        // Refresh every 30 seconds
        const interval = setInterval(loadSessions, 30000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(interval)
        }
    }, [supabase])

    const claimSession = async (sessionId: string) => {
        setClaiming(sessionId)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Não autenticado')

            const { data: member } = await supabase
                .from('org_members')
                .select('id')
                .eq('user_id', user.id)
                .single()

            if (!member) throw new Error('Membro não encontrado')

            // Atomic claim - only succeeds if status is still 'queued'
            const { error: updateError } = await supabase
                .from('sessions')
                .update({
                    status: 'in_service',
                    claimed_by: member.id,
                    claimed_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .eq('status', 'queued') // Atomic check

            if (updateError) throw updateError

            // Navigate to session view
            window.location.href = `/org/queue/${sessionId}`

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao assumir sessão')
        } finally {
            setClaiming(null)
        }
    }

    const queuedSessions = sessions.filter(s => s.status === 'queued')
    const inServiceSessions = sessions.filter(s => s.status === 'in_service')

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'queued':
                return <Badge variant="warning">Na Fila</Badge>
            case 'in_service':
                return <Badge variant="info">Em Atendimento</Badge>
            case 'ended':
                return <Badge variant="success">Encerrada</Badge>
            case 'expired':
                return <Badge variant="default">Expirada</Badge>
            default:
                return <Badge>{status}</Badge>
        }
    }

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Fila de Atendimento</h1>
                    <p className="text-gray-600 mt-1">
                        {queuedSessions.length} na fila • {inServiceSessions.length} em atendimento
                    </p>
                </div>
                <Button variant="outline" onClick={loadSessions}>
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                </Button>
            </div>

            {error && (
                <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} variant="bordered">
                            <CardContent className="p-6">
                                <div className="animate-pulse flex gap-4">
                                    <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <Card variant="bordered">
                    <CardContent className="py-16 text-center">
                        <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                            <Clock className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Fila vazia
                        </h3>
                        <p className="text-gray-500">
                            Nenhuma sessão aguardando atendimento no momento
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Queued Sessions */}
                    {queuedSessions.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Aguardando ({queuedSessions.length})
                            </h2>
                            <div className="grid gap-4">
                                {queuedSessions.map((session) => (
                                    <Card key={session.id} variant="bordered" className="hover:border-yellow-300 transition-colors">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-yellow-100 rounded-lg">
                                                        <span className="text-2xl font-bold text-yellow-700">
                                                            {session.ticket_code}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {session.templates?.name || 'Template'}
                                                        </p>
                                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {relativeTime(session.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {getStatusBadge(session.status)}
                                                    <Button
                                                        onClick={() => claimSession(session.id)}
                                                        loading={claiming === session.id}
                                                    >
                                                        <User className="h-4 w-4" />
                                                        Atender
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* In Service Sessions */}
                    {inServiceSessions.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Em Atendimento ({inServiceSessions.length})
                            </h2>
                            <div className="grid gap-4">
                                {inServiceSessions.map((session) => (
                                    <Card key={session.id} variant="bordered" className="border-blue-200">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-blue-100 rounded-lg">
                                                        <span className="text-2xl font-bold text-blue-700">
                                                            {session.ticket_code}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {session.templates?.name || 'Template'}
                                                        </p>
                                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            Iniciado {session.claimed_at ? relativeTime(session.claimed_at) : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {getStatusBadge(session.status)}
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => window.location.href = `/org/queue/${session.id}`}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Ver
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
