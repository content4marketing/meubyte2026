/**
 * MeuByte MVP - PBKDF2 Key Derivation
 * Based on BLUEPRINT.md section 10
 * 
 * Used for encrypting the subject's local wallet with their passphrase
 * PBKDF2-HMAC-SHA-256 with 600,000 iterations
 */

// Convert string to Uint8Array
function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

// Convert Uint8Array to base64
function bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
}

// Convert base64 to Uint8Array
function base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

// Helper to get ArrayBuffer from Uint8Array (for TypeScript compatibility)
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
}

// Configuration per BLUEPRINT.md section 10
const PBKDF2_CONFIG = {
    iterations: 600_000, // Target for security, adjustable for mobile performance
    minIterations: 100_000, // Hardcoded minimum
    saltLength: 16, // 16-32 bytes per blueprint
    keyLength: 32 // 32 bytes for AES-256
}

// Generate random salt
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(PBKDF2_CONFIG.saltLength))
}

// Derive key from passphrase using PBKDF2
export async function deriveKey(
    passphrase: string,
    salt: Uint8Array,
    iterations: number = PBKDF2_CONFIG.iterations
): Promise<CryptoKey> {
    // Enforce minimum iterations
    const safeIterations = Math.max(iterations, PBKDF2_CONFIG.minIterations)

    // Import passphrase as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(stringToBytes(passphrase)),
        'PBKDF2',
        false,
        ['deriveKey']
    )

    // Derive AES-GCM key
    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: toArrayBuffer(salt),
            iterations: safeIterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    )
}

// Encrypt value with passphrase-derived key
export async function encryptWithPassphrase(
    plaintext: string,
    passphrase: string
): Promise<{
    ciphertext: string
    salt: string
    iv: string
    iterations: number
}> {
    const salt = generateSalt()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const iterations = PBKDF2_CONFIG.iterations

    const key = await deriveKey(passphrase, salt, iterations)

    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) as ArrayBuffer },
        key,
        toArrayBuffer(stringToBytes(plaintext))
    )

    return {
        ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        iterations
    }
}

// Decrypt value with passphrase-derived key
export async function decryptWithPassphrase(
    ciphertext: string,
    salt: string,
    iv: string,
    passphrase: string,
    iterations: number = PBKDF2_CONFIG.iterations
): Promise<string> {
    const saltBytes = base64ToBytes(salt)
    const ivBytes = base64ToBytes(iv)
    const ciphertextBytes = base64ToBytes(ciphertext)

    const key = await deriveKey(passphrase, saltBytes, iterations)

    const plaintextBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) as ArrayBuffer },
        key,
        toArrayBuffer(ciphertextBytes)
    )

    return new TextDecoder().decode(plaintextBuffer)
}

// Measure derivation time for performance tuning
export async function measureDerivationTime(
    passphrase: string,
    iterations: number = PBKDF2_CONFIG.iterations
): Promise<number> {
    const salt = generateSalt()
    const start = performance.now()
    await deriveKey(passphrase, salt, iterations)
    return performance.now() - start
}

// Find optimal iterations for target time (150-400ms per BLUEPRINT.md)
export async function findOptimalIterations(
    targetMs: number = 250
): Promise<number> {
    const testPassphrase = 'test-passphrase-for-calibration'

    // Start with minimum and binary search
    let low = PBKDF2_CONFIG.minIterations
    let high = PBKDF2_CONFIG.iterations * 2

    while (high - low > 10000) {
        const mid = Math.floor((low + high) / 2)
        const time = await measureDerivationTime(testPassphrase, mid)

        if (time < targetMs) {
            low = mid
        } else {
            high = mid
        }
    }

    return Math.max(low, PBKDF2_CONFIG.minIterations)
}
