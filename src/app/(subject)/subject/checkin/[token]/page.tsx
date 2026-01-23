'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Alert, Badge } from '@/components/ui'
import { ArrowRight, CheckCircle, Shield, Clock } from 'lucide-react'
import { validateCheckDigit, normalizeToken, hashToken } from '@/lib/utils/tokens'
import { getWalletData, getAnonId, WalletData } from '@/lib/wallet'

interface Template {
    id: string
    name: string
    description: string | null
    purpose: string | null
    code_short: string
}

interface TemplateField {
    id: string
    is_required: boolean
    base_fields: {
        slug: string
        label: string
        type: string
        placeholder: string | null
    }
}

export default function CheckinPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string
    const supabase = createClient()

    const [step, setStep] = useState<'validating' | 'templates' | 'form' | 'submitting' | 'success' | 'error'>('validating')
    const [templates, setTemplates] = useState<Template[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [templateFields, setTemplateFields] = useState<TemplateField[]>([])
    const [formData, setFormData] = useState<Record<string, string>>({})
    const [walletData, setWalletData] = useState<WalletData>({})
    const [error, setError] = useState<string | null>(null)
    const [intakeId, setIntakeId] = useState<string | null>(null)
    const [orgInfo, setOrgInfo] = useState<{ name: string } | null>(null)

    // Validate token on mount
    useEffect(() => {
        validateToken()
        loadWallet()
    }, [token])

    const loadWallet = async () => {
        const data = await getWalletData()
        setWalletData(data)
    }

    const validateToken = async () => {
        try {
            // Validate check digit
            if (!validateCheckDigit(token)) {
                throw new Error('Token inválido')
            }

            const normalized = normalizeToken(token)
            const tokenHash = await hashToken(normalized)

            // Find intake by token hash
            const { data: intake, error: intakeError } = await supabase
                .from('intakes')
                .select(`
          id,
          expires_at,
          orgs(name),
          intake_templates(
            templates(id, name, description, purpose, code_short)
          )
        `)
                .eq('token_hash', tokenHash)
                .single()

            if (intakeError || !intake) {
                throw new Error('Token não encontrado ou expirado')
            }

            // Check expiration
            if (new Date(intake.expires_at) < new Date()) {
                throw new Error('Token expirado. Solicite um novo QR Code.')
            }

            setIntakeId(intake.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const orgsData = intake.orgs as any
            setOrgInfo(Array.isArray(orgsData) ? orgsData[0] : orgsData)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tpls = (intake.intake_templates as any[])
                ?.map((it: any) => it.templates)
                .filter(Boolean) || []

            setTemplates(tpls)

            if (tpls.length === 1) {
                // Auto-select if only one template
                selectTemplate(tpls[0])
            } else {
                setStep('templates')
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao validar token')
            setStep('error')
        }
    }

    const selectTemplate = async (template: Template) => {
        setSelectedTemplate(template)

        // Load template fields
        const { data: fields } = await supabase
            .from('template_fields')
            .select(`
        id,
        is_required,
        base_fields(slug, label, type, placeholder)
      `)
            .eq('template_id', template.id)
            .order('display_order')

        if (fields) {
            setTemplateFields(fields as unknown as TemplateField[])

            // Pre-fill from wallet
            const prefilled: Record<string, string> = {}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fields.forEach((f: any) => {
                const slug = f.base_fields?.slug
                if (slug && walletData[slug]) {
                    prefilled[slug] = walletData[slug]!
                }
            })
            setFormData(prefilled)
        }

        setStep('form')
    }

    const handleInputChange = (slug: string, value: string) => {
        setFormData({ ...formData, [slug]: value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStep('submitting')
        setError(null)

        try {
            if (!selectedTemplate || !intakeId) throw new Error('Dados incompletos')

            const anonId = await getAnonId()

            // Get org/unit from intake
            const { data: intake } = await supabase
                .from('intakes')
                .select('org_id, unit_id')
                .eq('id', intakeId)
                .single()

            if (!intake) throw new Error('Intake não encontrado')

            /*
             * In production, this would:
             * 1. Generate session data key
             * 2. Encrypt each field value with the data key
             * 3. Encrypt data key with master key
             * 4. Call submit_session_to_queue Edge Function
             * 
             * For demo, we'll create the session directly
             */

            // Create session
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .insert({
                    intake_id: intakeId,
                    org_id: intake.org_id,
                    unit_id: intake.unit_id,
                    template_id: selectedTemplate.id,
                    subject_anon_id: anonId,
                    status: 'queued',
                    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
                })
                .select()
                .single()

            if (sessionError) throw sessionError

            // In production: insert encrypted payload fields
            // For demo, we skip the actual encryption step

            setStep('success')

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao enviar dados')
            setStep('form')
        }
    }

    // Render based on step
    if (step === 'validating') {
        return (
            <div className="py-16 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Validando token...</p>
            </div>
        )
    }

    if (step === 'error') {
        return (
            <div className="py-6">
                <Alert variant="error">{error}</Alert>
                <div className="mt-6 text-center">
                    <Button onClick={() => router.push('/subject/wallet')}>
                        Voltar para Carteira
                    </Button>
                </div>
            </div>
        )
    }

    if (step === 'templates') {
        return (
            <div className="py-6 space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Selecione o formulário</h1>
                    <p className="text-gray-600 mt-1">{orgInfo?.name}</p>
                </div>

                <div className="space-y-4">
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
                                    <ArrowRight className="h-5 w-5 text-gray-400" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    if (step === 'success') {
        return (
            <div className="py-16 text-center">
                <div className="p-4 bg-green-100 rounded-full w-fit mx-auto mb-6">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Dados enviados!</h1>
                <p className="text-gray-600 mb-8">
                    Aguarde ser chamado para atendimento
                </p>
                <Button onClick={() => router.push('/subject/wallet')}>
                    Voltar para Carteira
                </Button>
            </div>
        )
    }

    // Form step
    return (
        <div className="py-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedTemplate?.name}</h1>
                <p className="text-gray-600 mt-1">{orgInfo?.name}</p>
            </div>

            {/* Purpose (LGPD) */}
            {selectedTemplate?.purpose && (
                <Alert variant="info">
                    <strong>Finalidade:</strong> {selectedTemplate.purpose}
                </Alert>
            )}

            {error && (
                <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {templateFields.map((field) => {
                    const slug = field.base_fields.slug
                    const prefilled = !!walletData[slug]

                    return (
                        <div key={field.id}>
                            <Input
                                label={`${field.base_fields.label}${field.is_required ? ' *' : ''}${prefilled ? ' (da carteira)' : ''}`}
                                type={field.base_fields.type === 'email' ? 'email' :
                                    field.base_fields.type === 'date' ? 'date' :
                                        field.base_fields.type === 'phone' ? 'tel' : 'text'}
                                placeholder={field.base_fields.placeholder || undefined}
                                value={formData[slug] || ''}
                                onChange={(e) => handleInputChange(slug, e.target.value)}
                                required={field.is_required}
                            />
                        </div>
                    )
                })}

                <div className="pt-4">
                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        loading={step === 'submitting'}
                    >
                        <Shield className="h-4 w-4" />
                        Enviar para Atendimento
                    </Button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Seus dados expiram automaticamente após o atendimento
                </p>
            </form>
        </div>
    )
}
