'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, Button, Input, Alert } from '@/components/ui'
import { Building2, ArrowRight, CheckCircle } from 'lucide-react'
import { slugify } from '@/lib/utils'

export default function OnboardingPage() {
    const router = useRouter()
    const supabase = createClient()

    const [step, setStep] = useState<'org' | 'creating' | 'success'>('org')
    const [orgName, setOrgName] = useState('')
    const [orgDocument, setOrgDocument] = useState('')
    const [userName, setUserName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setStep('creating')

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Não autenticado')

            // Generate unique slug
            const baseSlug = slugify(orgName)
            const slug = `${baseSlug}-${Date.now().toString(36)}`

            // Create organization - use type assertion for untyped tables
            const { data: org, error: orgError } = await (supabase
                .from('orgs') as ReturnType<typeof supabase.from>)
                .insert({
                    name: orgName,
                    slug,
                    document: orgDocument,
                    contact_email: user.email
                })
                .select()
                .single()

            if (orgError) throw orgError

            const orgData = org as { id: string }

            // Create public profile for link flow
            const { error: publicError } = await (supabase
                .from('org_public_profiles') as ReturnType<typeof supabase.from>)
                .insert({
                    org_id: orgData.id,
                    slug,
                    display_name: orgName
                })

            if (publicError) throw publicError

            // Create default unit
            const { error: unitError } = await (supabase
                .from('org_units') as ReturnType<typeof supabase.from>)
                .insert({
                    org_id: orgData.id,
                    name: 'Unidade Principal',
                    is_default: true
                })

            if (unitError) throw unitError

            // Create org member (admin)
            const { error: memberError } = await (supabase
                .from('org_members') as ReturnType<typeof supabase.from>)
                .insert({
                    org_id: orgData.id,
                    user_id: user.id,
                    role: 'admin',
                    name: userName,
                    email: user.email!
                })

            if (memberError) throw memberError

            setStep('success')

            // Redirect after 2 seconds
            setTimeout(() => {
                router.push('/org/dashboard')
            }, 2000)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar organização')
            setStep('org')
        } finally {
            setLoading(false)
        }
    }

    if (step === 'success') {
        return (
            <Card variant="elevated" className="backdrop-blur-xl bg-white/95">
                <CardContent className="p-8 text-center">
                    <div className="p-4 bg-green-100 rounded-full w-fit mx-auto mb-6">
                        <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Organização criada!
                    </h1>
                    <p className="text-gray-600">
                        Redirecionando para o painel...
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card variant="elevated" className="backdrop-blur-xl bg-white/95">
            <CardContent className="p-8">
                <div className="text-center mb-8">
                    <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Criar Organização
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Configure sua empresa ou clínica
                    </p>
                </div>

                {error && (
                    <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Nome da Organização"
                        placeholder="Ex: Clínica São Paulo"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        required
                    />

                    <Input
                        label="CPF/CNPJ"
                        placeholder="Apenas números"
                        value={orgDocument}
                        onChange={(e) => setOrgDocument(e.target.value.replace(/\D/g, '').slice(0, 14))}
                        required
                        hint="Usamos apenas para validação cadastral"
                    />

                    <Input
                        label="Seu Nome"
                        placeholder="Como você quer ser chamado"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        required
                    />

                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        loading={loading}
                        disabled={!orgName || !orgDocument || !userName}
                    >
                        Criar e Continuar
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                        Já tem uma conta?{' '}
                        <a href="/login" className="text-blue-600 hover:underline font-medium">
                            Entrar
                        </a>
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
