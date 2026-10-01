import Autoplay from "embla-carousel-autoplay";
import { Link } from "@tanstack/react-router";
import { Plus, StickyNote } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/lib/queries";

export function NotesSlider() {
  const { data: notes = [], isPending: loading } = useNotes(10);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">My Notes</h2>
        </div>
        <Link
          to="/notes"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </header>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No notes yet.</p>
          <Link to="/notes">
            <Button size="sm" variant="outline" className="mt-3">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add note
            </Button>
          </Link>
        </div>
      ) : (
        <Carousel
          opts={{ loop: notes.length > 1, align: "start" }}
          plugins={[Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })]}
          className="relative"
        >
          <CarouselContent>
            {notes.map((n) => (
              <CarouselItem key={n.id}>
                <div className="rounded-xl border border-border bg-background p-5 min-h-[140px] flex flex-col">
                  <h3 className="font-display text-base font-semibold leading-tight line-clamp-1">{n.title}</h3>
                  {n.content && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">{n.content}</p>
                  )}
                  <p className="mt-auto pt-3 text-xs text-muted-foreground/70">
                    {format(parseISO(n.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {notes.length > 1 && (
            <>
              <CarouselPrevious className="left-2 h-7 w-7" />
              <CarouselNext className="right-2 h-7 w-7" />
            </>
          )}
        </Carousel>
      )}
    </section>
  );
}
