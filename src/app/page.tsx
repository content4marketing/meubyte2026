'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  ArrowUpRight,
  Building2,
  Menu,
  QrCode,
  Search,
  Shield,
  Wallet,
} from 'lucide-react'

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => {
  detect: (image: ImageBitmap) => Promise<Array<{ rawValue?: string }>>
}

export default function HomePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDetailsElement>(null)

  const [entry, setEntry] = useState('')
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setScanStatus(null)

    const value = entry.trim()
    if (!value) return

    if (/^https?:\/\//i.test(value)) {
      window.location.href = value
      return
    }

    router.push(`/link/${encodeURIComponent(value)}`)
  }

  const triggerQr = () => {
    menuRef.current?.removeAttribute('open')
    setScanStatus(null)
    fileInputRef.current?.click()
  }

  const handleQrFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setScanning(true)
    setScanStatus('Lendo QR Code...')

    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
        .BarcodeDetector

      if (!Detector || !('createImageBitmap' in window)) {
        setScanStatus('Leitura de QR indisponível neste navegador.')
        return
      }

      const bitmap = await createImageBitmap(file)
      const detector = new Detector({ formats: ['qr_code'] })
      const codes = await detector.detect(bitmap)
      const value = codes[0]?.rawValue

      if (!value) {
        setScanStatus('Não encontramos um QR válido. Tente novamente.')
        return
      }

      window.location.href = value
    } catch (error) {
      console.error('QR scan error:', error)
      setScanStatus('Falha ao ler o QR. Tente outra foto.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]"
      style={{
        ['--bg' as string]: '#f7f3ed',
        ['--ink' as string]: '#0f172a',
        ['--muted' as string]: '#667085',
        ['--accent' as string]: '#0f766e',
        ['--accent-2' as string]: '#f97316',
        ['--field' as string]: '#ffffff',
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(15,118,110,0.2),transparent_55%),radial-gradient(circle_at_85%_12%,rgba(249,115,22,0.16),transparent_50%),linear-gradient(180deg,#fdfaf5,#edf4f3)]" />
        <div className="absolute -top-32 right-[-10%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(15,118,110,0.35),transparent_65%)] blur-2xl motion-safe:animate-[float_12s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-22%] left-[-12%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(14,116,144,0.28),transparent_65%)] blur-2xl motion-safe:animate-[float_16s_ease-in-out_infinite]" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 pt-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-black/10 shadow-sm">
              <Shield className="h-5 w-5 text-[var(--accent)]" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-[var(--font-display)] uppercase tracking-[0.18em] text-[var(--ink)]">
                MeuByte
              </span>
              <span className="text-[11px] text-[var(--muted)]">privacidade efêmera</span>
            </span>
          </Link>

          <details ref={menuRef} className="group relative">
            <summary className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ink)] shadow-sm backdrop-blur transition hover:bg-white">
              <Menu className="h-4 w-4" />
              Menu
            </summary>
            <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-black/10 bg-white/90 p-2 shadow-xl backdrop-blur transition duration-200 group-open:animate-[fade-up_0.25s_ease-out]">
              <Link
                href="/subject/wallet"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-black/5"
              >
                <Wallet className="h-4 w-4 text-[var(--accent)]" />
                Carteira
              </Link>
              <button
                type="button"
                onClick={triggerQr}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-black/5"
              >
                <QrCode className="h-4 w-4 text-[var(--accent-2)]" />
                Ler QR Code
              </button>
              <Link
                href="/login"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-black/5"
              >
                <Building2 className="h-4 w-4 text-[var(--ink)]" />
                Estabelecimento
              </Link>
            </div>
          </details>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl text-center motion-safe:animate-[fade-up_0.6s_ease-out]">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">
              Compartilhe só o essencial
            </p>
            <p className="mt-4 text-sm text-[var(--muted)]">
              Cole o link do estabelecimento ou digite o slug para abrir a sessão.
            </p>

            <form onSubmit={handleSubmit} className="mt-10">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  value={entry}
                  onChange={(event) => setEntry(event.target.value)}
                  placeholder="Ex: clinica-mar"
                  className="w-full rounded-full border border-black/10 bg-white/80 px-11 py-4 text-sm text-[var(--ink)] shadow-[0_20px_45px_rgba(15,23,42,0.08)] outline-none ring-0 backdrop-blur transition focus:border-[var(--accent)] focus:shadow-[0_25px_60px_rgba(15,118,110,0.18)]"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm transition hover:brightness-110"
                >
                  Abrir
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-col items-center gap-2 text-xs text-[var(--muted)]">
              <span>Prefira o QR Code para abrir direto.</span>
              <button
                type="button"
                onClick={triggerQr}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink)] shadow-sm transition hover:bg-white"
              >
                <QrCode className="h-3.5 w-3.5" />
                {scanning ? 'Lendo QR...' : 'Ler QR agora'}
              </button>
            </div>

            {scanStatus && (
              <p className="mt-3 text-xs text-[var(--muted)]" role="status" aria-live="polite">
                {scanStatus}
              </p>
            )}
          </div>
        </main>

        <footer className="px-6 pb-6">
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <Shield className="h-4 w-4 text-[var(--accent)]" />
            <span className="font-medium">MeuByte</span>
          </div>
        </footer>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleQrFile}
        className="hidden"
      />
    </div>
  )
}
