"use server";

import type { VehicleProfile } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { geocode, routeHgv, OrsError, type OrsRestrictions } from "@/lib/ors";
import { fetchRoadworks } from "@/lib/overpass";
import {
  bufferBboxAroundLine,
  pointToAvoidPolygon,
  sampleWaypoints,
  buildGoogleMapsDirUrl,
  buildMapsPin,
  type PolygonCoords,
} from "@/lib/googleMaps";

export type VehicleInput = OrsRestrictions;

const MAX_AVOID_POLYGONS = 20;

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export async function getVehicleProfile(): Promise<VehicleProfile | null> {
  const user = await requireAuth();
  return prisma.vehicleProfile.findUnique({ where: { userId: user.id } });
}

export async function saveVehicleProfile(input: VehicleInput): Promise<VehicleProfile> {
  const user = await requireAuth();
  const data = {
    weight: clamp(input.weight, 1, 120),
    height: clamp(input.height, 1, 6),
    length: clamp(input.length, 1, 30),
    width: clamp(input.width, 1, 5),
    axleload: clamp(input.axleload, 0.5, 30),
  };
  const profile = await prisma.vehicleProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  revalidatePath("/truck");
  return profile;
}

export interface PlanResult {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  distanceKm: number;
  durationMin: number;
  roadworksAvoided: number;
  googleMapsUrl: string;
  waypoints: { lat: number; lng: number }[];
  roadworks: { lat: number; lng: number; label: string; mapsPinUrl: string }[];
  approximate: true;
}

export interface PlanError {
  error: string;
}

/** Min squared distance (in deg²) from a point to any vertex of the route line. */
function nearestVertexDist2(lat: number, lng: number, line: [number, number][]): number {
  let best = Infinity;
  for (const [vLng, vLat] of line) {
    const d = (vLat - lat) ** 2 + (vLng - lng) ** 2;
    if (d < best) best = d;
  }
  return best;
}

export async function planTruckRoute(
  origin: string,
  destination: string,
): Promise<PlanResult | PlanError> {
  await requireAuth();

  const profile = await getVehicleProfile();
  if (!profile) {
    return { error: "Najpierw zapisz profil pojazdu (waga, wysokość, wymiary)." };
  }
  const restrictions: OrsRestrictions = {
    weight: profile.weight,
    height: profile.height,
    length: profile.length,
    width: profile.width,
    axleload: profile.axleload,
  };

  try {
    const from = await geocode(origin.trim());
    if (!from) return { error: `Nie znaleziono adresu początkowego: „${origin}".` };
    const to = await geocode(destination.trim());
    if (!to) return { error: `Nie znaleziono adresu docelowego: „${destination}".` };

    const coords: [number, number][] = [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ];

    // 1. Base HGV route (already avoids OSM weight/height/hgv restrictions).
    const base = await routeHgv(coords, restrictions, []);

    // 2. Current roadworks in the route corridor.
    const bbox = bufferBboxAroundLine(base.geometry, 0.02);
    const roadworks = await fetchRoadworks(bbox);

    // 3. Keep the roadworks nearest to the route line, turn them into avoid
    //    polygons, and re-route. Fall back to the base route on failure.
    const nearest = roadworks
      .map((rw) => ({ rw, d2: nearestVertexDist2(rw.lat, rw.lng, base.geometry) }))
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, MAX_AVOID_POLYGONS)
      .map((x) => x.rw);

    let route = base;
    let roadworksAvoided = 0;
    if (nearest.length > 0) {
      const avoid: PolygonCoords[] = nearest.map((rw) => pointToAvoidPolygon(rw.lat, rw.lng, 40));
      try {
        route = await routeHgv(coords, restrictions, avoid);
        roadworksAvoided = nearest.length;
      } catch {
        // avoid_polygons made it unroutable / rejected — keep the base route.
        route = base;
        roadworksAvoided = 0;
      }
    }

    const waypoints = sampleWaypoints(route.geometry, 8);
    const googleMapsUrl = buildGoogleMapsDirUrl(from.label, to.label, waypoints);

    return {
      origin: from,
      destination: to,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      roadworksAvoided,
      googleMapsUrl,
      waypoints,
      roadworks: nearest.map((rw) => ({
        ...rw,
        mapsPinUrl: buildMapsPin(rw.lat, rw.lng),
      })),
      approximate: true,
    };
  } catch (err) {
    if (err instanceof OrsError) return { error: err.message };
    return { error: "Nie udało się zaplanować trasy. Spróbuj ponownie." };
  }
}
