import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui'
import { Plus, FileText, QrCode, MoreVertical, Edit, Trash2 } from 'lucide-react'

export default async function TemplatesPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Get user's org
    const { data: member } = await supabase
        .from('org_members')
        .select('org_id, role, orgs(name)')
        .eq('user_id', user.id)
        .single()

    if (!member) {
        redirect('/onboarding')
    }

    // Get templates for this org
    const { data: templates } = await supabase
        .from('templates')
        .select(`
      *,
      template_fields(count)
    `)
        .eq('org_id', member.org_id)
        .order('created_at', { ascending: false })

    return (
        <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
                    <p className="text-gray-600 mt-1">Modelos de coleta de dados</p>
                </div>
                <Link href="/org/templates/new">
                    <Button>
                        <Plus className="h-4 w-4" />
                        Novo Template
                    </Button>
                </Link>
            </div>

            {/* Templates Grid */}
            {templates && templates.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <Card key={template.id} variant="bordered" className="hover:border-blue-300 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{template.name}</CardTitle>
                                            <p className="text-sm text-gray-500">Código: {template.code_short}</p>
                                        </div>
                                    </div>
                                    <Badge variant={template.is_active ? 'success' : 'default'}>
                                        {template.is_active ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {template.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                        {template.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <span className="text-sm text-gray-500">
                                        {template.template_fields?.[0]?.count || 0} campos
                                    </span>
                                    <div className="flex gap-2">
                                        <Link href={`/org/templates/${template.id}/qr`}>
                                            <Button size="sm" variant="outline">
                                                <QrCode className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Link href={`/org/templates/${template.id}`}>
                                            <Button size="sm" variant="ghost">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card variant="bordered">
                    <CardContent className="py-16 text-center">
                        <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                            <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Nenhum template criado
                        </h3>
                        <p className="text-gray-500 mb-6">
                            Crie seu primeiro template para começar a coletar dados
                        </p>
                        <Link href="/org/templates/new">
                            <Button>
                                <Plus className="h-4 w-4" />
                                Criar Template
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
