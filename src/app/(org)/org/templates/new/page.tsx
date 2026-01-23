'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Alert } from '@/components/ui'
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from 'lucide-react'
import Link from 'next/link'

interface BaseField {
    id: string
    slug: string
    label: string
    type: string
    is_sensitive: boolean
}

interface TemplateField {
    id?: string
    base_field_id: string
    is_required: boolean
    display_order: number
    base_field?: BaseField
}

export default function NewTemplatePage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [baseFields, setBaseFields] = useState<BaseField[]>([])

    // Form state
    const [name, setName] = useState('')
    const [codeShort, setCodeShort] = useState('')
    const [description, setDescription] = useState('')
    const [purpose, setPurpose] = useState('')
    const [selectedFields, setSelectedFields] = useState<TemplateField[]>([])

    // Load base fields
    useEffect(() => {
        async function loadBaseFields() {
            const { data } = await supabase
                .from('base_fields')
                .select('*')
                .order('created_at')

            if (data) setBaseFields(data)
        }
        loadBaseFields()
    }, [supabase])

    // Generate code_short automatically
    useEffect(() => {
        if (!codeShort && name) {
            const code = name
                .substring(0, 2)
                .toUpperCase()
                .replace(/[^A-Z]/g, '') +
                String(Math.floor(Math.random() * 100)).padStart(2, '0')
            setCodeShort(code)
        }
    }, [name, codeShort])

    const addField = (field: BaseField) => {
        if (selectedFields.some(f => f.base_field_id === field.id)) return

        setSelectedFields([
            ...selectedFields,
            {
                base_field_id: field.id,
                is_required: false,
                display_order: selectedFields.length,
                base_field: field
            }
        ])
    }

    const removeField = (fieldId: string) => {
        setSelectedFields(selectedFields.filter(f => f.base_field_id !== fieldId))
    }

    const toggleRequired = (fieldId: string) => {
        setSelectedFields(selectedFields.map(f =>
            f.base_field_id === fieldId ? { ...f, is_required: !f.is_required } : f
        ))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Get user's org
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Não autenticado')

            const { data: member } = await supabase
                .from('org_members')
                .select('org_id')
                .eq('user_id', user.id)
                .single()

            if (!member) throw new Error('Organização não encontrada')

            // Create template
            const { data: template, error: templateError } = await supabase
                .from('templates')
                .insert({
                    org_id: member.org_id,
                    name,
                    code_short: codeShort,
                    description,
                    purpose,
                    is_active: true
                })
                .select()
                .single()

            if (templateError) throw templateError

            // Create template fields
            if (selectedFields.length > 0) {
                const { error: fieldsError } = await supabase
                    .from('template_fields')
                    .insert(
                        selectedFields.map((f, index) => ({
                            template_id: template.id,
                            base_field_id: f.base_field_id,
                            is_required: f.is_required,
                            display_order: index
                        }))
                    )

                if (fieldsError) throw fieldsError
            }

            router.push('/org/templates')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao criar template')
        } finally {
            setLoading(false)
        }
    }

    const availableFields = baseFields.filter(
        bf => !selectedFields.some(sf => sf.base_field_id === bf.id)
    )

    return (
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/org/templates">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Novo Template</h1>
                    <p className="text-gray-600">Configure os campos que serão coletados</p>
                </div>
            </div>

            {error && (
                <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <Card variant="bordered">
                    <CardHeader>
                        <CardTitle>Informações Básicas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <Input
                                label="Nome do Template"
                                placeholder="Ex: Cadastro Inicial"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                            <Input
                                label="Código"
                                placeholder="Ex: CI01"
                                value={codeShort}
                                onChange={(e) => setCodeShort(e.target.value.toUpperCase().slice(0, 10))}
                                required
                                hint="Código curto único para identificação"
                            />
                        </div>
                        <Input
                            label="Descrição"
                            placeholder="Descreva o propósito deste template"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <Input
                            label="Finalidade (LGPD)"
                            placeholder="Por que esses dados são coletados?"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            hint="Será exibido para o titular - transparência"
                        />
                    </CardContent>
                </Card>

                {/* Fields Selection */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Available Fields */}
                    <Card variant="bordered">
                        <CardHeader>
                            <CardTitle className="text-base">Campos Disponíveis</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {availableFields.map((field) => (
                                    <button
                                        key={field.id}
                                        type="button"
                                        onClick={() => addField(field)}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{field.label}</p>
                                            <p className="text-sm text-gray-500">{field.type}</p>
                                        </div>
                                        <Plus className="h-4 w-4 text-gray-400" />
                                    </button>
                                ))}
                                {availableFields.length === 0 && (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        Todos os campos foram adicionados
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Selected Fields */}
                    <Card variant="bordered">
                        <CardHeader>
                            <CardTitle className="text-base">Campos Selecionados ({selectedFields.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {selectedFields.map((field, index) => (
                                    <div
                                        key={field.base_field_id}
                                        className="px-4 py-3 flex items-center gap-3"
                                    >
                                        <GripVertical className="h-4 w-4 text-gray-300 cursor-move" />
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{field.base_field?.label}</p>
                                            <p className="text-sm text-gray-500">{field.base_field?.type}</p>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={field.is_required}
                                                onChange={() => toggleRequired(field.base_field_id)}
                                                className="rounded border-gray-300"
                                            />
                                            Obrigatório
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => removeField(field.base_field_id)}
                                            className="p-1 text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {selectedFields.length === 0 && (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        Clique nos campos à esquerda para adicionar
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3">
                    <Link href="/org/templates">
                        <Button type="button" variant="outline">Cancelar</Button>
                    </Link>
                    <Button type="submit" loading={loading} disabled={!name || selectedFields.length === 0}>
                        <Save className="h-4 w-4" />
                        Salvar Template
                    </Button>
                </div>
            </form>
        </div>
    )
}
