import { useState } from 'preact/hooks'
import type { Account } from '../../../../preload/index.ts'
import { renameAccount, showToast } from './store.ts'

// Paleta fija para el avatar de iniciales — determinística por cuenta
// (misma cuenta, mismo color, sin tener que guardar nada nuevo).
const AVATAR_COLORS = ['#0070f3', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2']

function avatarColor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string
}

function initials(label: string): string {
  const words = label
    .trim()
    .split(/[\s-_]+/)
    .filter(Boolean)
  const first = words.at(0) ?? ''
  const second = words.at(1) ?? ''
  if (!first) return '?'
  return second
    ? (first.charAt(0) + second.charAt(0)).toUpperCase()
    : first.slice(0, 2).toUpperCase()
}

export function AccountCard({
  account,
  onManageFolders,
}: {
  account: Account
  onManageFolders: (id: string) => void
}) {
  const providerIcon = account.provider === 'github' ? '#icon-github' : '#icon-gitlab'
  const providerName = account.provider === 'github' ? 'GitHub' : 'GitLab'
  const iconStyle = account.provider === 'gitlab' ? { color: '#fc6d26' } : undefined

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(account.label)
  const [saving, setSaving] = useState(false)

  function startEditing(e: Event): void {
    e.stopPropagation()
    setDraft(account.label)
    setEditing(true)
  }

  async function commit(): Promise<void> {
    const next = draft.trim()
    if (!next || next === account.label) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await renameAccount(account.id, next)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo renombrar la cuenta.')
      setDraft(account.label)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  return (
    <div class="account-card" onClick={() => onManageFolders(account.id)}>
      <div class="account-left">
        <div class="avatar" style={{ backgroundColor: avatarColor(account.label) }}>
          {initials(account.label)}
        </div>
        <div class="account-info">
          {editing ? (
            <input
              class="account-label-input"
              value={draft}
              disabled={saving}
              onClick={(e) => e.stopPropagation()}
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commit()
                else if (e.key === 'Escape') setEditing(false)
              }}
              ref={(el) => {
                el?.focus()
                el?.select()
              }}
            />
          ) : (
            <h4 title={account.username}>{account.label}</h4>
          )}
          <div class="account-meta">
            <svg width="11" height="11" style={iconStyle}>
              <use href={providerIcon} />
            </svg>
            <span>{providerName}</span>
          </div>
        </div>
      </div>
      <div class="account-actions">
        <button
          class="icon-action-btn"
          title="Renombrar cuenta"
          onClick={startEditing}
        >
          <svg width="13" height="13">
            <use href="#icon-edit" />
          </svg>
        </button>
        <button
          class="icon-action-btn delete"
          title="Desvincular cuenta (próximamente)"
          disabled
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="13" height="13">
            <use href="#icon-x" />
          </svg>
        </button>
      </div>
    </div>
  )
}
