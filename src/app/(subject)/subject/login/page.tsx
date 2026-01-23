'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, Alert } from '@/components/ui'
import { Shield } from 'lucide-react'

function SubjectLoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirect = searchParams.get('redirect') || '/subject/wallet'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                router.replace(redirect)
            }
        }
        checkSession()
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            router.push(redirect)
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao realizar login')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="py-6 space-y-6">
            <div className="text-center">
                <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
                    <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Entrar na Carteira
                </h1>
                <p className="text-gray-600 mt-2">
                    Acesse seus dados sincronizados na nuvem
                </p>
            </div>

            <Card variant="bordered">
                <CardContent className="p-6">
                    {error && (
                        <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
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
                            placeholder="Sua senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />

                        <div className="flex justify-end">
                            <Link href="#" className="text-xs text-blue-600 hover:underline">
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
                            Entrar
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-gray-500">Não tem conta? </span>
                        <Link href="/subject/register" className="text-blue-600 font-medium hover:underline">
                            Criar Conta
                        </Link>
                    </div>
                </CardContent>
            </Card>

            <div className="text-center text-sm text-gray-500">
                <p>Ao entrar, seus dados locais serão sincronizados.</p>
            </div>
        </div>
    )
}

function LoginLoading() {
    return (
        <div className="py-16 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        </div>
    )
}

export default function SubjectLoginPage() {
    return (
        <Suspense fallback={<LoginLoading />}>
            <SubjectLoginForm />
        </Suspense>
    )
}
