import type { AnniversaryRow } from "@/lib/nudge";

export type CoupleStats = {
  daysTogether: number | null;
  daysUntilAnniversary: number | null;
  upcomingAnniversaryTitle: string | null;
};

const RELATIONSHIP_TITLE_PATTERN = /付き合|交際|恋愛|付合/;

function daysBetween(start: Date, end: Date): number {
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endMid.getTime() - startMid.getTime()) / 86_400_000);
}

function daysUntilNextOccurrence(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());

  if (thisYear >= todayMidnight) {
    return Math.round((thisYear.getTime() - todayMidnight.getTime()) / 86_400_000);
  }
  const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((nextYear.getTime() - todayMidnight.getTime()) / 86_400_000);
}

function findRelationshipStart(anniversaries: AnniversaryRow[]): Date | null {
  const match = anniversaries.find((a) => RELATIONSHIP_TITLE_PATTERN.test(a.title));
  return match ? new Date(match.date) : null;
}

export function getRelationshipStart(anniversaries: AnniversaryRow[]): Date | null {
  return findRelationshipStart(anniversaries);
}

export function buildCoupleStats(anniversaries: AnniversaryRow[]): CoupleStats {
  const today = new Date();
  const relationshipStart = findRelationshipStart(anniversaries);

  const daysTogether = relationshipStart
    ? Math.max(0, daysBetween(relationshipStart, today))
    : null;

  if (anniversaries.length === 0) {
    return { daysTogether, daysUntilAnniversary: null, upcomingAnniversaryTitle: null };
  }

  let nearestDays = Infinity;
  let upcomingAnniversaryTitle: string | null = null;

  for (const anniversary of anniversaries) {
    const days = daysUntilNextOccurrence(anniversary.date, today);
    if (days < nearestDays) {
      nearestDays = days;
      upcomingAnniversaryTitle = anniversary.title;
    }
  }

  return {
    daysTogether,
    daysUntilAnniversary: nearestDays === Infinity ? null : nearestDays,
    upcomingAnniversaryTitle,
  };
}
