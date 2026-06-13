import type { ExpressionTokens } from "@/lib/couple-home-world/types";

export function buildCoupleWorldClassName(
  expression: ExpressionTokens | null
): string {
  const parts = ["min-h-screen", "relative", "aiai-couple-world"];
  if (!expression) return parts.join(" ");

  parts.push(
    `aiai-express-density-${expression.density}`,
    `aiai-express-material-${expression.material}`,
    `aiai-express-type-${expression.typography}`,
    `aiai-express-heading-${expression.heading}`
  );
  return parts.join(" ");
}
