import { CommuteScreen } from "@/components/commute-screen";
import { getBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

export default async function Home() {
  const board = await getBoard();
  return <CommuteScreen initial={board} />;
}
