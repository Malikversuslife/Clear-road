export interface NamedPlace {
  name: string;
  lat: number;
  lng: number;
}
export function nearbyArea(point: { lat: number; lng: number }, places: NamedPlace[]): string {
  let closest = 10000;
  let name = "PINNED LOCATION";
  for (const place of places) {
    const lat = ((place.lat - point.lat) * Math.PI) / 180;
    const lng = ((place.lng - point.lng) * Math.PI) / 180;
    const a =
      Math.sin(lat / 2) ** 2 +
      Math.cos((point.lat * Math.PI) / 180) *
        Math.cos((place.lat * Math.PI) / 180) *
        Math.sin(lng / 2) ** 2;
    const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    if (distance < closest && place.name.trim()) {
      closest = distance;
      name = "NEAR " + place.name.toUpperCase();
    }
  }
  return name;
}
