import type { Question } from "../types";
import { zadaci121to140 } from "./zadaci-121-140";
import { zadaci141to160 } from "./zadaci-141-160";
import { zadaci161to180 } from "./zadaci-161-180";
import { zadaci181to200 } from "./zadaci-181-200";
import { zadaci201to220 } from "./zadaci-201-220";
import { zadaci221to240 } from "./zadaci-221-240";

// Редослед прати збирку: задаци 121–240, део ГЕОГРАФИЈА.
export const questions: Question[] = [
  ...zadaci121to140,
  ...zadaci141to160,
  ...zadaci161to180,
  ...zadaci181to200,
  ...zadaci201to220,
  ...zadaci221to240,
];

const byId = new Map(questions.map((q) => [q.id, q]));

/**
 * Задатак се тражи по броју, никад по позицији у низу.
 * Позиција се мења при сваком допуњавању збирке, а број задатка је оно што је
 * уписано у већ сачуваним покушајима — тражење по позицији би им променило
 * значење уназад.
 */
export const questionById = (id: number): Question | undefined => byId.get(id);

export type { Question };
