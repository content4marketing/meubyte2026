'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, Alert } from '@/components/ui'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect') || '/org/dashboard'

    const [email, setEmail] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`
                }
            })

            if (error) throw error
            setOtpSent(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao enviar código')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'email'
            })

            if (error) throw error
            router.push(redirect)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Código inválido')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card variant="elevated" className="backdrop-blur-xl bg-white/95">
            <CardContent className="p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {otpSent ? 'Verificar código' : 'Entrar'}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {otpSent
                            ? `Digite o código enviado para ${email}`
                            : 'Acesse o painel da sua organização'
                        }
                    </p>
                </div>

                {error && (
                    <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {!otpSent ? (
                    <form onSubmit={handleSendOTP} className="space-y-6">
                        <Input
                            type="email"
                            label="E-mail"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />

                        <Button type="submit" className="w-full" size="lg" loading={loading}>
                            Enviar código
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOTP} className="space-y-6">
                        <Input
                            type="text"
                            label="Código de verificação"
                            placeholder="000000"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            autoComplete="one-time-code"
                            maxLength={6}
                            className="text-center text-2xl tracking-widest"
                        />

                        <Button type="submit" className="w-full" size="lg" loading={loading}>
                            Verificar
                        </Button>

                        <button
                            type="button"
                            onClick={() => setOtpSent(false)}
                            className="w-full text-sm text-gray-600 hover:text-gray-900"
                        >
                            Usar outro e-mail
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-500">
                        Ainda não tem conta?{' '}
                        <a href="/onboarding" className="text-blue-600 hover:underline font-medium">
                            Criar organização
                        </a>
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

function LoginLoading() {
    return (
        <Card variant="elevated" className="backdrop-blur-xl bg-white/95">
            <CardContent className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginLoading />}>
            <LoginForm />
        </Suspense>
    )
}
