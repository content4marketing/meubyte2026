'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Alert, Input, Badge } from '@/components/ui'
import { getWalletData } from '@/lib/wallet'
import { generateTicketCode } from '@/lib/utils/tokens'
import { deriveTokenKey } from '@/lib/crypto'
import { encryptShareData } from '@/lib/crypto/zk-share'
import { CheckCircle, Clock, Shield, Smartphone } from 'lucide-react'

interface PublicOrg {
    org_id: string
    slug: string
    display_name: string
}

interface Template {
    id: string
    name: string
    description: string | null
    purpose: string | null
}

interface TemplateField {
    id: string
    is_required: boolean
    display_order: number
    base_fields?: FieldMeta | FieldMeta[] | null
    org_fields?: FieldMeta | FieldMeta[] | null
}

interface FieldMeta {
    slug: string
    label: string
    type: string
    placeholder: string | null
    help_text: string | null
    is_sensitive: boolean | null
}

interface FieldItem {
    id: string
    slug: string
    label: string
    type: string
    placeholder: string | null
    helpText: string | null
    isRequired: boolean
    isSensitive: boolean
}

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

function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false
    return /android|iphone|ipad|ipod|windows phone/i.test(navigator.userAgent)
}

export default function LinkPage() {
    const { slug } = useParams<{ slug: string }>()
    const searchParams = useSearchParams()
    const supabase = useMemo(() => createClient(), [])
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    const [isMobile, setIsMobile] = useState<boolean | null>(null)
    const [org, setOrg] = useState<PublicOrg | null>(null)
    const [templates, setTemplates] = useState<Template[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [fields, setFields] = useState<FieldItem[]>([])
    const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({})
    const [formData, setFormData] = useState<Record<string, string>>({})
    const [token, setToken] = useState<string | null>(null)
    const [receiverReady, setReceiverReady] = useState(false)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setIsMobile(isMobileDevice())
    }, [])

    useEffect(() => {
        if (!isMobile) {
            setLoading(false)
            return
        }

        const loadData = async () => {
            setLoading(true)
            setError(null)

            try {
                const { data: orgData, error: orgError } = await supabase
                    .from('org_public_profiles')
                    .select('org_id, slug, display_name')
                    .eq('slug', slug)
                    .single()

                if (orgError || !orgData) {
                    throw new Error('Estabelecimento não encontrado')
                }

                setOrg(orgData)

                const { data: templateData } = await supabase
                    .from('templates')
                    .select('id, name, description, purpose')
                    .eq('org_id', orgData.org_id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })

                setTemplates((templateData || []) as Template[])
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [isMobile, slug, supabase])

    const selectTemplate = useCallback(async (template: Template) => {
        setSelectedTemplate(template)
        setToken(null)
        setSent(false)
        setReceiverReady(false)
        setError(null)

        try {
            const { data: fieldsData, error: fieldsError } = await supabase
                .from('template_fields')
                .select(`
                    id,
                    is_required,
                    display_order,
                    base_fields(slug, label, type, placeholder, help_text, is_sensitive),
                    org_fields(slug, label, type, placeholder, help_text, is_sensitive)
                `)
                .eq('template_id', template.id)
                .order('display_order')

            if (fieldsError) throw fieldsError

            const normalized = (fieldsData || []).map((field: TemplateField) => {
                const baseField = Array.isArray(field.base_fields) ? field.base_fields[0] : field.base_fields
                const orgField = Array.isArray(field.org_fields) ? field.org_fields[0] : field.org_fields
                const meta = baseField || orgField
                return {
                    id: field.id,
                    slug: meta?.slug || field.id,
                    label: meta?.label || 'Campo',
                    type: meta?.type || 'text',
                    placeholder: meta?.placeholder || null,
                    helpText: meta?.help_text || null,
                    isRequired: field.is_required,
                    isSensitive: Boolean(meta?.is_sensitive)
                } as FieldItem
            })

            const walletSnapshot = await getWalletData()
            const initialSelected: Record<string, boolean> = {}
            const prefilled: Record<string, string> = {}

            normalized.forEach((field) => {
                initialSelected[field.slug] = true
                if (walletSnapshot[field.slug]) {
                    prefilled[field.slug] = walletSnapshot[field.slug] as string
                }
            })

            setFields(normalized)
            setSelectedFields(initialSelected)
            setFormData(prefilled)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar campos')
        }
    }, [supabase])

    useEffect(() => {
        const templateId = searchParams.get('template')
        if (!templateId || templates.length === 0) return
        const match = templates.find((tpl) => tpl.id === templateId)
        if (match) {
            selectTemplate(match)
        }
    }, [searchParams, templates, selectTemplate])

    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [supabase])

    const toggleField = (slugValue: string) => {
        setSelectedFields((prev) => ({
            ...prev,
            [slugValue]: !prev[slugValue]
        }))
    }

    const updateFieldValue = (slugValue: string, value: string) => {
        setFormData((prev) => ({ ...prev, [slugValue]: value }))
    }

    const normalizeTokenInput = (value: string) => {
        return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    }

    const setupChannel = (newToken: string) => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
        }

        const channel = supabase.channel(`share:${slug}:${newToken}`, {
            config: {
                broadcast: { self: false }
            }
        })

        channel.on('broadcast', { event: 'ready' }, () => {
            setReceiverReady(true)
        })

        channel.subscribe()
        channelRef.current = channel
    }

    const generateToken = async () => {
        if (!selectedTemplate) return

        const missingRequired = fields.filter(
            (field) => selectedFields[field.slug] && field.isRequired && !formData[field.slug]
        )

        if (missingRequired.length > 0) {
            setError('Preencha os campos obrigatórios antes de gerar o código.')
            return
        }

        const newToken = normalizeTokenInput(generateTicketCode(4))
        setToken(newToken)
        setReceiverReady(false)
        setupChannel(newToken)
    }

    const sendPayload = async () => {
        if (!token || !selectedTemplate || !org || !channelRef.current) return
        setSending(true)
        setError(null)

        try {
            const payload: SharePayload = {
                meta: {
                    orgSlug: org.slug,
                    orgName: org.display_name,
                    templateId: selectedTemplate.id,
                    templateName: selectedTemplate.name,
                    createdAt: new Date().toISOString()
                },
                fields: fields
                    .filter((field) => selectedFields[field.slug])
                    .map((field) => ({
                        slug: field.slug,
                        label: field.label,
                        value: formData[field.slug] || ''
                    }))
            }

            const key = await deriveTokenKey(token, org.slug)
            const encrypted = await encryptShareData(payload, key)

            await channelRef.current.send({
                type: 'broadcast',
                event: 'payload',
                payload: encrypted
            })

            setSent(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao enviar dados')
        } finally {
            setSending(false)
        }
    }

    if (loading || isMobile === null) {
        return (
            <div className="py-16 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando...</p>
            </div>
        )
    }

    if (!isMobile) {
        return (
            <div className="py-10 px-6">
                <Card variant="bordered" className="max-w-lg mx-auto">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto">
                            <Smartphone className="h-6 w-6 text-blue-600" />
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900">Abra no celular</h1>
                        <p className="text-gray-600 text-sm">
                            Este link é exclusivo para smartphones. Abra a câmera do seu celular e leia o QR Code novamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div className="py-10 px-6">
                <Alert variant="error" className="max-w-lg mx-auto" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            </div>
        )
    }

    return (
        <div className="py-6 px-4 sm:px-6 space-y-6">
            <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Compartilhar dados</p>
                <h1 className="text-2xl font-bold text-gray-900">{org?.display_name}</h1>
            </div>

            {!selectedTemplate ? (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Escolha um template para definir quais dados serão solicitados.
                    </p>
                    {templates.length === 0 ? (
                        <Alert variant="warning">
                            Nenhum template ativo encontrado para este estabelecimento.
                        </Alert>
                    ) : (
                        <div className="space-y-3">
                            {templates.map((template) => (
                                <Card
                                    key={template.id}
                                    variant="bordered"
                                    className="cursor-pointer hover:border-blue-300 transition-colors"
                                    onClick={() => selectTemplate(template)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-gray-900">{template.name}</h3>
                                                {template.description && (
                                                    <p className="text-sm text-gray-500">{template.description}</p>
                                                )}
                                            </div>
                                            <Badge variant="default">Selecionar</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            ) : token ? (
                <Card variant="bordered">
                    <CardContent className="p-6 text-center space-y-4">
                        {sent ? (
                            <>
                                <div className="p-3 bg-green-100 rounded-full w-fit mx-auto">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900">Dados enviados</h2>
                                <p className="text-sm text-gray-600">
                                    O estabelecimento já pode visualizar os dados por 10 minutos.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setToken(null)
                                        setSelectedTemplate(null)
                                        setSent(false)
                                    }}
                                >
                                    Finalizar
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto">
                                    <Shield className="h-6 w-6 text-blue-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900">Código de confirmação</h2>
                                <div className="text-3xl font-mono font-semibold tracking-[0.3em] text-gray-900">
                                    {token}
                                </div>
                                <p className="text-sm text-gray-600">
                                    Informe este código ao estabelecimento. Ele expira em 30 segundos.
                                </p>
                                <Alert variant={receiverReady ? 'success' : 'info'}>
                                    {receiverReady
                                        ? 'Estabelecimento pronto para receber. Toque em enviar.'
                                        : 'Aguardando o estabelecimento abrir a tela de recepção.'}
                                </Alert>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={sendPayload}
                                    loading={sending}
                                    disabled={!receiverReady}
                                >
                                    Enviar dados agora
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setToken(null)
                                        setReceiverReady(false)
                                        setSent(false)
                                    }}
                                >
                                    Gerar novo código
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h2>
                            {selectedTemplate.purpose && (
                                <p className="text-sm text-gray-500">{selectedTemplate.purpose}</p>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTemplate(null)}
                        >
                            Trocar
                        </Button>
                    </div>

                    <Card variant="bordered">
                        <CardHeader>
                            <CardTitle>Dados selecionados</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {fields.map((field) => {
                                const isSelected = selectedFields[field.slug]
                                return (
                                    <div key={field.id} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300"
                                                    checked={isSelected}
                                                    onChange={() => toggleField(field.slug)}
                                                />
                                                {field.label}
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {field.isRequired && (
                                                    <Badge variant="warning" size="sm">Obrigatório</Badge>
                                                )}
                                                {field.isSensitive && (
                                                    <Badge variant="default" size="sm">Sensível</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Input
                                            type={field.type === 'email' ? 'email' :
                                                field.type === 'date' ? 'date' :
                                                    field.type === 'phone' ? 'tel' : 'text'}
                                            placeholder={field.placeholder || undefined}
                                            value={formData[field.slug] || ''}
                                            onChange={(event) => updateFieldValue(field.slug, event.target.value)}
                                            disabled={!isSelected}
                                        />
                                        {field.helpText && (
                                            <p className="text-xs text-gray-500">{field.helpText}</p>
                                        )}
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>

                    <div className="space-y-3">
                        <Button className="w-full" size="lg" onClick={generateToken}>
                            Gerar código de envio
                        </Button>
                        <Alert variant="info">
                            <Clock className="h-4 w-4 inline mr-2" />
                            Os dados ficam visíveis por 10 minutos após o envio.
                        </Alert>
                    </div>
                </div>
            )}
        </div>
    )
}
