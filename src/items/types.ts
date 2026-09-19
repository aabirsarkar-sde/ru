import type { Item } from "@/content/schema";
import type { ResponseOf, Response } from "@/engine/responses";

export interface ItemContext {
  programId: string;
  candidateId: string;
  /** Test-window seed — shared by every candidate in the window (games). */
  windowSeed: string;
  /** Game configs keyed by file name. */
  games: Record<string, unknown>;
  /** Practice mode: nothing is scored and games run shortened. */
  practice: boolean;
}

export interface ItemProps<T extends Item["type"]> {
  item: Extract<Item, { type: T }>;
  response: ResponseOf<T> | undefined;
  onChange: (r: ResponseOf<T>) => void;
  onActivity?: (type: "paste_blocked") => void;
  ctx: ItemContext;
}

export type AnyItemProps = {
  item: Item;
  response: Response | undefined;
  onChange: (r: Response) => void;
  onActivity?: (type: "paste_blocked") => void;
  ctx: ItemContext;
};
