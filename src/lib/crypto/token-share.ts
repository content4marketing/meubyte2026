/**
 * Token-derived key for short code sharing (ephemeral).
 * Derives AES-GCM key from a short token + slug salt.
 */

const TOKEN_ITERATIONS = 120_000

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}

function encode(value: string): ArrayBuffer {
    return toArrayBuffer(new TextEncoder().encode(value))
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
