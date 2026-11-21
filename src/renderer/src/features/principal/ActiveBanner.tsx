import type { Account } from '../../../../preload/index.ts'

export function ActiveBanner({ active }: { active: Account | undefined }) {
  return (
    <div class="active-banner">
      <small>Sesión activa en el sistema</small>
      <div class="active-banner-main">
        <div class="active-user-wrap">
          <span class="pulse-dot" />
          <span>{active?.username ?? 'Sin cuenta activa'}</span>
        </div>
        {active && (
          <span class="custom-label-pill">
            <svg width="11" height="11">
              <use href="#icon-tag" />
            </svg>
            {active.label}
          </span>
        )}
      </div>
    </div>
  )
}
