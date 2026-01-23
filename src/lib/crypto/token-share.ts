/**
 * Token-derived key for short code sharing (ephemeral).
 * Derives AES-GCM key from a short token + slug salt.
 */

const TOKEN_ITERATIONS = 120_000

function encode(value: string): Uint8Array {
    return new TextEncoder().encode(value)
}

export async function deriveTokenKey(token: string, slug: string): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
        'raw',
        encode(token),
        'PBKDF2',
        false,
        ['deriveKey']
    )

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encode(`meubyte:share:v1:${slug}`),
            iterations: TOKEN_ITERATIONS,
            hash: 'SHA-256'
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}
