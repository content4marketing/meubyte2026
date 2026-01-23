'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { Shield, Clock, User, AlertTriangle, CheckCircle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hashToken } from '@/lib/utils/tokens'
import { formatCPF, formatPhone, formatDate } from '@/lib/utils'
import { importKeyFromString, decryptShareData } from '@/lib/crypto/zk-share'

interface SharedData {
    full_name?: string
    cpf?: string
    email?: string
    phone?: string
    birth_date?: string
    address_line?: string
    city?: string
    state?: string
    postal_code?: string
    [key: string]: string | undefined
}

interface SharePayload {
    data: SharedData
    timestamp: number
    version: number
}

export default function PublicViewPage() {
    const params = useParams()
    const idArg = params.token as string // URL param is actually the ID now
    const supabase = createClient()

    const [step, setStep] = useState<'validating' | 'viewing' | 'expired' | 'error'>('validating')
    const [data, setData] = useState<SharedData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expiresIn, setExpiresIn] = useState<string | null>(null)

    useEffect(() => {
        validateAndLoad()
    }, [])

    const validateAndLoad = async () => {
        try {
            // 1. Get Key from URL Hash
            // window.location.hash returns "#key=..."
            const hash = window.location.hash
            const keyMatch = hash.match(/key=([^&]+)/)

            if (!keyMatch || !keyMatch[1]) {
                throw new Error('Chave de acesso inválida ou ausente na URL.')
            }

            const keyString = keyMatch[1]

            // 2. Fetch encrypted blob from Supabase using ID
            // We use the ID directly to find the share. 
            // Compatibility: The old code used token_hash. Now we use ID hash as lookup or just ID.
            // In SharePage we stored token_hash = hash(ID). So we must hash the ID here to find it.
            const idHash = await hashToken(idArg)

            const { data: shareData, error: dbError } = await supabase
                .from('subject_shares')
                .select('*')
                .eq('token_hash', idHash)
                .single()

            if (dbError || !shareData) {
                console.error('Database error:', dbError)
                throw new Error('Link não encontrado ou já expirou.')
            }

            // Calculate remaining time
            const expiresAt = new Date(shareData.expires_at)
            const now = new Date()

            if (expiresAt < now) {
                throw new Error('Este link expirou. Solicite um novo ao titular.')
            }

            const diffMs = expiresAt.getTime() - now.getTime()
            const diffMins = Math.ceil(diffMs / (1000 * 60))
            setExpiresIn(`${diffMins} minutos`)

            // 3. Decrypt data client-side
            try {
                // Import Key
                const key = await importKeyFromString(keyString)

                // Parse stored blob (base64 string -> JSON object {iv, ciphertext})
                const encryptedJsonString = window.atob(shareData.data_encrypted)
                const encryptedData = JSON.parse(encryptedJsonString)

                // Decrypt
                const decryptedPayload = await decryptShareData(encryptedData, key) as SharePayload

                setData(decryptedPayload.data)
            } catch (err) {
                console.error('Decryption error:', err)
                throw new Error('Falha na decifragem. A chave pode estar incorreta ou os dados corrompidos.')
            }

            // Update access count
            await supabase
                .from('subject_shares')
                .update({
                    accessed_at: now.toISOString(),
                    access_count: (shareData.access_count || 0) + 1
                })
                .eq('id', shareData.id)

            setStep('viewing')

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
            setStep('error')
        }
    }

    const formatValue = (key: string, value: string) => {
        if (key === 'cpf') return formatCPF(value)
        if (key === 'phone') return formatPhone(value)
        if (key === 'birth_date') return formatDate(value)
        return value
    }

    const getLabel = (key: string): string => {
        const labels: Record<string, string> = {
            full_name: 'Nome Completo',
            cpf: 'CPF',
            email: 'E-mail',
            phone: 'Telefone',
            birth_date: 'Data de Nascimento',
            address_line: 'Endereço',
            city: 'Cidade',
            state: 'Estado',
            postal_code: 'CEP'
        }
        return labels[key] || key.replace(/_/g, ' ')
    }

    if (step === 'validating') {
        return (
            <div className="py-16 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Lock className="h-4 w-4" />
                    <p>Decifrando dados com segurança...</p>
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
    const filledData = data ? Object.entries(data).filter(([_, value]) => value) : []

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
                                Expira em {expiresIn || '30 minutos'}
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
                            filledData.map(([key, value]) => (
                                <div key={key} className="px-6 py-4 flex justify-between items-center">
                                    <span className="text-gray-500">{getLabel(key)}</span>
                                    <span className="font-medium text-gray-900">
                                        {formatValue(key, value!)}
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
                Este acesso foi <strong>registrado</strong>.
                Os dados foram decifrados apenas neste dispositivo.
            </Alert>
        </div>
    )
}
