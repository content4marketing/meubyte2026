/**
 * MeuByte MVP - Envelope Encryption
 * Based on BLUEPRINT.md section 11
 * 
 * Uses AES-256-GCM for data encryption with per-session data keys
 * Data keys are encrypted with a master key (stored in env)
 */

// Convert string to Uint8Array
function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str)
}

// Convert Uint8Array to string
function bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes)
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

// Generate a random data key (32 bytes for AES-256)
export async function generateDataKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable - needed to wrap the key
        ['encrypt', 'decrypt']
    )
}

// Export data key to raw bytes
export async function exportDataKey(key: CryptoKey): Promise<Uint8Array> {
    const exported = await crypto.subtle.exportKey('raw', key)
    return new Uint8Array(exported)
}

// Import data key from raw bytes
export async function importDataKey(keyBytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(keyBytes),
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    )
}

// Generate random IV (12 bytes recommended for AES-GCM)
export function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12))
}

// Encrypt data with AES-GCM
export async function encryptValue(
    plaintext: string,
    key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
    const iv = generateIV()
    const plaintextBytes = stringToBytes(plaintext)

    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) as ArrayBuffer },
        key,
        toArrayBuffer(plaintextBytes)
    )

    return {
        ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
        iv: bytesToBase64(iv)
    }
}

// Decrypt data with AES-GCM
export async function decryptValue(
    ciphertext: string,
    iv: string,
    key: CryptoKey
): Promise<string> {
    const ciphertextBytes = base64ToBytes(ciphertext)
    const ivBytes = base64ToBytes(iv)

    const plaintextBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) as ArrayBuffer },
        key,
        toArrayBuffer(ciphertextBytes)
    )

    return bytesToString(new Uint8Array(plaintextBuffer))
}

// Import master key from base64 (for Edge Functions)
export async function importMasterKey(masterKeyBase64: string): Promise<CryptoKey> {
    const keyBytes = base64ToBytes(masterKeyBase64)
    return await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(keyBytes),
        { name: 'AES-GCM', length: 256 },
        false, // not extractable
        ['wrapKey', 'unwrapKey']
    )
}

// Wrap (encrypt) data key with master key
export async function wrapDataKey(
    dataKey: CryptoKey,
    masterKey: CryptoKey
): Promise<{ wrappedKey: string; iv: string }> {
    const iv = generateIV()

    const wrappedBuffer = await crypto.subtle.wrapKey(
        'raw',
        dataKey,
        masterKey,
        { name: 'AES-GCM', iv: toArrayBuffer(iv) as ArrayBuffer }
    )

    return {
        wrappedKey: bytesToBase64(new Uint8Array(wrappedBuffer)),
        iv: bytesToBase64(iv)
    }
}

// Unwrap (decrypt) data key with master key
export async function unwrapDataKey(
    wrappedKey: string,
    iv: string,
    masterKey: CryptoKey
): Promise<CryptoKey> {
    const wrappedBytes = base64ToBytes(wrappedKey)
    const ivBytes = base64ToBytes(iv)

    return await crypto.subtle.unwrapKey(
        'raw',
        toArrayBuffer(wrappedBytes),
        masterKey,
        { name: 'AES-GCM', iv: toArrayBuffer(ivBytes) as ArrayBuffer },
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    )
}

// Envelope encryption result
export interface EncryptedEnvelope {
    ciphertext: string
    iv: string
    keyWrapped: string
    keyIv: string
    kmsVersion: number
    cryptoVersion: number
}

// Full envelope encryption (for session payload)
export async function encryptEnvelope(
    plaintext: string,
    masterKeyBase64: string,
    kmsVersion: number = 1
): Promise<EncryptedEnvelope> {
    // Generate session-specific data key
    const dataKey = await generateDataKey()

    // Encrypt the value with data key
    const { ciphertext, iv } = await encryptValue(plaintext, dataKey)

    // Import master key and wrap data key
    const masterKey = await importMasterKey(masterKeyBase64)
    const { wrappedKey, iv: keyIv } = await wrapDataKey(dataKey, masterKey)

    return {
        ciphertext,
        iv,
        keyWrapped: wrappedKey,
        keyIv,
        kmsVersion,
        cryptoVersion: 1 // Current crypto version
    }
}

// Full envelope decryption
export async function decryptEnvelope(
    envelope: EncryptedEnvelope,
    masterKeyBase64: string
): Promise<string> {
    // Import master key
    const masterKey = await importMasterKey(masterKeyBase64)

    // Unwrap data key
    const dataKey = await unwrapDataKey(envelope.keyWrapped, envelope.keyIv, masterKey)

    // Decrypt value
    return await decryptValue(envelope.ciphertext, envelope.iv, dataKey)
}
