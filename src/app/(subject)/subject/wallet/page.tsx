'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Alert } from '@/components/ui'
import {
    User,
    Phone,
    Mail,
    MapPin,
    Calendar,
    Edit2,
    Shield,
    CheckCircle,
    Download,
    Upload,
    AlertTriangle,
    Cloud,
    LogOut,
    RefreshCw,
    ArrowUp,
    ArrowDown
} from 'lucide-react'
import {
    getWalletData,
    saveWalletData,
    initWallet,
    WalletData
} from '@/lib/wallet'
import {
    exportBackup,
    downloadBackup,
    getBackupFilename,
    validateBackupFile,
    parseBackupFile,
    decryptBackup,
    restoreFromBackup,
    readFileAsText
} from '@/lib/wallet/backup'
import {
    syncWalletToCloud,
    syncWalletFromCloud,
    hasCloudData
} from '@/lib/wallet/sync'
import { formatCPF, formatPhone, validateCPF, validateEmail } from '@/lib/utils'

const FIELD_CONFIG = [
    { key: 'full_name', label: 'Nome Completo', icon: User, type: 'text' },
    { key: 'cpf', label: 'CPF', icon: Shield, type: 'cpf' },
    { key: 'birth_date', label: 'Data de Nascimento', icon: Calendar, type: 'date' },
    { key: 'email', label: 'E-mail', icon: Mail, type: 'email' },
    { key: 'phone', label: 'Telefone', icon: Phone, type: 'tel' },
    { key: 'address_line', label: 'Endereço', icon: MapPin, type: 'text' },
    { key: 'city', label: 'Cidade', icon: MapPin, type: 'text' },
    { key: 'state', label: 'Estado', icon: MapPin, type: 'text' },
    { key: 'postal_code', label: 'CEP', icon: MapPin, type: 'text' },
]

export default function WalletPage() {
    const router = useRouter()
    const supabase = createClient()
    const editInputRef = useRef<HTMLInputElement>(null)
    const isCommittingRef = useRef(false)

    const [data, setData] = useState<WalletData>({})
    const [editing, setEditing] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [originalValue, setOriginalValue] = useState('')
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Auth state
    const [user, setUser] = useState<any>(null)
    const [hasCloud, setHasCloud] = useState(false)

    // Backup states
    const [showBackupModal, setShowBackupModal] = useState<'export' | 'import' | 'sync' | null>(null)
    const [backupPassphrase, setBackupPassphrase] = useState('')
    const [backupConfirmPassphrase, setBackupConfirmPassphrase] = useState('')
    const [backupError, setBackupError] = useState<string | null>(null)
    const [backupLoading, setBackupLoading] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importPreview, setImportPreview] = useState<WalletData | null>(null)
    const [syncMode, setSyncMode] = useState<'push' | 'pull' | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const loadWallet = async () => {
            await initWallet()
            const walletData = await getWalletData()
            setData(walletData)
        }

        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            if (user) {
                const has = await hasCloudData()
                setHasCloud(has)
            }
        }

        loadWallet()
        checkAuth()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
        router.refresh()
    }

    const startEditing = (key: string) => {
        setEditing(key)
        const currentValue = data[key] || ''
        setEditValue(currentValue)
        setOriginalValue(currentValue)
        setError(null)
    }

    const cancelEditing = () => {
        setEditing(null)
        setEditValue(originalValue)
        setOriginalValue('')
        setError(null)
    }

    const commitEdit = async () => {
        if (!editing) return

        setError(null)

        const currentValue = data[editing] || ''
        if (editValue === currentValue) {
            setEditing(null)
            setEditValue('')
            setOriginalValue('')
            setError(null)
            return
        }

        // Validation
        if (editing === 'cpf' && editValue && !validateCPF(editValue)) {
            setError('CPF inválido')
            setTimeout(() => editInputRef.current?.focus(), 0)
            return
        }
        if (editing === 'email' && editValue && !validateEmail(editValue)) {
            setError('E-mail inválido')
            setTimeout(() => editInputRef.current?.focus(), 0)
            return
        }

        if (isCommittingRef.current) return
        isCommittingRef.current = true
        try {
            const newData = { ...data, [editing]: editValue }
            await saveWalletData(newData)
            setData(newData)
            setEditing(null)
            setEditValue('')
            setOriginalValue('')
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setError('Erro ao salvar')
        } finally {
            isCommittingRef.current = false
        }
    }

    const handleEditKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            commitEdit()
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            cancelEditing()
        }
    }

    const formatValue = (key: string, value: string) => {
        if (!value) return ''
        if (key === 'cpf') return formatCPF(value)
        if (key === 'phone') return formatPhone(value)
        return value
    }

    // Backup functions
    const handleExportBackup = async () => {
        if (backupPassphrase.length < 8) {
            setBackupError('A senha deve ter pelo menos 8 caracteres')
            return
        }
        if (backupPassphrase !== backupConfirmPassphrase) {
            setBackupError('As senhas não coincidem')
            return
        }

        setBackupLoading(true)
        setBackupError(null)

        try {
            const blob = await exportBackup(backupPassphrase)
            downloadBackup(blob, getBackupFilename())
            setShowBackupModal(null)
            setBackupPassphrase('')
            setBackupConfirmPassphrase('')
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : 'Erro ao exportar')
        } finally {
            setBackupLoading(false)
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImportFile(file)
        setImportPreview(null)
        setBackupError(null)

        try {
            const content = await readFileAsText(file)
            const validation = validateBackupFile(content)

            if (!validation.valid) {
                setBackupError(validation.error || 'Arquivo inválido')
                return
            }
        } catch (err) {
            setBackupError('Erro ao ler arquivo')
        }
    }

    const handleDecryptBackup = async () => {
        if (!importFile || backupPassphrase.length < 8) {
            setBackupError('Selecione um arquivo e informe a senha')
            return
        }

        setBackupLoading(true)
        setBackupError(null)

        try {
            const content = await readFileAsText(importFile)
            const backup = parseBackupFile(content)
            const result = await decryptBackup(backup, backupPassphrase)
            setImportPreview(result.data)
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : 'Erro ao decifrar')
        } finally {
            setBackupLoading(false)
        }
    }

    const handleConfirmImport = async () => {
        if (!importPreview) return

        setBackupLoading(true)
        setBackupError(null)

        try {
            await restoreFromBackup(importPreview)
            setData(importPreview)
            setShowBackupModal(null)
            setBackupPassphrase('')
            setImportFile(null)
            setImportPreview(null)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : 'Erro ao importar')
        } finally {
            setBackupLoading(false)
        }
    }

    // Cloud Sync functions
    const handleSync = async () => {
        if (backupPassphrase.length < 8) {
            setBackupError('A senha deve ter pelo menos 8 caracteres')
            return
        }

        setBackupLoading(true)
        setBackupError(null)

        try {
            if (syncMode === 'push') {
                await syncWalletToCloud(backupPassphrase)
                setHasCloud(true)
                setSaved(true) // Show success
            } else {
                const newData = await syncWalletFromCloud(backupPassphrase)
                setData(newData)
                setSaved(true) // Show success
            }
            setShowBackupModal(null)
            setBackupPassphrase('')
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setBackupError(err instanceof Error ? err.message : 'Erro na sincronização')
        } finally {
            setBackupLoading(false)
        }
    }

    const closeBackupModal = () => {
        setShowBackupModal(null)
        setBackupPassphrase('')
        setBackupConfirmPassphrase('')
        setBackupError(null)
        setImportFile(null)
        setImportPreview(null)
        setSyncMode(null)
    }

    const filledCount = FIELD_CONFIG.filter(f => data[f.key]).length
    const totalCount = FIELD_CONFIG.length
    const progress = Math.round((filledCount / totalCount) * 100)

    return (
        <div className="py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Minha Carteira</h1>
                    <p className="text-gray-600 mt-1">
                        {user ? 'Sincronização ativa' : 'Dados locais'}
                    </p>
                </div>
                {user ? (
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sair
                    </Button>
                ) : (
                    <Button size="sm" onClick={() => router.push('/subject/login')}>
                        <User className="h-4 w-4 mr-2" />
                        Entrar
                    </Button>
                )}
            </div>

            {/* Cloud Sync Status */}
            {user && (
                <Card variant="bordered" className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-full">
                                <Cloud className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-900">Backup em Nuvem</p>
                                <p className="text-xs text-blue-700">
                                    {hasCloud ? 'Seus dados estão na nuvem' : 'Nenhum backup encontrado'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="bg-white border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                    setSyncMode('push')
                                    setShowBackupModal('sync')
                                }}
                            >
                                <ArrowUp className="h-4 w-4 mr-1" />
                                Salvar
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="bg-white border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                    setSyncMode('pull')
                                    setShowBackupModal('sync')
                                }}
                            >
                                <ArrowDown className="h-4 w-4 mr-1" />
                                Baixar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Progress */}
            <Card variant="bordered">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Perfil completo</span>
                        <span className="text-sm text-gray-500">{filledCount}/{totalCount} campos</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {saved && (
                <Alert variant="success" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Operação realizada com sucesso!
                </Alert>
            )}

            {/* Backup Buttons (Offline) */}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowBackupModal('export')}
                    disabled={filledCount === 0}
                >
                    <Download className="h-4 w-4" />
                    Exportar Arquivo
                </Button>
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowBackupModal('import')}
                >
                    <Upload className="h-4 w-4" />
                    Importar Arquivo
                </Button>
            </div>

            {/* Fields */}
            <Card variant="bordered">
                <CardHeader className="border-b">
                    <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-gray-100">
                    {FIELD_CONFIG.map((field) => {
                        const Icon = field.icon
                        const isEditing = editing === field.key
                        const value = data[field.key]

                        return (
                            <div key={field.key} className="p-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                            <Icon className="h-4 w-4 text-gray-400" />
                                            {field.label}
                                        </div>
                                        <Input
                                            type={field.type}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={commitEdit}
                                            onKeyDown={handleEditKeyDown}
                                            error={error || undefined}
                                            autoFocus
                                            ref={editInputRef}
                                        />
                                        <p className="text-xs text-gray-500">
                                            Salva automaticamente ao sair do campo.
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => startEditing(field.key)}
                                        className="w-full flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                                                <Icon className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm text-gray-500">{field.label}</p>
                                                <p className="font-medium text-gray-900">
                                                    {value ? formatValue(field.key, value) : (
                                                        <span className="text-gray-400">Não preenchido</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Edit2 className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Info */}
            <Alert variant="info">
                <strong>Seus dados são armazenados localmente</strong> ou cifrados na nuvem (se logado) e só são compartilhados quando você autoriza.
            </Alert>

            {/* Export Modal */}
            {showBackupModal === 'export' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card variant="elevated" className="w-full max-w-md">
                        <CardHeader className="border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Download className="h-5 w-5" />
                                Exportar Backup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <Alert variant="warning">
                                <AlertTriangle className="h-4 w-4 inline mr-2" />
                                <strong>Atenção:</strong> Sem a senha correta, não será possível recuperar seus dados.
                            </Alert>

                            <Input
                                type="password"
                                label="Senha de Backup"
                                placeholder="Mínimo 8 caracteres"
                                value={backupPassphrase}
                                onChange={(e) => setBackupPassphrase(e.target.value)}
                            />

                            <Input
                                type="password"
                                label="Confirmar Senha"
                                placeholder="Digite novamente"
                                value={backupConfirmPassphrase}
                                onChange={(e) => setBackupConfirmPassphrase(e.target.value)}
                            />

                            {backupError && (
                                <Alert variant="error">{backupError}</Alert>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    className="flex-1"
                                    onClick={handleExportBackup}
                                    loading={backupLoading}
                                >
                                    <Download className="h-4 w-4" />
                                    Baixar Backup
                                </Button>
                                <Button variant="outline" onClick={closeBackupModal}>
                                    Cancelar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Import Modal */}
            {showBackupModal === 'import' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card variant="elevated" className="w-full max-w-md">
                        <CardHeader className="border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5" />
                                Importar Backup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {!importPreview ? (
                                <>
                                    <Alert variant="warning">
                                        <AlertTriangle className="h-4 w-4 inline mr-2" />
                                        <strong>Atenção:</strong> Importar um backup substituirá os dados atuais.
                                    </Alert>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Arquivo de Backup
                                        </label>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".json"
                                            onChange={handleFileSelect}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {importFile && (
                                            <p className="mt-2 text-sm text-gray-600">
                                                Arquivo: {importFile.name}
                                            </p>
                                        )}
                                    </div>

                                    <Input
                                        type="password"
                                        label="Senha do Backup"
                                        placeholder="Digite a senha usada na exportação"
                                        value={backupPassphrase}
                                        onChange={(e) => setBackupPassphrase(e.target.value)}
                                    />

                                    {backupError && (
                                        <Alert variant="error">{backupError}</Alert>
                                    )}

                                    <div className="flex gap-3">
                                        <Button
                                            className="flex-1"
                                            onClick={handleDecryptBackup}
                                            loading={backupLoading}
                                            disabled={!importFile}
                                        >
                                            Decifrar Backup
                                        </Button>
                                        <Button variant="outline" onClick={closeBackupModal}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Alert variant="success">
                                        <CheckCircle className="h-4 w-4 inline mr-2" />
                                        Backup decifrado com sucesso!
                                    </Alert>

                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">
                                            Campos encontrados ({Object.keys(importPreview).filter(k => importPreview[k]).length}):
                                        </p>
                                        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                                            {Object.entries(importPreview).filter(([_, v]) => v).map(([key, value]) => (
                                                <div key={key} className="flex justify-between">
                                                    <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                                                    <span className="text-gray-900">
                                                        {key === 'cpf' ? '***.***.***-' + value!.slice(-2) : '••••••'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {backupError && (
                                        <Alert variant="error">{backupError}</Alert>
                                    )}

                                    <div className="flex gap-3">
                                        <Button
                                            className="flex-1"
                                            onClick={handleConfirmImport}
                                            loading={backupLoading}
                                        >
                                            Confirmar Importação
                                        </Button>
                                        <Button variant="outline" onClick={closeBackupModal}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Sync Modal */}
            {showBackupModal === 'sync' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card variant="elevated" className="w-full max-w-md">
                        <CardHeader className="border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Cloud className="h-5 w-5" />
                                {syncMode === 'push' ? 'Salvar na Nuvem' : 'Baixar da Nuvem'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <Alert variant={syncMode === 'push' ? 'info' : 'warning'}>
                                {syncMode === 'push'
                                    ? 'Seus dados serão cifrados com sua senha antes de sair do dispositivo.'
                                    : 'Isso substituirá seus dados locais pelos dados da nuvem.'
                                }
                            </Alert>

                            <Input
                                type="password"
                                label="Sua Senha de Criptografia"
                                placeholder="Mínimo 8 caracteres"
                                value={backupPassphrase}
                                onChange={(e) => setBackupPassphrase(e.target.value)}
                            />

                            {backupError && (
                                <Alert variant="error">{backupError}</Alert>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    className="flex-1"
                                    onClick={handleSync}
                                    loading={backupLoading}
                                >
                                    {syncMode === 'push' ? 'Cifrar e Enviar' : 'Baixar e Decifrar'}
                                </Button>
                                <Button variant="outline" onClick={closeBackupModal}>
                                    Cancelar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
