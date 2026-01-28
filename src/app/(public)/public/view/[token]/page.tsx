'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { Shield, Clock, User, AlertTriangle, CheckCircle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCPF, formatPhone, formatDate } from '@/lib/utils'
import { importKeyFromString, decryptShareData } from '@/lib/crypto/zk-share'

interface SharePayload {
    meta: {
        createdAt: string
        expiresAt: string
        version: number
    }
    fields: Array<{
        slug: string
        label: string
        value: string
    }>
}

export default function PublicViewPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const idArg = params.token as string // URL param is actually the ID now
    const supabase = useMemo(() => createClient(), [])
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
    const readyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const [step, setStep] = useState<'waiting' | 'viewing' | 'expired' | 'error'>('waiting')
    const [data, setData] = useState<SharePayload | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expiresIn, setExpiresIn] = useState<string | null>(null)
    const [expiresAt, setExpiresAt] = useState<number | null>(null)

    useEffect(() => {
        setupChannel()
        return () => {
            if (readyIntervalRef.current) {
                clearInterval(readyIntervalRef.current)
                readyIntervalRef.current = null
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [supabase, idArg, searchParams])

    useEffect(() => {
        if (!expiresAt) return
        const interval = setInterval(() => {
            const diff = expiresAt - Date.now()
            if (diff <= 0) {
                setStep('expired')
                setExpiresIn('0 minutos')
                setData(null)
                if (readyIntervalRef.current) {
                    clearInterval(readyIntervalRef.current)
                    readyIntervalRef.current = null
                }
                clearInterval(interval)
                return
            }

            const mins = Math.ceil(diff / 60000)
            setExpiresIn(`${mins} minutos`)
        }, 1000)

        return () => clearInterval(interval)
    }, [expiresAt])

    const setupChannel = async () => {
        try {
            // 1. Get Key from URL Hash
            // window.location.hash returns "#key=..."
            const hash = window.location.hash
            const keyMatch = hash.match(/key=([^&]+)/)

            if (!keyMatch || !keyMatch[1]) {
                throw new Error('Chave de acesso inválida ou ausente na URL.')
            }

            const keyString = keyMatch[1]

            // 2. Resolve expiration from query param
            const expParam = searchParams.get('exp')
            const expMs = expParam ? Number(expParam) : Date.now() + 10 * 60 * 1000

            if (Number.isNaN(expMs)) {
                throw new Error('Link inválido.')
            }

            if (expMs < Date.now()) {
                throw new Error('Este link expirou. Solicite um novo ao titular.')
            }

            setExpiresAt(expMs)

            const key = await importKeyFromString(keyString)

            // 3. Subscribe to realtime channel
            const channel = supabase.channel(`public:${idArg}`, {
                config: { broadcast: { self: false } }
            })

            channel.on('broadcast', { event: 'payload' }, async (event) => {
                try {
                    const decryptedPayload = await decryptShareData(event.payload, key) as SharePayload
                    setData(decryptedPayload)
                    setStep('viewing')
                    if (readyIntervalRef.current) {
                        clearInterval(readyIntervalRef.current)
                        readyIntervalRef.current = null
                    }
                } catch (err) {
                    console.error('Decryption error:', err)
                    setError('Falha na decifragem. A chave pode estar incorreta.')
                    setStep('error')
                    if (readyIntervalRef.current) {
                        clearInterval(readyIntervalRef.current)
                        readyIntervalRef.current = null
                    }
                }
            })

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    const sendReady = () => {
                        channel.send({
                            type: 'broadcast',
                            event: 'ready',
                            payload: { at: new Date().toISOString() }
                        })
                    }
                    sendReady()
                    if (readyIntervalRef.current) {
                        clearInterval(readyIntervalRef.current)
                    }
                    readyIntervalRef.current = setInterval(sendReady, 5000)
                }
            })

            channelRef.current = channel

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
            setStep('error')
        }
    }

    const formatValue = (slug: string, value: string) => {
        if (slug === 'cpf') return formatCPF(value)
        if (slug === 'phone') return formatPhone(value)
        if (slug === 'birth_date') return formatDate(value)
        return value
    }

    if (step === 'waiting') {
        return (
            <div className="py-16 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Lock className="h-4 w-4" />
                    <p>Aguardando envio seguro dos dados...</p>
                </div>
            </div>
        )
    }

    if (step === 'error' || step === 'expired') {
        return (
            <div className="py-8">
                <Card variant="bordered" className="border-red-200 bg-red-50">
                    <CardContent className="p-8 text-center">
                        <div className="p-4 bg-red-100 rounded-full w-fit mx-auto mb-4">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">
                            {step === 'expired' ? 'Link Expirado' : 'Erro de Acesso'}
                        </h1>
                        <p className="text-gray-600">
                            {error || 'Este link não é mais válido. Solicite um novo ao titular.'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Filter out empty values
    const filledData = data ? data.fields.filter((field) => field.value) : []

    return (
        <div className="py-6 space-y-6">
            {/* Status Header */}
            <Card variant="bordered" className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-green-800 flex items-center gap-2">
                                Acesso Autorizado
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    <Lock className="h-3 w-3 mr-1" />
                                    E2E Encrypted
                                </span>
                            </p>
                            <p className="text-sm text-green-600">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Expira em {expiresIn || '10 minutos'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Card */}
            <Card variant="bordered">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <CardTitle>Dados Compartilhados</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {filledData.length > 0 ? (
                            filledData.map((field) => (
                                <div key={field.slug} className="px-6 py-4 flex justify-between items-center">
                                    <span className="text-gray-500">{field.label}</span>
                                    <span className="font-medium text-gray-900">
                                        {formatValue(field.slug, field.value)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="px-6 py-8 text-center text-gray-500">
                                Nenhum dado disponível
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Warning */}
            <Alert variant="warning">
                <Shield className="h-4 w-4 inline mr-2" />
                Este acesso é efêmero.
                Os dados foram decifrados apenas neste dispositivo.
            </Alert>
        </div>
    )
}
