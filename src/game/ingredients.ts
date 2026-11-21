export interface IngredientKind {
  id: string;
  label: string;
  /** Radius as a fraction of the design height. */
  r: number;
  juice: string;
  juiceEdge: string;
}

export const INGREDIENTS: IngredientKind[] = [
  { id: "moonberry", label: "Moonberry", r: 0.053, juice: "#c6e86a", juiceEdge: "#eefab5" },
  { id: "newt-eye", label: "Newt eye", r: 0.05, juice: "#d9f7c8", juiceEdge: "#f2ffe6" },
  { id: "blue-crystal", label: "Blue crystal", r: 0.052, juice: "#59c6ff", juiceEdge: "#bdeaff" },
  { id: "carrot", label: "Carrot", r: 0.052, juice: "#ff8a3d", juiceEdge: "#ffc48f" },
  { id: "fire-pepper", label: "Fire pepper", r: 0.052, juice: "#ff4d3d", juiceEdge: "#ffb0a0" },
  { id: "mushroom", label: "Mushroom", r: 0.052, juice: "#ffe6c9", juiceEdge: "#fff6e8" },
  { id: "dragon-scale", label: "Dragon scale", r: 0.052, juice: "#4fd6c0", juiceEdge: "#b8f7ec" },
  { id: "star-fruit", label: "Star fruit", r: 0.052, juice: "#ffd84a", juiceEdge: "#fff2b8" },
];

const byIdMap = new Map(INGREDIENTS.map((k) => [k.id, k]));

export function byId(id: string): IngredientKind {
  const hit = byIdMap.get(id);
  if (!hit) throw new Error(`Unknown ingredient: ${id}`);
  return hit;
}

/** The whole-ingredient sprite, also used for the HTML cards and trays. */
export function iconUrl(kind: IngredientKind): string {
  return `/assets/${kind.id}.png`;
}
