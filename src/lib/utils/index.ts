import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind class merge utility
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Format CPF: 000.000.000-00
export function formatCPF(cpf: string): string {
    const digits = cpf.replace(/\D/g, '')
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// Mask CPF: ***.***.***-00 (show only last 2 digits)
export function maskCPF(cpf: string): string {
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) return cpf
    return `***.***.***.${digits.slice(-2)}`
}

// Format phone: (11) 99999-9999
export function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
    if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    }
    return phone
}

// Format postal code: 00000-000
export function formatPostalCode(cep: string): string {
    const digits = cep.replace(/\D/g, '')
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2')
}

// Format date: DD/MM/YYYY
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('pt-BR')
}

// Format datetime: DD/MM/YYYY HH:mm
export function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// Relative time (e.g., "há 5 minutos")
export function relativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `há ${diffMins} min`
    if (diffHours < 24) return `há ${diffHours}h`
    if (diffDays < 30) return `há ${diffDays}d`

    return formatDate(d)
}

// Validate CPF
export function validateCPF(cpf: string): boolean {
    const digits = cpf.replace(/\D/g, '')

    if (digits.length !== 11) return false
    if (/^(\d)\1{10}$/.test(digits)) return false // All same digits

    // Calculate check digits
    let sum = 0
    for (let i = 0; i < 9; i++) {
        sum += parseInt(digits[i]) * (10 - i)
    }
    let remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(digits[9])) return false

    sum = 0
    for (let i = 0; i < 10; i++) {
        sum += parseInt(digits[i]) * (11 - i)
    }
    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0

    return remainder === parseInt(digits[10])
}

// Validate email
export function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validate phone
export function validatePhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '')
    return digits.length === 10 || digits.length === 11
}

// Truncate string with ellipsis
export function truncate(str: string, length: number): string {
    if (str.length <= length) return str
    return str.slice(0, length) + '...'
}

// Slugify string
export function slugify(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}

// Generate random ID
export function generateId(): string {
    return crypto.randomUUID()
}
