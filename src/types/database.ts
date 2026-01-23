// Database types for MeuByte MVP
// Based on BLUEPRINT.md sections 13-14

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

// Enums
export type OrgMemberRole = 'admin' | 'attendant'
export type SessionStatus = 'draft' | 'queued' | 'in_service' | 'ended' | 'expired'
export type FieldType = 'text' | 'email' | 'phone' | 'date' | 'cpf' | 'address' | 'select' | 'textarea'
export type DsrType = 'access' | 'correction' | 'deletion' | 'portability'
export type DsrStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'

// Organizations
export interface Org {
    id: string
    name: string
    slug: string
    created_at: string
    updated_at: string
}

export interface OrgUnit {
    id: string
    org_id: string
    name: string
    address?: string
    created_at: string
}

export interface OrgMember {
    id: string
    org_id: string
    user_id: string
    role: OrgMemberRole
    name: string
    email: string
    created_at: string
}

// Fields Catalog
export interface BaseField {
    id: string
    slug: string
    label: string
    type: FieldType
    is_sensitive: boolean
    mask_pattern?: string
    validation_regex?: string
    created_at: string
}

export interface OrgField {
    id: string
    org_id: string
    slug: string
    label: string
    type: FieldType
    is_sensitive: boolean
    options?: string[] // For select type
    created_at: string
}

// Templates
export interface Template {
    id: string
    org_id: string
    unit_id?: string
    name: string
    code_short: string // e.g., "01", "02"
    description?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface TemplateField {
    id: string
    template_id: string
    base_field_id?: string
    org_field_id?: string
    is_required: boolean
    display_order: number
    purpose?: string // Why this field is collected
}

// Subjects (Data holders)
export interface Subject {
    id: string
    user_id?: string // Optional - for logged in subjects
    anon_id: string
    email?: string
    created_at: string
}

export interface SubjectValue {
    id: string
    subject_id: string
    field_slug: string
    value_encrypted: string // Encrypted with subject's passphrase
    updated_at: string
}

export interface SubjectIdentity {
    id: string
    subject_id: string
    anon_id: string
    device_fingerprint?: string
    linked_at: string
}

// Intake and Sessions
export interface Intake {
    id: string
    org_id: string
    unit_id: string
    token_hash: string // Hashed token (Crockford Base32)
    expires_at: string
    created_by: string
    created_at: string
}

export interface IntakeTemplate {
    id: string
    intake_id: string
    template_id: string
}

export interface Session {
    id: string
    intake_id?: string
    org_id: string
    unit_id: string
    template_id: string
    subject_id?: string
    subject_anon_id?: string
    ticket_code: string // 3-6 chars, non-sequential
    status: SessionStatus
    claimed_by?: string // org_member_id
    claimed_at?: string
    payload_key_encrypted: string // Data key encrypted with master key
    payload_key_kms_version: number
    payload_crypto_version: number
    extended_count: number
    expires_at: string
    ended_at?: string
    created_at: string
}

export interface ShareToken {
    id: string
    session_id: string
    token_hash: string
    expires_at: string
    created_at: string
    used_at?: string
    used_by_name?: string // For public access - establishment name
}

// Payload (encrypted values)
export interface SessionPayloadField {
    id: string
    session_id: string
    template_field_id: string
    field_slug: string
    value_ciphertext: string // Encrypted with session's data key
    created_at: string
}

// Audit
export interface AccessLog {
    id: string
    session_id: string
    field_slug: string
    action: 'reveal' | 'extend' | 'end' | 'view_overview'
    actor_type: 'member' | 'public'
    actor_id?: string // org_member_id for logged users
    actor_name?: string // For public access
    ip_address?: string
    user_agent?: string
    created_at: string
}

export interface SessionEvent {
    id: string
    session_id: string
    event_type: string
    metadata?: Json
    created_at: string
}

// DSR (Data Subject Requests)
export interface DsrRequest {
    id: string
    subject_id: string
    org_id: string
    type: DsrType
    status: DsrStatus
    description?: string
    created_at: string
    updated_at: string
}

export interface DsrMessage {
    id: string
    dsr_request_id: string
    sender_type: 'subject' | 'org'
    sender_id: string
    message: string
    created_at: string
}

// Rate Limits
export interface RateLimit {
    id: string
    key: string // e.g., "ip:1.2.3.4" or "device:xyz" or "token:abc"
    context: 'token_invalid' | 'reveal'
    count: number
    window_start: string
    blocked_until?: string
}

// Supabase Database Schema
export interface Database {
    public: {
        Tables: {
            orgs: {
                Row: Org
                Insert: Omit<Org, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Org, 'id'>>
            }
            org_units: {
                Row: OrgUnit
                Insert: Omit<OrgUnit, 'id' | 'created_at'>
                Update: Partial<Omit<OrgUnit, 'id'>>
            }
            org_members: {
                Row: OrgMember
                Insert: Omit<OrgMember, 'id' | 'created_at'>
                Update: Partial<Omit<OrgMember, 'id'>>
            }
            base_fields: {
                Row: BaseField
                Insert: Omit<BaseField, 'id' | 'created_at'>
                Update: Partial<Omit<BaseField, 'id'>>
            }
            org_fields: {
                Row: OrgField
                Insert: Omit<OrgField, 'id' | 'created_at'>
                Update: Partial<Omit<OrgField, 'id'>>
            }
            templates: {
                Row: Template
                Insert: Omit<Template, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Template, 'id'>>
            }
            template_fields: {
                Row: TemplateField
                Insert: Omit<TemplateField, 'id'>
                Update: Partial<Omit<TemplateField, 'id'>>
            }
            subjects: {
                Row: Subject
                Insert: Omit<Subject, 'id' | 'created_at'>
                Update: Partial<Omit<Subject, 'id'>>
            }
            subject_values: {
                Row: SubjectValue
                Insert: Omit<SubjectValue, 'id' | 'updated_at'>
                Update: Partial<Omit<SubjectValue, 'id'>>
            }
            subject_identities: {
                Row: SubjectIdentity
                Insert: Omit<SubjectIdentity, 'id' | 'linked_at'>
                Update: Partial<Omit<SubjectIdentity, 'id'>>
            }
            intakes: {
                Row: Intake
                Insert: Omit<Intake, 'id' | 'created_at'>
                Update: Partial<Omit<Intake, 'id'>>
            }
            intake_templates: {
                Row: IntakeTemplate
                Insert: Omit<IntakeTemplate, 'id'>
                Update: Partial<Omit<IntakeTemplate, 'id'>>
            }
            sessions: {
                Row: Session
                Insert: Omit<Session, 'id' | 'created_at'>
                Update: Partial<Omit<Session, 'id'>>
            }
            share_tokens: {
                Row: ShareToken
                Insert: Omit<ShareToken, 'id' | 'created_at'>
                Update: Partial<Omit<ShareToken, 'id'>>
            }
            session_payload_fields: {
                Row: SessionPayloadField
                Insert: Omit<SessionPayloadField, 'id' | 'created_at'>
                Update: Partial<Omit<SessionPayloadField, 'id'>>
            }
            access_logs: {
                Row: AccessLog
                Insert: Omit<AccessLog, 'id' | 'created_at'>
                Update: never // Append-only
            }
            session_events: {
                Row: SessionEvent
                Insert: Omit<SessionEvent, 'id' | 'created_at'>
                Update: never // Append-only
            }
            dsr_requests: {
                Row: DsrRequest
                Insert: Omit<DsrRequest, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<DsrRequest, 'id'>>
            }
            dsr_messages: {
                Row: DsrMessage
                Insert: Omit<DsrMessage, 'id' | 'created_at'>
                Update: never // Append-only
            }
            rate_limits: {
                Row: RateLimit
                Insert: Omit<RateLimit, 'id'>
                Update: Partial<Omit<RateLimit, 'id'>>
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            org_member_role: OrgMemberRole
            session_status: SessionStatus
            field_type: FieldType
            dsr_type: DsrType
            dsr_status: DsrStatus
        }
    }
}
