import type { Metadata } from "next";
import { programBundle } from "@/content/server";
import { Lobby } from "./Lobby";

export async function generateMetadata({ params }: PageProps<"/[program]">): Promise<Metadata> {
  const { program } = programBundle((await params).program);
  return { title: `${program.name} · Stage 2 Aptitude · Rishihood University` };
}

export default async function Page({ params }: PageProps<"/[program]">) {
  const { program, games } = programBundle((await params).program);
  return <Lobby program={program} games={games} />;
}
