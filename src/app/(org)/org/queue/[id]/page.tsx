'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Alert } from '@/components/ui'
import { ArrowLeft, Eye, EyeOff, Clock, CheckCircle, AlertTriangle, Copy } from 'lucide-react'
import Link from 'next/link'
import { formatCPF, maskCPF, formatPhone, formatDate } from '@/lib/utils'

interface Session {
    id: string
    ticket_code: string
    status: string
    expires_at: string
    templates: {
        name: string
        purpose: string | null
    }
}

interface PayloadField {
    id: string
    field_slug: string
    value_ciphertext: string
    template_fields: {
        is_required: boolean
        base_fields: {
            label: string
            type: string
            is_sensitive: boolean
        } | null
    }
}

interface RevealedField {
    slug: string
    value: string
    revealed_at: string
}

export default function SessionViewPage() {
    const params = useParams()
    const router = useRouter()
    const sessionId = params.id as string
    const supabase = createClient()

    const [session, setSession] = useState<Session | null>(null)
    const [fields, setFields] = useState<PayloadField[]>([])
    const [revealedFields, setRevealedFields] = useState<RevealedField[]>([])
    const [loading, setLoading] = useState(true)
    const [revealing, setRevealing] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null)

    useEffect(() => {
        loadSession()
    }, [sessionId])

    const loadSession = async () => {
        try {
            // Load session
            const { data: sessionData } = await supabase
                .from('sessions')
                .select(`
          id,
          ticket_code,
          status,
          expires_at,
          template_id,
          templates(name, purpose)
        `)
                .eq('id', sessionId)
                .single()

            if (sessionData) setSession(sessionData as unknown as Session)

            const sessionTyped = sessionData as unknown as { template_id: string; templates: { name: string; purpose: string | null } }

            /* 
             * Note: In production, fields would be loaded via Edge Function
             * that decrypts the payload. For now, we simulate with direct access.
             * The actual reveal_field Edge Function would:
             * 1. Verify authorization (user has claim on session)
             * 2. Decrypt the field value using master key
             * 3. Log the access to access_logs
             * 4. Return the decrypted value
             */

            // Simulate field list (in production, this comes from template_fields)
            const { data: templateFields } = await supabase
                .from('template_fields')
                .select(`
          id,
          is_required,
          base_fields(slug, label, type, is_sensitive)
        `)
                .eq('template_id', sessionTyped?.template_id)
                .order('display_order')

            // For demo purposes, we'll show placeholder encrypted fields
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockFields = (templateFields || []).map((tf: any) => ({
                id: tf.id,
                field_slug: tf.base_fields?.slug || 'unknown',
                value_ciphertext: '[encrypted]', // In production, this comes from session_payload_fields
                template_fields: {
                    is_required: tf.is_required,
                    base_fields: tf.base_fields
                }
            }))

            setFields(mockFields)
        } catch (err) {
            console.error('Error loading session:', err)
            setError('Erro ao carregar sessão')
        } finally {
            setLoading(false)
        }
    }

    const revealField = async (fieldSlug: string) => {
        setRevealing(fieldSlug)
        setError(null)

        try {
            /*
             * In production, this would call the reveal_field Edge Function:
             * 
             * const { data, error } = await supabase.functions.invoke('reveal_field', {
             *   body: { session_id: sessionId, field_slug: fieldSlug, mode: 'edge_decrypt' }
             * })
             * 
             * The Edge Function would:
             * 1. Verify user has active claim on this session
             * 2. Check rate limits
             * 3. Unwrap the session's data key using master key
             * 4. Decrypt the specific field value
             * 5. Log to access_logs: { session_id, field_slug, action: 'reveal', actor_id, ... }
             * 6. Return the decrypted value
             */

            // Simulate reveal delay
            await new Promise(resolve => setTimeout(resolve, 500))

            // Mock revealed data for demo
            const mockValues: Record<string, string> = {
                full_name: 'João da Silva Santos',
                cpf: '12345678901',
                email: 'joao.silva@email.com',
                phone: '11999998888',
                birth_date: '1985-03-15',
                address_line: 'Rua das Flores, 123 - Apto 45',
                city: 'São Paulo',
                state: 'SP',
                postal_code: '01234567'
            }

            const value = mockValues[fieldSlug] || 'Valor não disponível'

            setRevealedFields([
                ...revealedFields,
                { slug: fieldSlug, value, revealed_at: new Date().toISOString() }
            ])

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao revelar campo')
        } finally {
            setRevealing(null)
        }
    }

    const formatValue = (slug: string, value: string) => {
        if (slug === 'cpf') return formatCPF(value)
        if (slug === 'phone') return formatPhone(value)
        if (slug === 'birth_date') return formatDate(value)
        return value
    }

    const copyValue = async (slug: string, value: string) => {
        await navigator.clipboard.writeText(value)
        setCopied(slug)
        setTimeout(() => setCopied(null), 2000)
    }

    const endSession = async () => {
        try {
            await (supabase
                .from('sessions') as ReturnType<typeof supabase.from>)
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('id', sessionId)

            router.push('/org/queue')
        } catch (err) {
            setError('Erro ao encerrar sessão')
        }
    }

    const getRevealedValue = (slug: string) => {
        return revealedFields.find(f => f.slug === slug)
    }

    if (loading) {
        return (
            <div className="p-6 lg:p-8 max-w-3xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 lg:p-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/org/queue">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">
                                #{session?.ticket_code}
                            </h1>
                            <Badge variant="info">Em Atendimento</Badge>
                        </div>
                        <p className="text-gray-600">{session?.templates?.name}</p>
                    </div>
                </div>
                <Button variant="danger" onClick={endSession}>
                    <CheckCircle className="h-4 w-4" />
                    Encerrar
                </Button>
            </div>

            {/* Purpose (LGPD transparency) */}
            {session?.templates?.purpose && (
                <Alert variant="info" className="mb-6">
                    <strong>Finalidade:</strong> {session.templates.purpose}
                </Alert>
            )}

            {error && (
                <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Fields */}
            <Card variant="bordered">
                <CardHeader>
                    <CardTitle>Dados Coletados</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {fields.map((field) => {
                            const revealed = getRevealedValue(field.field_slug)
                            const isRevealing = revealing === field.field_slug
                            const isSensitive = field.template_fields.base_fields?.is_sensitive

                            return (
                                <div key={field.id} className="p-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900">
                                                {field.template_fields.base_fields?.label || field.field_slug}
                                            </p>
                                            {isSensitive && (
                                                <Badge variant="warning" size="sm">Sensível</Badge>
                                            )}
                                        </div>

                                        {revealed ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-gray-700 font-mono">
                                                    {formatValue(field.field_slug, revealed.value)}
                                                </p>
                                                <button
                                                    onClick={() => copyValue(field.field_slug, revealed.value)}
                                                    className="p-1 text-gray-400 hover:text-gray-600"
                                                >
                                                    {copied === field.field_slug ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 text-sm mt-1">
                                                ••••••••••
                                            </p>
                                        )}
                                    </div>

                                    {!revealed && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => revealField(field.field_slug)}
                                            loading={isRevealing}
                                        >
                                            <Eye className="h-4 w-4" />
                                            Revelar
                                        </Button>
                                    )}
                                </div>
                            )
                        })}

                        {fields.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                Nenhum campo disponível
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Info */}
            <div className="mt-6 text-center text-sm text-gray-500">
                <Clock className="h-4 w-4 inline mr-1" />
                Todos os acessos são registrados para auditoria
            </div>
        </div>
    )
}
