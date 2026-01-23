'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Alert } from '@/components/ui'
import { Copy, MessageCircle, CheckCircle, Clock, Lock } from 'lucide-react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { getWalletData, hasWalletData, WalletData } from '@/lib/wallet'
import { generateShareKey, exportKeyToString, encryptShareData } from '@/lib/crypto/zk-share'

interface SharePayload {
    meta: {
        createdAt: string
        expiresAt: string
        version: number
    }
    fields: Array<{
        slug: string
        label: string
        value: string
    }>
}

// Generate a random ID for the share (UUID v4 style)
function generateShareId() {
    return crypto.randomUUID()
}

function formatLabel(slug: string) {
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
    return labels[slug] || slug.replace(/_/g, ' ')
}

export default function SharePage() {
    const supabase = useMemo(() => createClient(), [])
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
    const keyRef = useRef<CryptoKey | null>(null)

    const [walletData, setWalletData] = useState<WalletData>({})
    const [hasData, setHasData] = useState(false)
    const [loading, setLoading] = useState(true)
    const [shareId, setShareId] = useState<string | null>(null)
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [sending, setSending] = useState(false)
    const [receiverReady, setReceiverReady] = useState(false)
    const [sent, setSent] = useState(false)
    const [expiresAt, setExpiresAt] = useState<number | null>(null)
    const [remaining, setRemaining] = useState<string | null>(null)
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

    useEffect(() => {
        if (!expiresAt) return

        const interval = setInterval(() => {
            const diff = expiresAt - Date.now()
            if (diff <= 0) {
                setRemaining('0:00')
                clearInterval(interval)
                return
            }
            const minutes = Math.floor(diff / 60000)
            const seconds = Math.floor((diff % 60000) / 1000)
            setRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }, 1000)

        return () => clearInterval(interval)
    }, [expiresAt])

    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [supabase])

    const setupChannel = (id: string) => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current)
        }

        const channel = supabase.channel(`public:${id}`, {
            config: { broadcast: { self: false } }
        })

        channel.on('broadcast', { event: 'ready' }, () => {
            setReceiverReady(true)
        })

        channel.subscribe()
        channelRef.current = channel
    }

    const generateLink = async () => {
        setGenerating(true)
        setError(null)
        setSent(false)
        setReceiverReady(false)

        try {
            // 1. Generate local encryption key (never sent to server)
            const key = await generateShareKey()
            const keyString = await exportKeyToString(key)
            keyRef.current = key

            // 2. Generate Share ID (Public ID)
            const id = generateShareId()

            // 3. Expiration: 10 minutes
            const expiresAtMs = Date.now() + 10 * 60 * 1000

            // 4. Construct URL with hash fragment (key) and exp query
            const baseUrl = window.location.origin
            const url = `${baseUrl}/public/view/${id}?exp=${expiresAtMs}#key=${keyString}`

            setShareId(id)
            setShareUrl(url)
            setExpiresAt(expiresAtMs)
            setupChannel(id)

            const qr = await QRCode.toDataURL(url, {
                margin: 1,
                width: 280,
                color: { dark: '#0f172a', light: '#ffffff' }
            })
            setQrDataUrl(qr)
        } catch (err) {
            console.error('Error generating link:', err)
            setError(err instanceof Error ? err.message : 'Erro ao gerar link')
        } finally {
            setGenerating(false)
        }
    }

    const sendPayload = async () => {
        if (!keyRef.current || !channelRef.current || !shareId || !shareUrl) return
        if (expiresAt && Date.now() > expiresAt) {
            setError('Link expirado. Gere um novo.')
            return
        }

        setSending(true)
        setError(null)

        try {
            const filledFields = Object.entries(walletData).filter(([_, value]) => value)
            const payload: SharePayload = {
                meta: {
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(expiresAt || Date.now()).toISOString(),
                    version: 1
                },
                fields: filledFields.map(([key, value]) => ({
                    slug: key,
                    label: formatLabel(key),
                    value: value as string
                }))
            }

            const encrypted = await encryptShareData(payload, keyRef.current)

            await channelRef.current.send({
                type: 'broadcast',
                event: 'payload',
                payload: encrypted
            })

            setSent(true)
        } catch (err) {
            console.error('Error sending payload:', err)
            setError(err instanceof Error ? err.message : 'Erro ao enviar dados')
        } finally {
            setSending(false)
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
                `Acesse meus dados (protegidos com criptografia de ponta a ponta) através deste link:\n${shareUrl}\n\nVálido por 10 minutos.`
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
                                Compartilhe o link ou QR Code com o receptor
                            </p>

                            {qrDataUrl && (
                                <div className="bg-white p-3 rounded-xl inline-block shadow-sm mb-4">
                                    <img src={qrDataUrl} alt="QR Code" className="h-48 w-48" />
                                </div>
                            )}

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

                            <div className="mt-4">
                                <Alert variant={receiverReady ? 'success' : 'info'}>
                                    {receiverReady
                                        ? 'Receptor conectado. Envie os dados agora.'
                                        : 'Aguardando o receptor abrir o link.'}
                                </Alert>
                                <Button
                                    className="w-full mt-3"
                                    onClick={sendPayload}
                                    loading={sending}
                                    disabled={!receiverReady || sent}
                                >
                                    {sent ? 'Dados enviados' : 'Enviar dados agora'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Alert variant="warning">
                        <Clock className="h-4 w-4 inline mr-2" />
                        Este link expira em <strong>10 minutos</strong>.
                        {remaining && <span className="ml-1">Tempo restante: {remaining}.</span>}
                    </Alert>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            setShareId(null)
                            setShareUrl(null)
                            setQrDataUrl(null)
                            setExpiresAt(null)
                            setRemaining(null)
                            setReceiverReady(false)
                            setSent(false)
                        }}
                    >
                        Gerar Novo Link
                    </Button>
                </>
            )}
        </div>
    )
}
