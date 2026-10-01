import { useSyncExternalStore } from "react";
import { toast } from "sonner";

// Deletes are delayed so they can be undone: the item is hidden at once and
// only removed from the database when the toast closes without "Undo".
// Closing the tab within that window keeps the item.

const UNDO_MS = 5000;
const hidden = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> = new Set();

function emit() {
  snapshot = new Set(hidden);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const emptySet: ReadonlySet<string> = new Set();

// IDs that are waiting to be deleted; lists should leave these out
export function useHiddenIds() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => emptySet,
  );
}

export function deleteWithUndo({
  id,
  message,
  run,
  onDeleted,
}: {
  id: string;
  message: string;
  run: () => PromiseLike<{ error: { message: string } | null }>;
  onDeleted: () => unknown;
}) {
  let settled = false;
  hidden.add(id);
  emit();

  const commit = async () => {
    if (settled) return;
    settled = true;
    const { error } = await run();
    if (error) toast.error(`Couldn't delete: ${error.message}`);
    // Keep it hidden until the refreshed list arrives, so it doesn't flash back
    await onDeleted();
    hidden.delete(id);
    emit();
  };

  toast(message, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        if (settled) return;
        settled = true;
        hidden.delete(id);
        emit();
      },
    },
    onAutoClose: commit,
    onDismiss: commit,
  });
}
