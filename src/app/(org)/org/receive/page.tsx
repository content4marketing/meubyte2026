'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Alert, Input, Badge } from '@/components/ui'
import { deriveTokenKey } from '@/lib/crypto'
import { decryptShareData } from '@/lib/crypto/zk-share'
import { Clock, Shield, CheckCircle } from 'lucide-react'
import { formatCPF, formatPhone, formatDate } from '@/lib/utils'

interface SharePayload {
    meta: {
        orgSlug: string
        orgName: string
        templateId: string
        templateName: string
        createdAt: string
    }
    fields: Array<{
        slug: string
        label: string
        value: string
    }>
}

function formatValue(slug: string, value: string) {
    if (slug === 'cpf') return formatCPF(value)
    if (slug === 'phone') return formatPhone(value)
    if (slug === 'birth_date') return formatDate(value)
    return value
}

export default function ReceivePage() {
    const supabase = useMemo(() => createClient(), [])
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    const [orgSlug, setOrgSlug] = useState<string | null>(null)
    const [orgId, setOrgId] = useState<string | null>(null)
    const [orgName, setOrgName] = useState<string | null>(null)
    const [token, setToken] = useState('')
    const [status, setStatus] = useState<'idle' | 'waiting' | 'viewing' | 'expired'>('idle')
    const [payload, setPayload] = useState<SharePayload | null>(null)
    const [expiresAt, setExpiresAt] = useState<number | null>(null)
    const [remaining, setRemaining] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadOrg = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setError('Não autenticado')
                return
            }

            const { data: member } = await supabase
                .from('org_members')
                .select('org_id, orgs(name, slug)')
                .eq('user_id', user.id)
                .single()

            if (!member) {
                setError('Organização não encontrada')
                return
            }

            const orgData = Array.isArray(member.orgs) ? member.orgs[0] : member.orgs
            setOrgId(member.org_id)
            setOrgSlug(orgData?.slug || null)
            setOrgName(orgData?.name || null)
        }

        loadOrg()
    }, [supabase])

    useEffect(() => {
        if (!expiresAt) return

        const interval = setInterval(() => {
            const diff = expiresAt - Date.now()
            if (diff <= 0) {
                clearInterval(interval)
                setRemaining('0:00')
                setStatus('expired')
                setPayload(null)
                return
            }

            const minutes = Math.floor(diff / 60000)
            const seconds = Math.floor((diff % 60000) / 1000)
            setRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)

        return () => clearInterval(interval)
    }, [expiresAt])

    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [supabase])

    const normalizeToken = (value: string) => {
        return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    }

    const startListening = async () => {
        if (!orgSlug) return
        const cleaned = normalizeToken(token)
        if (!cleaned) {
            setError('Informe o código recebido do titular')
            return
        }

        setError(null)
        setStatus('waiting')
        setPayload(null)
        setExpiresAt(null)

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
        }

        const channel = supabase.channel(`share:${orgSlug}:${cleaned}`, {
            config: {
                broadcast: { self: false }
            }
        })

        channel.on('broadcast', { event: 'payload' }, async (event) => {
            try {
                const key = await deriveTokenKey(cleaned, orgSlug)
                const decrypted = await decryptShareData(event.payload, key) as SharePayload

                setPayload(decrypted)
                setStatus('viewing')
                setExpiresAt(Date.now() + 10 * 60 * 1000)

                if (orgId) {
                    const { error: logError } = await supabase
                        .from('share_events')
                        .insert({
                            org_id: orgId,
                            template_id: decrypted.meta.templateId,
                            fields: decrypted.fields.map((field) => field.slug),
                            event_type: 'received',
                            metadata: {
                                org_slug: decrypted.meta.orgSlug,
                                template_name: decrypted.meta.templateName,
                                field_count: decrypted.fields.length
                            }
                        })

                    if (logError) {
                        console.warn('Failed to log share event:', logError)
                    }
                }
            } catch (err) {
                console.error('Decrypt error:', err)
                setError('Não foi possível decifrar os dados recebidos.')
                setStatus('idle')
            }
        })

        channel.subscribe((statusValue) => {
            if (statusValue === 'SUBSCRIBED') {
                channel.send({
                    type: 'broadcast',
                    event: 'ready',
                    payload: { at: new Date().toISOString() }
                })
            }
        })

        channelRef.current = channel
    }

    const resetSession = () => {
        setStatus('idle')
        setPayload(null)
        setToken('')
        setRemaining(null)
        setExpiresAt(null)
        setError(null)

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
    }

    return (
        <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Receber dados</h1>
                    <p className="text-gray-600 mt-1">
                        {orgName ? `Organização: ${orgName}` : 'Aguardando organização...'}
                    </p>
                </div>
                {status === 'viewing' && (
                    <Badge variant="info">Ativo</Badge>
                )}
            </div>

            {error && (
                <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {status === 'idle' && (
                <Card variant="bordered">
                    <CardHeader>
                        <CardTitle>Informe o código</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            label="Código do titular"
                            placeholder="Ex: H7K2"
                            value={token}
                            onChange={(event) => setToken(normalizeToken(event.target.value))}
                        />
                        <Button className="w-full" size="lg" onClick={startListening} disabled={!orgSlug}>
                            Conectar
                        </Button>
                    </CardContent>
                </Card>
            )}

            {status === 'waiting' && (
                <Card variant="bordered">
                    <CardContent className="py-10 text-center space-y-4">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-gray-600">Aguardando envio do titular...</p>
                        <Button variant="outline" onClick={resetSession}>Cancelar</Button>
                    </CardContent>
                </Card>
            )}

            {status === 'expired' && (
                <Alert variant="warning">
                    Sessão expirada. Solicite um novo código ao titular.
                </Alert>
            )}

            {status === 'viewing' && payload && (
                <div className="space-y-4">
                    <Card variant="bordered">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>{payload.meta.templateName}</CardTitle>
                                <p className="text-sm text-gray-500 mt-1">Recebido em {new Date(payload.meta.createdAt).toLocaleTimeString('pt-BR')}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Clock className="h-4 w-4" />
                                <span>{remaining || '10:00'}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {payload.fields.map((field) => (
                                    <div key={field.slug} className="px-6 py-4 flex items-center justify-between">
                                        <span className="text-gray-500">{field.label}</span>
                                        <span className="font-medium text-gray-900">
                                            {formatValue(field.slug, field.value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Alert variant="info">
                        <Shield className="h-4 w-4 inline mr-2" />
                        Visualização efêmera. Os dados desaparecem em 10 minutos.
                    </Alert>

                    <Button variant="outline" className="w-full" onClick={resetSession}>
                        Encerrar visualização
                    </Button>
                </div>
            )}

            {status === 'viewing' && !payload && (
                <Card variant="bordered">
                    <CardContent className="py-10 text-center space-y-4">
                        <div className="p-3 bg-green-100 rounded-full w-fit mx-auto">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-gray-600">Sessão encerrada.</p>
                        <Button variant="outline" onClick={resetSession}>
                            Receber outro código
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
