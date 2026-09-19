"use client";
import type { StroopConfig } from "@/engine/stroop";
import type { MelaConfig } from "@/engine/mela/types";
import { MelaMarket, type MelaData } from "@/modules/MelaMarket";
import { StroopTask, type StroopData } from "@/modules/Stroop";
import type { ItemProps } from "./types";

export function InteractiveTask({ item, response, onChange, ctx }: ItemProps<"interactive_task">) {
  const config = ctx.games[item.config];
  if (!config) return <p className="text-red">Missing game config: content/games/{item.config}</p>;
  const emit = (data: unknown, completed: boolean) =>
    onChange({ type: "interactive_task", module: item.module, completed: completed || !!response?.completed, data });

  if (item.module === "stroop")
    return (
      <StroopTask
        config={config as StroopConfig}
        seed={`${ctx.candidateId}:${item.id}`}
        data={(response?.data as StroopData) ?? null}
        practiceOnly={ctx.practice}
        onData={emit}
      />
    );

  return (
    <MelaMarket
      config={config as MelaConfig}
      // Same window seed for everyone ⇒ identical events, demand and bots.
      seed={ctx.practice ? `${ctx.windowSeed}:practice` : ctx.windowSeed}
      data={(response?.data as MelaData) ?? null}
      practice={ctx.practice}
      onData={emit}
    />
  );
}
