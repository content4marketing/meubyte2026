/**
 * MeuByte - Supabase Admin Client
 * 
 * This is a workaround for bypassing TypeScript strict type checking
 * when the database types haven't been generated yet via `supabase gen types`.
 * 
 * In production, you should run:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.generated.ts
 * 
 * And then update the client.ts and server.ts to use the generated types.
 */

import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

// Create an untyped client for use during development
export function createUntypedClient(): SupabaseClient {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ) as SupabaseClient
}

// Typed helper that casts the result
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTable = any
