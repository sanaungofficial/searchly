const ROOT_ID = "kimchi-extension-root";

export function ensureFloatingButton(onSave: () => void): void {
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement("div");
  root.id = ROOT_ID;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "kimchi-save-btn";
  button.textContent = "Save to Kimchi";
  button.title = "Save this job to your Kimchi pipeline";
  button.addEventListener("click", onSave);

  root.appendChild(button);
  document.documentElement.appendChild(root);
}

export function setButtonState(state: "idle" | "loading" | "success" | "error"): void {
  const button = document.querySelector<HTMLButtonElement>(`.kimchi-save-btn`);
  if (!button) return;

  button.disabled = state === "loading";
  button.dataset.state = state;

  switch (state) {
    case "idle":
      button.textContent = "Save to Kimchi";
      break;
    case "loading":
      button.textContent = "Saving…";
      break;
    case "success":
      button.textContent = "Saved ✓";
      break;
    case "error":
      button.textContent = "Retry save";
      break;
  }
}

export function showToast(message: string, kind: "success" | "error" = "success"): void {
  const existing = document.querySelector(".kimchi-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.className = `kimchi-toast kimchi-toast--${kind}`;
  toast.textContent = message;
  document.documentElement.appendChild(toast);

  window.setTimeout(() => toast.remove(), 4000);
}
