import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Note } from "@/lib/notes";
import { useInvalidate, useNotes } from "@/lib/queries";

export const Route = createFileRoute("/_authed/notes")({
  head: () => ({
    meta: [
      { title: "My Notes — Ledger" },
      { name: "description", content: "Capture and manage your personal notes." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { user } = useAuth();
  const { data: notes = [], isPending: loading } = useNotes();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setOpen(true);
  };

  const openEdit = (n: Note) => {
    setEditing(n);
    setTitle(n.title);
    setContent(n.content);
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload = { title: title.trim(), content: content.trim(), user_id: user.id };
    const res = editing
      ? await supabase.from("notes").update(payload).eq("id", editing.id)
      : await supabase.from("notes").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(editing ? "Note updated" : "Note created");
    setOpen(false);
    invalidate.notes();
  };

  const remove = async (n: Note) => {
    const { error } = await supabase.from("notes").delete().eq("id", n.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Note deleted");
    setConfirmDelete(null);
    invalidate.notes();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            My Notes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture ideas, reminders, and to-dos.
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-gradient-emerald text-primary-foreground shadow-elegant hover:opacity-95"
        >
          <Plus className="mr-2 h-4 w-4" /> Add note
        </Button>
      </header>

      {loading && notes.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <StickyNote className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-semibold">No notes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first note to get started.
          </p>
          <Button
            onClick={openNew}
            className="mt-4 bg-gradient-emerald text-primary-foreground hover:opacity-95"
          >
            <Plus className="mr-2 h-4 w-4" /> Add note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <article
              key={n.id}
              className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-elegant"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold leading-tight">{n.title}</h3>
                <div className="flex shrink-0 gap-1 transition md:opacity-0 md:group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(n)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-expense"
                    onClick={() => setConfirmDelete(n)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {n.content && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-6">
                  {n.content}
                </p>
              )}
              <p className="mt-4 text-xs text-muted-foreground/70">
                {format(parseISO(n.created_at), "MMM d, yyyy")}
              </p>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit note" : "New note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note…"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-gradient-emerald text-primary-foreground hover:opacity-95"
            >
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
