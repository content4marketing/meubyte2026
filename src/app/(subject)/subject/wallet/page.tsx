'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Input, Alert } from '@/components/ui'
import {
    User,
    Phone,
    Mail,
    MapPin,
    Calendar,
    Edit2,
    Shield
} from 'lucide-react'
import {
    getWalletData,
    saveWalletData,
    initWallet,
    WalletData
} from '@/lib/wallet'
import { formatCPF, formatPhone, formatDate, validateCPF, validateEmail } from '@/lib/utils'

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

function formatBirthDateDisplay(value: string) {
    if (!value) return ''
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
    }
    const slashMatch = value.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/)
    if (slashMatch) {
        return `${slashMatch[1]}/${slashMatch[2]}/${slashMatch[3]}`
    }
    return value
}

function normalizeValue(key: string, value: string): string | null {
    if (key !== 'birth_date') return value
    if (!value) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const match = value.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/)
    if (!match) return null
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    if (!day || !month || !year) return null
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatBirthDateInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    const parts = []
    if (digits.length >= 2) parts.push(digits.slice(0, 2))
    if (digits.length >= 4) parts.push(digits.slice(2, 4))
    if (digits.length > 4) parts.push(digits.slice(4))
    return parts.join('/')
}

export default function WalletPage() {
    const editInputRef = useRef<HTMLInputElement>(null)
    const datePickerRef = useRef<HTMLInputElement>(null)
    const isCommittingRef = useRef(false)
    const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [data, setData] = useState<WalletData>({})
    const [editing, setEditing] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [originalValue, setOriginalValue] = useState('')
    const [savedField, setSavedField] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadWallet = async () => {
            await initWallet()
            const walletData = await getWalletData()
            setData(walletData)
        }

        loadWallet()
    }, [])

    useEffect(() => {
        return () => {
            if (savedTimeoutRef.current) {
                clearTimeout(savedTimeoutRef.current)
                savedTimeoutRef.current = null
            }
        }
    }, [])

    const startEditing = (key: string) => {
        setEditing(key)
        const currentValue = data[key] || ''
        const displayValue = key === 'birth_date' ? formatBirthDateDisplay(currentValue) : currentValue
        setEditValue(displayValue)
        setOriginalValue(displayValue)
        setError(null)
    }

    const cancelEditing = () => {
        setEditing(null)
        setEditValue(originalValue)
        setOriginalValue('')
        setError(null)
    }

    const markSaved = (key: string) => {
        setSavedField(key)
        if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current)
        }
        savedTimeoutRef.current = setTimeout(() => {
            setSavedField(null)
            savedTimeoutRef.current = null
        }, 1500)
    }

    const commitEdit = async (overrideValue?: string) => {
        if (!editing) return

        setError(null)

        const currentValue = data[editing] || ''
        const candidateValue = (overrideValue ?? editValue).trim()
        const normalizedValue = normalizeValue(editing, candidateValue)

        if (normalizedValue === null) {
            setError('Data inválida')
            setTimeout(() => editInputRef.current?.focus(), 0)
            return
        }

        if (normalizedValue === currentValue) {
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
            const savedKey = editing
            const newData = { ...data, [editing]: normalizedValue }
            await saveWalletData(newData)
            setData(newData)
            setEditing(null)
            setEditValue('')
            setOriginalValue('')
            markSaved(savedKey)
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
        if (key === 'birth_date') return formatDate(value)
        return value
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
                        Seus dados ficam salvos apenas neste aparelho.
                    </p>
                </div>
            </div>

            <Alert variant="info">
                Os dados são mantidos salvos localmente no seu aparelho, e nunca são vistos ou utilizados pelo MeuByte.
            </Alert>

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
                        const isBirthDate = field.key === 'birth_date'
                        const normalizedBirthDate = isBirthDate ? normalizeValue('birth_date', editValue) : null

                        return (
                            <div key={field.key} className="p-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-gray-400" />
                                                {field.label}
                                            </div>
                                            {savedField === field.key && (
                                                <span className="text-xs text-emerald-600">Salvo ✓</span>
                                            )}
                                        </div>
                                        {isBirthDate ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <Input
                                                        type="text"
                                                        placeholder="DD/MM/AAAA"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(formatBirthDateInput(e.target.value))}
                                                        onBlur={() => commitEdit()}
                                                        onKeyDown={handleEditKeyDown}
                                                        error={error || undefined}
                                                        autoFocus
                                                        ref={editInputRef}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                        if (!datePickerRef.current) return
                                                        if ('showPicker' in datePickerRef.current) {
                                                            datePickerRef.current.showPicker()
                                                        } else {
                                                            datePickerRef.current.focus()
                                                        }
                                                    }}
                                                    className="h-10 w-10 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                                    aria-label="Abrir calendário"
                                                    tabIndex={-1}
                                                >
                                                    <Calendar className="h-4 w-4 mx-auto" />
                                                </button>
                                                <input
                                                    ref={datePickerRef}
                                                    type="date"
                                                    className="sr-only"
                                                    value={normalizedBirthDate || ''}
                                                    onChange={(event) => {
                                                        const nextValue = event.target.value
                                                        if (!nextValue) return
                                                        setEditValue(formatBirthDateDisplay(nextValue))
                                                        commitEdit(nextValue)
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <Input
                                                type={field.type}
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => commitEdit()}
                                                onKeyDown={handleEditKeyDown}
                                                error={error || undefined}
                                                autoFocus
                                                ref={editInputRef}
                                            />
                                        )}
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
                                        <div className="flex items-center gap-2">
                                            {savedField === field.key && (
                                                <span className="text-xs text-emerald-600">Salvo ✓</span>
                                            )}
                                            <Edit2 className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                                        </div>
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    )
}
