export function toCanonicalFriendPair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371e3;
  const phi1 = (aLat * Math.PI) / 180;
  const phi2 = (bLat * Math.PI) / 180;
  const deltaPhi = ((bLat - aLat) * Math.PI) / 180;
  const deltaLambda = ((bLng - aLng) * Math.PI) / 180;

  const s =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));

  return R * c;
}
