'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, Alert } from '@/components/ui'
import Link from 'next/link'
import { Shield, CheckCircle } from 'lucide-react'

export default function SubjectRegisterPage() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                router.replace('/subject/wallet')
            }
        }
        checkSession()
    }, [])

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validações básicas
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            return
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=/subject/wallet`
                }
            })

            if (error) throw error

            setSuccess(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar conta')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="py-6 space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Verifique seu E-mail
                    </h1>
                    <p className="text-gray-600 mt-4">
                        Enviamos um link de confirmação para <strong>{email}</strong>.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Clique no link enviado para ativar sua conta e acessar sua carteira.
                    </p>
                </div>

                <Card variant="bordered">
                    <CardContent className="p-6">
                        <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => router.push('/subject/login')}
                        >
                            Voltar para Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="py-6 space-y-6">
            <div className="text-center">
                <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
                    <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Criar Sua Conta
                </h1>
                <p className="text-gray-600 mt-2">
                    Cadastre-se para sincronizar seus dados com segurança
                </p>
            </div>

            <Card variant="bordered">
                <CardContent className="p-6">
                    {error && (
                        <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <Input
                            type="email"
                            label="E-mail"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />

                        <Input
                            type="password"
                            label="Senha"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />

                        <Input
                            type="password"
                            label="Confirmar Senha"
                            placeholder="Digite a senha novamente"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />

                        <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
                            Criar Conta
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-gray-500">Já tem uma conta? </span>
                        <Link href="/subject/login" className="text-blue-600 font-medium hover:underline">
                            Fazer Login
                        </Link>
                    </div>
                </CardContent>
            </Card>

            <div className="text-center text-sm text-gray-500">
                <p>Seus dados financeiros e pessoais são cifrados. A senha é fundamental para acessá-los.</p>
            </div>
        </div>
    )
}
