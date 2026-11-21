export function StatusToast({ message }: { message: string }) {
  return (
    <div class="toast-feedback">
      <div class="toast-box">
        <svg width="14" height="14">
          <use href="#icon-check" />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  )
}
