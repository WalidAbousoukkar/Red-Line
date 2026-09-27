import { getBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function GET() {
  const board = await getBoard();
  return Response.json(board);
}
