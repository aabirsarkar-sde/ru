import { programBundle } from "@/content/server";
import { Review } from "./Review";

export const metadata = { title: "Evaluator preview · Rishihood University" };

export default async function Page({ params }: PageProps<"/[program]/review">) {
  const { program, games, rubrics } = programBundle((await params).program);
  return <Review program={program} games={games} rubrics={rubrics} />;
}
