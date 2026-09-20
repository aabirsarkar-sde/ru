"use client";
// Registry: item type → component. Adding a new item type (e.g. a code-
// reasoning item for B.Tech) means adding a schema entry and one line here.
import { MediaView, RichText } from "@/components/media";
import type { AnyItemProps } from "./types";
import { Allocation } from "./Allocation";
import { DrawingCanvas } from "./DrawingCanvas";
import { Hotspot } from "./Hotspot";
import { InteractiveTask } from "./InteractiveTask";
import { LayoutDrag } from "./LayoutDrag";
import { McqMulti, McqSingle } from "./Mcq";
import { PhotoUpload } from "./PhotoUpload";
import { Portfolio } from "./Portfolio";
import { Ranking } from "./Ranking";
import { TextResponse } from "./TextResponse";

/* eslint-disable @typescript-eslint/no-explicit-any */
const REGISTRY: Record<string, React.ComponentType<any>> = {
  mcq_single: McqSingle,
  mcq_multi: McqMulti,
  ranking: Ranking,
  short_text: TextResponse,
  long_text: TextResponse,
  drawing_canvas: DrawingCanvas,
  photo_upload: PhotoUpload,
  layout_drag: LayoutDrag,
  hotspot: Hotspot,
  allocation: Allocation,
  portfolio: Portfolio,
  interactive_task: InteractiveTask,
};

export function ItemBody(props: AnyItemProps) {
  const C = REGISTRY[props.item.type];
  return C ? <C {...props} /> : <p className="text-red">Unknown item type: {props.item.type}</p>;
}

export function ItemView(props: AnyItemProps & { number?: number; total?: number; hidePrompt?: boolean }) {
  const { item } = props;
  const phone = item.media.length === 1 && item.media[0].kind === "image" && item.media[0].frame === "phone" ? item.media[0] : null;
  return (
    <article aria-labelledby={`q-${item.id}`} className="animate-fade">
      {!props.hidePrompt && (
        <header className="mb-5">
          {props.number != null && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-mute">
              Question {props.number}
              {props.total ? ` of ${props.total}` : ""}
              {item.time_hint ? ` · about ${item.time_hint}` : ""}
            </p>
          )}
          <h2 id={`q-${item.id}`} className="font-serif text-[1.75rem] leading-snug text-ink sm:text-3xl">
            <RichText text={item.prompt} />
          </h2>
          {item.help && <p className="mt-2 text-ink-soft">{item.help}</p>}
        </header>
      )}
      {phone ? (
        // A phone screenshot sits beside the answers, at phone size.
        <div className="grid items-start gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <MediaView media={phone} />
          <ItemBody {...props} />
        </div>
      ) : (
        <>
          {item.media.length > 0 && (
            <div className={`mb-6 grid gap-4 ${item.media.length === 2 ? "sm:grid-cols-2" : ""}`}>
              {item.media.map((m, i) => (
                <MediaView key={i} media={m} />
              ))}
            </div>
          )}
          <ItemBody {...props} />
        </>
      )}
    </article>
  );
}
