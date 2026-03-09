function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function stableOffsetCoordinates(
  sessionId: string,
  lat: number,
  lng: number,
  meters = 200,
) {
  const earthRadius = 6378137;

  const hash = hashString(sessionId);

  const angle = (hash % 360) * (Math.PI / 180);
  const distance = Math.abs(hash) % meters;

  const dLat = (distance * Math.cos(angle)) / earthRadius;
  const dLng =
    (distance * Math.sin(angle)) /
    (earthRadius * Math.cos((lat * Math.PI) / 180));

  const newLat = lat + (dLat * 180) / Math.PI;
  const newLng = lng + (dLng * 180) / Math.PI;

  return {
    lat: newLat,
    lng: newLng,
  };
}
