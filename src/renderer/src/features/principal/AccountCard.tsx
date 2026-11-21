import type { Account } from '../../../../preload/index.ts'

export function AccountCard({
  account,
  selected,
  onSelect,
}: {
  account: Account
  selected: boolean
  onSelect: (id: string) => void
}) {
  const providerIcon = account.provider === 'github' ? '#icon-github' : '#icon-gitlab'
  const iconStyle = !selected && account.provider === 'gitlab' ? { color: '#fc6d26' } : undefined

  return (
    <div class={`account-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(account.id)}>
      <div class="account-left">
        <div class="avatar">
          <svg width="17" height="17" style={iconStyle}>
            <use href={providerIcon} />
          </svg>
        </div>
        <div class="account-info">
          <div class="account-top">
            <h4>{account.username}</h4>
          </div>
          <div class="account-meta">
            <span class="tag-custom">
              <svg width="10" height="10">
                <use href="#icon-tag" />
              </svg>
              {account.label}
            </span>
            <button
              class="icon-action-btn"
              title="Editar etiqueta (próximamente)"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="12" height="12">
                <use href="#icon-edit" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="account-actions">
        <span class="status-badge">{selected ? 'Activa' : 'Usar'}</span>
        <button
          class="icon-action-btn delete"
          title="Desvincular cuenta (próximamente)"
          disabled
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="13" height="13">
            <use href="#icon-trash" />
          </svg>
        </button>
      </div>
    </div>
  )
}
