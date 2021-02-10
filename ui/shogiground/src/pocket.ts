import { State } from "./state";
import { createEl, droppableRoles } from "./util";
import { Pockets, Role } from "./types";

const droppableLetters: { [letter: string]: Role } = {
  p: "pawn",
  l: "lance",
  n: "knight",
  s: "silver",
  g: "gold",
  b: "bishop",
  r: "rook",
};

export function makePockets(str?: string | null): Pockets | undefined {
  if (str === undefined) return undefined;
  const pockets = [
    { pawn: 0, lance: 0, knight: 0, silver: 0, gold: 0, bishop: 0, rook: 0 },
    { pawn: 0, lance: 0, knight: 0, silver: 0, gold: 0, bishop: 0, rook: 0 }
  ];
  if (str) {
    let num = 0;
    for (const c of str) {
      const role = droppableLetters[c.toLowerCase()];
      if (role) {
        pockets[c.toLowerCase() === c ? 1 : 0][role] += num ? num : 1;
        num = 0;
      } else {
        num = num * 10 + Number(c);
      }
    }
  }
  return pockets;
}

export function addPocketEl(
  s: State,
  element: HTMLElement,
  position: string
): HTMLElement {
  const pocket = createEl("div", "pocket is2d pocket-" + position),
    color = (s.orientation === "white") !== (position == "top") ? "white" : "black";
  element.appendChild(pocket);
  for (const role of droppableRoles) {
    const c1 = createEl("div", "pocket-c1");
    pocket.appendChild(c1);
    const c2 = createEl("div", "pocket-c2");
    c1.appendChild(c2);
    const piece = createEl("piece", role + " " + color);
    piece.setAttribute("data-role", role);
    piece.setAttribute("data-color", color);
    piece.setAttribute("data-nb", "0");
    c2.appendChild(piece);

  }
  return pocket;
}
