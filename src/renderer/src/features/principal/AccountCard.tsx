import type { Account } from '../../../../preload/index.ts'

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
  selected,
  onSelect,
  onManageFolders,
}: {
  account: Account
  selected: boolean
  onSelect: (id: string) => void
  onManageFolders: (id: string) => void
}) {
  const providerIcon = account.provider === 'github' ? '#icon-github' : '#icon-gitlab'
  const providerName = account.provider === 'github' ? 'GitHub' : 'GitLab'
  const iconStyle = account.provider === 'gitlab' ? { color: '#fc6d26' } : undefined

  return (
    <div class={`account-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(account.id)}>
      <div class="account-left">
        <span class={`radio-dot ${selected ? 'checked' : ''}`} aria-hidden="true" />
        <div class="avatar" style={{ backgroundColor: avatarColor(account.label) }}>
          {initials(account.label)}
        </div>
        <div class="account-info">
          <h4 title={account.username}>{account.label}</h4>
          <div class="account-meta">
            <svg width="11" height="11" style={iconStyle}>
              <use href={providerIcon} />
            </svg>
            <span>{providerName}</span>
          </div>
        </div>
      </div>
      <div class="account-actions">
        {selected && <span class="status-badge">En uso</span>}
        <button
          class="icon-action-btn"
          title="Carpetas de esta cuenta"
          onClick={(e) => {
            e.stopPropagation()
            onManageFolders(account.id)
          }}
        >
          <svg width="13" height="13">
            <use href="#icon-pin" />
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
