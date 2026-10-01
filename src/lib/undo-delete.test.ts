import { beforeEach, describe, expect, it, vi } from "vitest";

type ToastOptions = {
  action: { onClick: () => void };
  onAutoClose: () => Promise<void>;
  onDismiss: () => Promise<void>;
};
const toastCalls: ToastOptions[] = [];
vi.mock("sonner", () => ({
  toast: Object.assign((_msg: string, opts: ToastOptions) => toastCalls.push(opts), {
    error: vi.fn(),
  }),
}));

const { deleteWithUndo } = await import("./undo-delete");

function start() {
  const run = vi.fn(async () => ({ error: null }));
  const onDeleted = vi.fn();
  deleteWithUndo({ id: crypto.randomUUID(), message: "deleted", run, onDeleted });
  return { run, onDeleted, toast: toastCalls.at(-1)! };
}

describe("deleteWithUndo", () => {
  beforeEach(() => {
    toastCalls.length = 0;
  });

  it("deletes when the toast closes on its own", async () => {
    const { run, onDeleted, toast } = start();
    expect(run).not.toHaveBeenCalled();
    await toast.onAutoClose();
    expect(run).toHaveBeenCalledOnce();
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("does not delete after Undo, even if the toast later closes", async () => {
    const { run, toast } = start();
    toast.action.onClick();
    await toast.onAutoClose();
    await toast.onDismiss();
    expect(run).not.toHaveBeenCalled();
  });

  it("deletes only once when the toast both dismisses and auto-closes", async () => {
    const { run, toast } = start();
    await Promise.all([toast.onDismiss(), toast.onAutoClose()]);
    expect(run).toHaveBeenCalledOnce();
  });
});
