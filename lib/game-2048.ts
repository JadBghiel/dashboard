/** 2048 rules, no react in here so the tests can play it. a board is a size x size grid of numbers,
 * 0 is an empty cell */

export type Board = number[][];
export type Direction = "up" | "down" | "left" | "right";

const emptyBoard = (size: number): Board =>
  Array.from({ length: size }, () => Array<number>(size).fill(0));

/** slides 1 row toward index 0 and merges equal neighbours once each: [2,2,2,0] -> [4,2,0,0] */
function slideRow(row: number[]) {
  const tiles = row.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

const transpose = (b: Board): Board => b[0].map((_, c) => b.map((row) => row[c]));
const reverse = (b: Board): Board => b.map((row) => [...row].reverse());

/** every direction is "slide left" on a rotated board, then rotated back */
export function move(board: Board, dir: Direction) {
  const before =
    dir === "left"
      ? board
      : dir === "right"
        ? reverse(board)
        : dir === "up"
          ? transpose(board)
          : reverse(transpose(board));

  let gained = 0;
  const slid = before.map((row) => {
    const r = slideRow(row);
    gained += r.gained;
    return r.row;
  });

  const after =
    dir === "left"
      ? slid
      : dir === "right"
        ? reverse(slid)
        : dir === "up"
          ? transpose(slid)
          : transpose(reverse(slid));

  const moved = after.some((row, r) => row.some((n, c) => n !== board[r][c]));
  return { board: after, gained, moved };
}

/** drops a 2 (90%) or a 4 (10%) on a random empty cell. random is passed in so tests are fixed */
export function spawn(board: Board, random: () => number = Math.random): Board {
  const empty: [number, number][] = [];
  board.forEach((row, r) => row.forEach((n, c) => n === 0 && empty.push([r, c])));
  if (empty.length === 0) return board;
  const [r, c] = empty[Math.floor(random() * empty.length)];
  const next = board.map((row) => [...row]);
  next[r][c] = random() < 0.9 ? 2 : 4;
  return next;
}

export const newBoard = (size: number, random: () => number = Math.random) =>
  spawn(spawn(emptyBoard(size), random), random);

export const canMove = (board: Board) =>
  (["left", "right", "up", "down"] as const).some((d) => move(board, d).moved);

export const highest = (board: Board) => Math.max(...board.flat());
