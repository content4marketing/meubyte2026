/**
 * MeuByte MVP - Wallet Cloud Sync
 * Synchronizes local IndexedDB wallet with Supabase 'subject_values'
 * Uses envelope encryption (client-side) with user's passphrase
 */

import { createClient } from '@/lib/supabase/client'
import { getWalletData, saveWalletData, WalletData } from './index'
import { encryptWithPassphrase, decryptWithPassphrase } from '@/lib/crypto/pbkdf2'

// Supabase client
const supabase = createClient()

/**
 * Get or create subject record for the authenticated user
 */
async function getSubjectId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Usuário não autenticado')
    }

    // Try to find existing subject
    const { data: subject } = await supabase
        .from('subjects')
        .select('id')
        .eq('user_id', user.id)
        .single()

    if (subject) {
        return subject.id
    }

    // Create new subject linked to user
    // Use anon_id from localStorage if available to link previous data?
    // For now, simpler approach: create new subject
    const { data: newSubject, error } = await supabase
        .from('subjects')
        .insert({
            user_id: user.id,
            email: user.email,
            anon_id: 'synced_' + user.id // Placeholder or proper anon_id
        })
        .select('id')
        .single()

    if (error || !newSubject) {
        throw new Error('Erro ao criar registro do titular')
    }

    return newSubject.id
}

/**
 * Sync local wallet to cloud (Push)
 * Encrypts all fields with passphrase and uploads to Supabase
 */
export async function syncWalletToCloud(passphrase: string): Promise<void> {
    if (!passphrase || passphrase.length < 8) {
        throw new Error('Senha inválida para sincronização')
    }

    const subjectId = await getSubjectId()
    const walletData = await getWalletData()
    const fields = Object.entries(walletData)

    if (fields.length === 0) return

    // Encrypt and prepare upserts
    const updates = await Promise.all(fields.map(async ([key, value]) => {
        if (!value) return null

        // Encrypt individual field
        const encrypted = await encryptWithPassphrase(value, passphrase)

        return {
            subject_id: subjectId,
            field_slug: key,
            value_encrypted: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
            updated_at: new Date().toISOString()
        }
    }))

    // Filter nulls
    const validUpdates = updates.filter(u => u !== null) as any[]

    if (validUpdates.length > 0) {
        const { error } = await supabase
            .from('subject_values')
            .upsert(validUpdates, { onConflict: 'subject_id,field_slug' })

        if (error) {
            console.error('Sync error:', error)
            throw new Error('Erro ao salvar dados na nuvem')
        }
    }
}

/**
 * Sync cloud wallet to local (Pull)
 * Downloads and decrypts all fields from Supabase
 */
export async function syncWalletFromCloud(passphrase: string): Promise<WalletData> {
    const subjectId = await getSubjectId()

    // Fetch all values
    const { data: values, error } = await supabase
        .from('subject_values')
        .select('*')
        .eq('subject_id', subjectId)

    if (error) {
        throw new Error('Erro ao buscar dados da nuvem')
    }

    if (!values || values.length === 0) {
        return {}
    }

    // Decrypt fields
    const decryptedData: WalletData = {}

    await Promise.all(values.map(async (record) => {
        try {
            const plaintext = await decryptWithPassphrase(
                record.value_encrypted,
                record.salt,
                record.iv,
                passphrase
            )
            decryptedData[record.field_slug] = plaintext
        } catch (err) {
            console.warn(`Failed to decrypt field ${record.field_slug}`)
        }
    }))

    // Merge with local data (cloud wins or local wins? For "Restoring", cloud wins)
    // Let's merge: if local has data, keep it? No, sync implies consistency.
    // Strategy: Merge, prefer cloud (since we just pulled)
    const currentLocal = await getWalletData()
    const merged = { ...currentLocal, ...decryptedData }

    await saveWalletData(merged)

    return merged
}

/**
 * Check if user has cloud data
 */
export async function hasCloudData(): Promise<boolean> {
    try {
        const subjectId = await getSubjectId()
        const { count } = await supabase
            .from('subject_values')
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', subjectId)

        return (count || 0) > 0
    } catch {
        return false
    }
}
