/**
 * Zero-Knowledge Sharing Utilities
 * 
 * Implements client-side encryption where the key is never sent to the server.
 * The key is passed via URL fragment (hash) which is not sent in HTTP requests.
 * 
 * Flow:
 * 1. Generate random AES-GCM key (client-side)
 * 2. Encrypt data with key
 * 3. Upload encrypted blob to server (publicly accessible by ID)
 * 4. Share link: https://app.com/view/<ID>#<KEY>
 * 5. Recipient downloads blob by ID
 * 6. Recipient decrypts with KEY from URL hash
 */

// Generate a random 256-bit key for AES-GCM
export async function generateShareKey(): Promise<CryptoKey> {
    return window.crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    )
}

// Export key to base64url string for URL usage
export async function exportKeyToString(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('raw', key)
    return arrayBufferToBase64Url(exported)
}

// Import key from base64url string
export async function importKeyFromString(keyStr: string): Promise<CryptoKey> {
    const keyBuffer = base64UrlToArrayBuffer(keyStr)
    return window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    )
}

// Encrypt data (JSON object) -> { iv, ciphertext }
export async function encryptShareData(data: any, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
    const encoded = new TextEncoder().encode(JSON.stringify(data))
    const iv = window.crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM

    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encoded
    )

    return {
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(encrypted)
    }
}

// Decrypt data -> JSON object
export async function decryptShareData(
    encryptedData: { iv: string; ciphertext: string },
    key: CryptoKey
): Promise<any> {
    const iv = base64ToArrayBuffer(encryptedData.iv)
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext)

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        ciphertext
    )

    const decoded = new TextDecoder().decode(decrypted)
    return JSON.parse(decoded)
}

// Utils
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64)
    const len = binary_string.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i)
    }
    return bytes.buffer
}

// Base64Url (URL safe)
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    return arrayBufferToBase64(buffer)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    // Add padding if needed
    const pad = base64.length % 4
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64

    return base64ToArrayBuffer(padded)
}
