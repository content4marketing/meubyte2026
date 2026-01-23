/**
 * MeuByte MVP - Wallet Backup Export/Import
 * Encrypted backup file for offline recovery
 * 
 * Uses PBKDF2-HMAC-SHA-256 (600k iterations) + AES-256-GCM
 * Compatible with iOS Safari and all modern browsers
 */

import { getWalletData, getWalletMeta, saveWalletData, initWallet, WalletData, WalletMeta } from './index'
import { encryptWithPassphrase, decryptWithPassphrase } from '@/lib/crypto/pbkdf2'

// Backup file format version
const BACKUP_VERSION = 1

// Backup file structure
export interface WalletBackupFile {
    version: number
    kdf: {
        name: 'PBKDF2'
        hash: 'SHA-256'
        iterations: number
        salt_b64: string
    }
    cipher: {
        name: 'AES-GCM'
        iv_b64: string
        ciphertext_b64: string
    }
    created_at: string
    wallet_id?: string
}

// Validation result
export interface BackupValidation {
    valid: boolean
    error?: string
    version?: number
    createdAt?: string
}

/**
 * Export wallet as encrypted backup file
 * Downloads a JSON file with encrypted wallet data
 */
export async function exportBackup(passphrase: string): Promise<Blob> {
    if (!passphrase || passphrase.length < 8) {
        throw new Error('A senha deve ter pelo menos 8 caracteres')
    }

    // Get wallet data
    const walletData = await getWalletData()
    const walletMeta = await getWalletMeta()

    if (!walletData || Object.keys(walletData).length === 0) {
        throw new Error('Carteira vazia - nada para exportar')
    }

    // Serialize wallet data
    const payload = JSON.stringify({
        data: walletData,
        meta: {
            id: walletMeta?.id,
            createdAt: walletMeta?.createdAt
        }
    })

    // Encrypt with passphrase
    const encrypted = await encryptWithPassphrase(payload, passphrase)

    // Build backup file
    const backupFile: WalletBackupFile = {
        version: BACKUP_VERSION,
        kdf: {
            name: 'PBKDF2',
            hash: 'SHA-256',
            iterations: encrypted.iterations,
            salt_b64: encrypted.salt
        },
        cipher: {
            name: 'AES-GCM',
            iv_b64: encrypted.iv,
            ciphertext_b64: encrypted.ciphertext
        },
        created_at: new Date().toISOString(),
        wallet_id: walletMeta?.id
    }

    // Create JSON blob
    const json = JSON.stringify(backupFile, null, 2)
    return new Blob([json], { type: 'application/json' })
}

/**
 * Generate backup filename with date
 */
export function getBackupFilename(): string {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    return `wallet-backup-${dateStr}.json`
}

/**
 * Download backup file
 * Triggers browser download without File System Access API (iOS compatible)
 */
export function downloadBackup(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Validate backup file structure
 */
export function validateBackupFile(content: string): BackupValidation {
    try {
        const parsed = JSON.parse(content)

        // Check version
        if (!parsed.version || typeof parsed.version !== 'number') {
            return { valid: false, error: 'Versão do backup não encontrada' }
        }

        if (parsed.version > BACKUP_VERSION) {
            return { valid: false, error: `Versão ${parsed.version} não suportada. Atualize o aplicativo.` }
        }

        // Check KDF params
        if (!parsed.kdf || !parsed.kdf.name || !parsed.kdf.iterations || !parsed.kdf.salt_b64) {
            return { valid: false, error: 'Parâmetros de derivação inválidos' }
        }

        // Check cipher params
        if (!parsed.cipher || !parsed.cipher.iv_b64 || !parsed.cipher.ciphertext_b64) {
            return { valid: false, error: 'Dados cifrados inválidos' }
        }

        return {
            valid: true,
            version: parsed.version,
            createdAt: parsed.created_at
        }
    } catch {
        return { valid: false, error: 'Arquivo não é um JSON válido' }
    }
}

/**
 * Parse backup file content
 */
export function parseBackupFile(content: string): WalletBackupFile {
    return JSON.parse(content)
}

/**
 * Import wallet from encrypted backup
 * Returns the decrypted data for preview before final import
 */
export async function decryptBackup(
    backup: WalletBackupFile,
    passphrase: string
): Promise<{ data: WalletData; meta?: { id?: string; createdAt?: string } }> {
    try {
        const decrypted = await decryptWithPassphrase(
            backup.cipher.ciphertext_b64,
            backup.kdf.salt_b64,
            backup.cipher.iv_b64,
            passphrase,
            backup.kdf.iterations
        )

        const payload = JSON.parse(decrypted)
        return payload
    } catch (error) {
        // Check if it's a decryption error (wrong passphrase)
        if (error instanceof DOMException && error.name === 'OperationError') {
            throw new Error('Senha incorreta. Verifique e tente novamente.')
        }
        throw new Error('Erro ao decifrar backup. Arquivo pode estar corrompido.')
    }
}

/**
 * Restore wallet from decrypted backup data
 * Replaces current wallet data
 */
export async function restoreFromBackup(data: WalletData): Promise<void> {
    // Ensure wallet is initialized
    await initWallet()

    // Save imported data
    await saveWalletData(data)
}

/**
 * Read file as text (promise-based)
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
        reader.readAsText(file)
    })
}
