"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  detail: string;
};

export function SiteMap({ points, height = 420 }: { points: MapPoint[]; height?: number }) {
  const node = useRef<HTMLDivElement>(null);
  const signature = points.map((point) => `${point.id}:${point.latitude}:${point.longitude}`).join("|");

  useEffect(() => {
    const element = node.current;
    if (!element) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !element) return;
      const L = leaflet.default;
      map = L.map(element, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const point of points) {
        L.circleMarker([point.latitude, point.longitude], {
          radius: 16,
          color: "transparent",
          fillColor: "#6d4aff",
          fillOpacity: 0.18,
          weight: 0,
        }).addTo(map);
        L.circleMarker([point.latitude, point.longitude], {
          radius: 7,
          color: "#ffffff",
          fillColor: "#6d4aff",
          fillOpacity: 1,
          weight: 3,
        })
          .bindPopup(
            `<strong>${point.name}</strong><br/>${point.detail}<br/><span style="color:#64748b">${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}</span>`,
          )
          .addTo(map);
        bounds.push([point.latitude, point.longitude]);
      }

      if (bounds.length === 1) map.setView(bounds[0], 12);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 11 });
      else map.setView([0.3476, 32.5825], 7);
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
    // signature already captures the plotted coordinates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div ref={node} className="w-full" style={{ height }} />
    </div>
  );
}
