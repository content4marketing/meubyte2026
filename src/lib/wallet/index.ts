/**
 * MeuByte MVP - Local Wallet (IndexedDB)
 * Based on BLUEPRINT.md sections 10, 12
 * 
 * Local-first storage for subject's personal data
 * Uses IndexedDB via idb-keyval for simplicity
 */

import { get, set, del, keys, clear } from 'idb-keyval'
import { encryptWithPassphrase, decryptWithPassphrase } from '@/lib/crypto/pbkdf2'
import { generateId } from '@/lib/utils'

// Wallet data structure
export interface WalletData {
    full_name?: string
    cpf?: string
    birth_date?: string
    email?: string
    phone?: string
    address_line?: string
    city?: string
    state?: string
    postal_code?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    [key: string]: string | undefined // Allow custom fields
}

// Encrypted wallet for sync
export interface EncryptedWallet {
    ciphertext: string
    salt: string
    iv: string
    iterations: number
    version: number
    updatedAt: string
}

// Local wallet metadata
export interface WalletMeta {
    id: string
    createdAt: string
    updatedAt: string
    hasPassphrase: boolean
    syncEnabled: boolean
    lastSyncAt?: string
}

const WALLET_DATA_KEY = 'meubyte_wallet_data'
const WALLET_META_KEY = 'meubyte_wallet_meta'
const ANON_ID_KEY = 'meubyte_anon_id'

// Get or generate anonymous ID
export async function getAnonId(): Promise<string> {
    let anonId = await get<string>(ANON_ID_KEY)

    if (!anonId) {
        anonId = generateId()
        await set(ANON_ID_KEY, anonId)
    }

    return anonId
}

// Get wallet metadata
export async function getWalletMeta(): Promise<WalletMeta | null> {
    return await get<WalletMeta>(WALLET_META_KEY) || null
}

// Initialize wallet
export async function initWallet(): Promise<WalletMeta> {
    let meta = await getWalletMeta()

    if (!meta) {
        meta = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hasPassphrase: false,
            syncEnabled: false
        }
        await set(WALLET_META_KEY, meta)
        await set(WALLET_DATA_KEY, {})
    }

    return meta
}

// Get wallet data (local, unencrypted)
export async function getWalletData(): Promise<WalletData> {
    const data = await get<WalletData>(WALLET_DATA_KEY)
    return data || {}
}

// Save wallet data (local, unencrypted)
export async function saveWalletData(data: WalletData): Promise<void> {
    await set(WALLET_DATA_KEY, data)

    // Update metadata
    const meta = await getWalletMeta()
    if (meta) {
        meta.updatedAt = new Date().toISOString()
        await set(WALLET_META_KEY, meta)
    }
}

// Update specific field
export async function updateWalletField(field: string, value: string): Promise<void> {
    const data = await getWalletData()
    data[field] = value
    await saveWalletData(data)
}

// Delete specific field
export async function deleteWalletField(field: string): Promise<void> {
    const data = await getWalletData()
    delete data[field]
    await saveWalletData(data)
}

// Clear all wallet data
export async function clearWallet(): Promise<void> {
    await del(WALLET_DATA_KEY)
    await del(WALLET_META_KEY)
    // Keep anon_id for continuity
}

// Encrypt wallet for cloud sync
export async function encryptWallet(passphrase: string): Promise<EncryptedWallet> {
    const data = await getWalletData()
    const jsonData = JSON.stringify(data)

    const encrypted = await encryptWithPassphrase(jsonData, passphrase)

    // Update meta to indicate passphrase is set
    const meta = await getWalletMeta()
    if (meta) {
        meta.hasPassphrase = true
        meta.updatedAt = new Date().toISOString()
        await set(WALLET_META_KEY, meta)
    }

    return {
        ...encrypted,
        version: 1,
        updatedAt: new Date().toISOString()
    }
}

// Decrypt wallet from cloud sync
export async function decryptWallet(
    encrypted: EncryptedWallet,
    passphrase: string
): Promise<WalletData> {
    const jsonData = await decryptWithPassphrase(
        encrypted.ciphertext,
        encrypted.salt,
        encrypted.iv,
        passphrase,
        encrypted.iterations
    )

    return JSON.parse(jsonData)
}

// Import wallet from decrypted data
export async function importWallet(data: WalletData): Promise<void> {
    await saveWalletData(data)
}

// Export wallet for recovery kit (plain JSON)
export async function exportWalletForRecovery(): Promise<string> {
    const data = await getWalletData()
    const meta = await getWalletMeta()

    return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        walletId: meta?.id,
        data
    }, null, 2)
}

// Check if wallet has data
export async function hasWalletData(): Promise<boolean> {
    const data = await getWalletData()
    return Object.keys(data).length > 0
}

// Get list of filled fields
export async function getFilledFields(): Promise<string[]> {
    const data = await getWalletData()
    return Object.keys(data).filter(key => data[key] && data[key]!.trim() !== '')
}

// Pre-fill form from wallet
export async function prefillFromWallet(
    requiredFields: string[]
): Promise<Record<string, string>> {
    const data = await getWalletData()
    const result: Record<string, string> = {}

    for (const field of requiredFields) {
        if (data[field]) {
            result[field] = data[field]!
        }
    }

    return result
}
