import { expect, it } from "vitest";
import { nearbyArea } from "./area-name";
it("names the report point rather than another area in view", () => {
  expect(
    nearbyArea({ lat: 6.5, lng: 3.4 }, [
      { name: "Ikeja", lat: 6.6, lng: 3.3 },
      { name: "Yaba", lat: 6.5, lng: 3.4 },
    ]),
  ).toBe("NEAR YABA");
});
it("does not invent a name when map data is missing or distant", () => {
  expect(nearbyArea({ lat: 9, lng: 7 }, [{ name: "Lagos", lat: 6.5, lng: 3.4 }])).toBe(
    "PINNED LOCATION",
  );
  expect(nearbyArea({ lat: 9, lng: 7 }, [])).toBe("PINNED LOCATION");
});
