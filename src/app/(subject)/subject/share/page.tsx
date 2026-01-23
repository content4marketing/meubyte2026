'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Alert } from '@/components/ui'
import { Copy, MessageCircle, CheckCircle, Share2, Clock, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getWalletData, hasWalletData, getAnonId, WalletData } from '@/lib/wallet'
import { generateShareKey, exportKeyToString, encryptShareData } from '@/lib/crypto/zk-share'
import { hashToken } from '@/lib/utils/tokens'

// Generate a random ID for the share (UUID v4 style)
function generateShareId() {
    return crypto.randomUUID()
}

export default function SharePage() {
    const supabase = createClient()

    const [walletData, setWalletData] = useState<WalletData>({})
    const [hasData, setHasData] = useState(false)
    const [loading, setLoading] = useState(true)
    const [shareId, setShareId] = useState<string | null>(null)
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadData() {
            const data = await getWalletData()
            setWalletData(data)
            const has = await hasWalletData()
            setHasData(has)
            setLoading(false)
        }
        loadData()
    }, [])

    const generateLink = async () => {
        setGenerating(true)
        setError(null)

        try {
            // 1. Generate local encryption key (never sent to server)
            const key = await generateShareKey()
            const keyString = await exportKeyToString(key)

            // 2. Generate Share ID (Public ID)
            const id = generateShareId()

            // 3. Encrypt data with the key
            // We wrap the wallet data in a structure that supports future file uploads (blobs)
            const payload = {
                data: walletData,
                timestamp: Date.now(),
                version: 1
            }

            const encrypted = await encryptShareData(payload, key)

            // 4. Get anonymous ID for ownership
            const anonId = await getAnonId()

            // 5. Encrypt data for storage (base64 of ciphertext+iv combined or JSON)
            // For simplicity let's store JSON string of the encrypted object
            const storedBlob = JSON.stringify(encrypted)

            // 6. Expiration: 30 minutes
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

            // 7. Save to Supabase
            // Note: We use the ID as the lookup key. token_hash is reused or we can just use ID.
            // To minimal changes, we'll hash the ID to store in token_hash (just to satisfy constraint)
            // client-side hashing of public ID is fine.
            const idHash = await hashToken(id)

            const { error: dbError } = await supabase
                .from('subject_shares')
                .insert({
                    token_hash: idHash, // Using ID hash as lookup index
                    subject_anon_id: anonId,
                    data_encrypted: window.btoa(storedBlob), // Store as base64 string
                    expires_at: expiresAt
                })

            if (dbError) {
                console.error('Database error:', dbError)
                throw new Error('Erro ao salvar compartilhamento')
            }

            // 8. Construct URL with Hash Fragment
            // Format: /public/view/<ID>#key=<KEY>
            const baseUrl = window.location.origin
            const url = `${baseUrl}/public/view/${id}#key=${keyString}`

            setShareId(id)
            setShareUrl(url)

        } catch (err) {
            console.error('Error generating link:', err)
            setError(err instanceof Error ? err.message : 'Erro ao gerar link')
        } finally {
            setGenerating(false)
        }
    }

    const copyLink = async () => {
        if (shareUrl) {
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const shareWhatsApp = () => {
        if (shareUrl) {
            const message = encodeURIComponent(
                `Acesse meus dados (protegidos com criptografia de ponta a ponta) através deste link:\n${shareUrl}\n\nVálido por 30 minutos.`
            )
            window.open(`https://wa.me/?text=${message}`, '_blank')
        }
    }

    if (loading) {
        return (
            <div className="py-16 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
        )
    }

    const filledFields = Object.entries(walletData).filter(([_, value]) => value)

    return (
        <div className="py-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Compartilhar Dados</h1>
                <p className="text-gray-600 mt-1">Gere um link com criptografia Zero-Knowledge</p>
            </div>

            {error && (
                <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {!hasData ? (
                <Alert variant="warning">
                    Você ainda não preencheu dados na sua carteira.
                    <a href="/subject/wallet" className="font-medium underline ml-1">
                        Preencher agora
                    </a>
                </Alert>
            ) : !shareId ? (
                <>
                    {/* Data Preview */}
                    <Card variant="bordered">
                        <CardHeader>
                            <CardTitle className="text-base">Dados a compartilhar</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {filledFields.map(([key, value]) => (
                                    <div key={key} className="px-4 py-3 flex justify-between">
                                        <span className="text-gray-500 capitalize">
                                            {key.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-gray-900">
                                            {key === 'cpf' ? '***.***.***-' + value!.slice(-2) : '••••••'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        className="w-full"
                        size="lg"
                        onClick={generateLink}
                        loading={generating}
                    >
                        <Lock className="h-4 w-4 mr-2" />
                        Gerar Link Seguro (E2E)
                    </Button>

                    <Alert variant="info">
                        <Lock className="h-3 w-3 inline mr-2" />
                        <strong>Zero-Knowledge:</strong> A chave de decifragem fica na URL e nunca é enviada ao servidor. O servidor vê apenas dados embaralhados (blob).
                    </Alert>
                </>
            ) : (
                <>
                    {/* Share Token Generated */}
                    <Card variant="bordered" className="bg-green-50 border-green-200">
                        <CardContent className="p-6 text-center">
                            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">
                                Link Seguro Gerado!
                            </h2>
                            <p className="text-gray-600 text-sm mb-4">
                                A chave de acesso está incluída no link
                            </p>

                            <div className="bg-gray-50 rounded-lg p-3 mb-6 break-all text-xs text-gray-600 font-mono border border-gray-200">
                                {shareUrl}
                            </div>

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
                        </CardContent>
                    </Card>

                    <Alert variant="warning">
                        <Clock className="h-4 w-4 inline mr-2" />
                        Este link expira em <strong>30 minutos</strong>.
                    </Alert>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            setShareId(null)
                            setShareUrl(null)
                        }}
                    >
                        Gerar Novo Link
                    </Button>
                </>
            )}
        </div>
    )
}
