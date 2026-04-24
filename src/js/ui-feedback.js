export function showToast(root, message, variant = 'info') {
  const container = root ?? document.body;
  container.querySelector('.rally-toast')?.remove();

  const toast = document.createElement('div');
  toast.classList.add('rally-toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('data-variant', variant);
  toast.textContent = message;

  container.appendChild(toast);

  const hideTimer = globalThis.setTimeout?.(() => {
    toast.classList.add('leaving');
    const removeTimer = globalThis.setTimeout?.(() => toast.remove(), 180);
    removeTimer?.unref?.();
  }, 2600);
  hideTimer?.unref?.();

  return toast;
}
