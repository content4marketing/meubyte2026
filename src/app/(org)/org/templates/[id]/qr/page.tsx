'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Alert } from '@/components/ui'
import { ArrowLeft, Copy, CheckCircle, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface Template {
    id: string
    name: string
    code_short: string
    org_id: string
}

export default function TemplateQRPage() {
    const params = useParams()
    const templateId = params.id as string
    const supabase = createClient()

    const [template, setTemplate] = useState<Template | null>(null)
    const [qrUrl, setQrUrl] = useState<string | null>(null)
    const [intakeUrl, setIntakeUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadTemplate() {
            const { data } = await supabase
                .from('templates')
                .select('id, name, code_short, org_id')
                .eq('id', templateId)
                .single()

            if (data) {
                setTemplate(data)
                await generateQR(data)
            }
            setLoading(false)
        }
        loadTemplate()
    }, [templateId, supabase])

    const generateQR = async (tmpl: Template) => {
        try {
            // Get user's org slug
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Não autenticado')

            const { data: member } = await supabase
                .from('org_members')
                .select('org_id, orgs(slug)')
                .eq('user_id', user.id)
                .single()

            if (!member) throw new Error('Membro não encontrado')

            // Generate URL (static link for this template)
            const orgData = Array.isArray(member.orgs) ? member.orgs[0] : member.orgs
            const orgSlug = orgData?.slug
            if (!orgSlug) throw new Error('Slug do estabelecimento não encontrado')

            const baseUrl = window.location.origin
            const url = `${baseUrl}/link/${orgSlug}?template=${tmpl.id}`
            setIntakeUrl(url)

            // Generate QR Code using external service (static link)
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`
            setQrUrl(qrApiUrl)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao gerar QR Code')
        }
    }

    const copyLink = async () => {
        if (intakeUrl) {
            await navigator.clipboard.writeText(intakeUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const shareWhatsApp = () => {
        if (intakeUrl) {
            const message = encodeURIComponent(
                `Acesse o link para preencher seus dados:\n${intakeUrl}`
            )
            window.open(`https://wa.me/?text=${message}`, '_blank')
        }
    }

    if (loading) {
        return (
            <div className="p-6 lg:p-8 max-w-2xl mx-auto">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 lg:p-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/org/templates">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">QR Code</h1>
                    <p className="text-gray-600">{template?.name}</p>
                </div>
            </div>

            {error && (
                <Alert variant="error" className="mb-6">
                    {error}
                </Alert>
            )}

            {qrUrl && (
                <Card variant="bordered">
                    <CardContent className="p-8 text-center">
                        {/* QR Code */}
                        <div className="bg-white p-4 rounded-xl inline-block shadow-sm mb-6">
                            <img
                                src={qrUrl}
                                alt="QR Code"
                                className="w-64 h-64 mx-auto"
                            />
                        </div>

                        <p className="text-gray-600 mb-6">
                            Escaneie o QR Code para abrir no celular ou compartilhe o link
                        </p>

                        {/* Link */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-6 break-all text-sm text-gray-600">
                            {intakeUrl}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 justify-center">
                            <Button onClick={copyLink} variant={copied ? 'secondary' : 'outline'}>
                                {copied ? (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        Copiar Link
                                    </>
                                )}
                            </Button>
                            <Button onClick={shareWhatsApp} variant="outline">
                                <MessageCircle className="h-4 w-4" />
                                WhatsApp
                            </Button>
                        </div>

                        {/* Info */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="text-sm text-gray-500">
                                ⏱ O link é permanente. O código gerado pelo titular expira em <strong>30 segundos</strong>.
                                <br />
                                Você pode imprimir e reutilizar este QR Code.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Regenerate button */}
            <div className="mt-6 text-center">
                <Button
                    variant="outline"
                    onClick={() => template && generateQR(template)}
                >
                    Gerar Novo QR Code
                </Button>
            </div>
        </div>
    )
}
