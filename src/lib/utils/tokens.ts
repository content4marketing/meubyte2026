/**
 * MeuByte MVP - Token Generation
 * Based on BLUEPRINT.md section 16
 * 
 * Crockford Base32 tokens with check digit
 * Format: ABCD-EFGH-IJKL-X (12 chars + checksum)
 */

// Crockford Base32 alphabet (excludes I, L, O, U to reduce confusion)
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Character equivalences per BLUEPRINT.md
const EQUIVALENCES: Record<string, string> = {
    'O': '0',
    'I': '1',
    'L': '1'
}

// Generate random bytes
function getRandomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length))
}

// Encode bytes to Crockford Base32
function toCrockford(bytes: Uint8Array): string {
    let result = ''
    let buffer = 0
    let bitsLeft = 0

    for (const byte of bytes) {
        buffer = (buffer << 8) | byte
        bitsLeft += 8

        while (bitsLeft >= 5) {
            bitsLeft -= 5
            const index = (buffer >> bitsLeft) & 0x1f
            result += CROCKFORD_ALPHABET[index]
        }
    }

    // Handle remaining bits
    if (bitsLeft > 0) {
        const index = (buffer << (5 - bitsLeft)) & 0x1f
        result += CROCKFORD_ALPHABET[index]
    }

    return result
}

// Calculate check digit (simple modulo)
function calculateCheckDigit(token: string): string {
    let sum = 0
    for (const char of token) {
        sum += CROCKFORD_ALPHABET.indexOf(char)
    }
    return CROCKFORD_ALPHABET[sum % 32]
}

// Normalize input (apply equivalences and uppercase)
export function normalizeToken(token: string): string {
    return token
        .toUpperCase()
        .replace(/[-\s]/g, '') // Remove dashes and spaces
        .split('')
        .map(char => EQUIVALENCES[char] || char)
        .join('')
}

// Validate check digit
export function validateCheckDigit(token: string): boolean {
    const normalized = normalizeToken(token)
    if (normalized.length !== 13) return false // 12 + 1 check digit

    const payload = normalized.slice(0, 12)
    const checkDigit = normalized.slice(12)

    return calculateCheckDigit(payload) === checkDigit
}

// Format token with dashes: ABCD-EFGH-IJKL-X
export function formatToken(token: string): string {
    const normalized = normalizeToken(token)
    if (normalized.length !== 13) return token

    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12)}`
}

// Generate intake token (128 bits = 16 bytes)
export function generateIntakeToken(): { token: string; formatted: string } {
    const bytes = getRandomBytes(16) // 128 bits per BLUEPRINT.md
    const payload = toCrockford(bytes).slice(0, 12) // Take first 12 chars
    const checkDigit = calculateCheckDigit(payload)
    const token = payload + checkDigit

    return {
        token,
        formatted: formatToken(token)
    }
}

// Generate share token (same format as intake token)
export function generateShareToken(): { token: string; formatted: string } {
    return generateIntakeToken()
}

// Generate ticket code (3-6 chars, non-sequential)
export function generateTicketCode(length: number = 5): string {
    // Exclude confusing characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = getRandomBytes(length)

    return Array.from(bytes)
        .map(byte => chars[byte % chars.length])
        .join('')
}

// Hash token for storage (SHA-256)
export async function hashToken(token: string): Promise<string> {
    const normalized = normalizeToken(token)
    const bytes = new TextEncoder().encode(normalized)
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    const hashArray = new Uint8Array(hashBuffer)

    // Convert to hex string
    return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}
