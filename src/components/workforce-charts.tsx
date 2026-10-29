"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/utils";

const dutyColor: Record<string, string> = {
  present: "#34d399",
  late: "#fbbf24",
  absent: "#fb7185",
  leave: "#60a5fa",
  holiday: "#a78bfa",
  off_day: "#cbd5e1",
  remote: "#22d3ee",
  business_travel: "#c4b5fd",
};

function useDraw() {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return drawn;
}

export function SiteBars({ data }: { data: { name: string; value: number }[] }) {
  const drawn = useDraw();
  const max = Math.max(...data.map((row) => row.value), 1);
  const total = data.reduce((sum, row) => sum + row.value, 0) || 1;

  return (
    <div className="space-y-5">
      {data.map((row) => {
        const share = Math.round((row.value / total) * 100);
        return (
          <div key={row.name}>
            <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{row.name}</span>
              <span className="shrink-0 font-medium">
                {row.value}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{share}%</span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#f3f4f6]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#5b3df5] shadow-[0_8px_16px_-8px_rgba(91,61,245,0.9)] transition-[width] duration-700 ease-out"
                style={{ width: drawn ? `${(row.value / max) * 100}%` : "0%" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AllowanceBars({
  data,
  currency,
}: {
  data: { name: string; value: number }[];
  currency: string;
}) {
  const drawn = useDraw();
  const max = Math.max(...data.map((row) => row.value), 1);

  return (
    <div className="space-y-5">
      {data.map((row) => (
        <div key={row.name}>
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">{row.name}</span>
            <span className="shrink-0 font-medium">{money(row.value, currency)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#f3f4f6]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#a7f3d0] to-[#10b981] shadow-[0_8px_16px_-8px_rgba(16,185,129,0.9)] transition-[width] duration-700 ease-out"
              style={{ width: drawn ? `${(row.value / max) * 100}%` : "0%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function curve(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const low = Math.min(current.y, next.y);
    const high = Math.max(current.y, next.y);
    const clamp = (value: number) => Math.min(high, Math.max(low, value));
    const c1x = current.x + (next.x - previous.x) / 6;
    const c1y = clamp(current.y + (next.y - previous.y) / 6);
    const c2x = next.x - (after.x - current.x) / 6;
    const c2y = clamp(next.y - (after.y - current.y) / 6);
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${next.x},${next.y}`;
  }
  return path;
}

export function AreaTrend({ points, caption }: { points: { label: string; value: number }[]; caption: string }) {
  const width = 640;
  const height = 210;
  const padX = 28;
  const padTop = 28;
  const padBottom = 32;
  const max = Math.max(...points.map((point) => point.value), 1);
  const plot = points.map((point, index) => ({
    ...point,
    x: padX + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - padX * 2)),
    y: padTop + (1 - point.value / max) * (height - padTop - padBottom),
  }));
  const line = curve(plot);
  const last = plot[plot.length - 1];
  const area = last ? `${line} L${last.x},${height - padBottom} L${plot[0].x},${height - padBottom} Z` : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
      <defs>
        <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {plot.map((point) => (
        <line key={point.label} x1={point.x} y1={padTop} x2={point.x} y2={height - padBottom} stroke="#f3f4f6" />
      ))}
      <path d={area} fill="url(#headcountFill)" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {last ? (
        <g>
          <circle cx={last.x} cy={last.y} r="7" fill="#fff" stroke="#3b82f6" strokeWidth="3" />
          <g transform={`translate(${Math.min(last.x - 54, width - 128)},${Math.max(last.y - 46, 4)})`}>
            <rect width="118" height="36" rx="10" fill="#111827" />
            <text x="12" y="15" fill="#9ca3af" fontSize="9">{caption}</text>
            <text x="12" y="28" fill="#fff" fontSize="11" fontWeight="600">{last.value} officers</text>
          </g>
        </g>
      ) : null}
      {plot.map((point) => (
        <text key={point.label} x={point.x} y={height - 10} textAnchor="middle" fill="#9ca3af" fontSize="11">
          {point.label}
        </text>
      ))}
    </svg>
  );
}

export function ColumnBars({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(...data.map((row) => row.value), 1);
  const peak = Math.max(...data.map((row) => row.value));
  return (
    <div className="flex h-48 items-end gap-3">
      {data.map((row) => {
        const highlighted = row.value === peak && peak > 0;
        return (
          <div key={row.name} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className={`text-xs font-medium ${highlighted ? "text-[#2563eb]" : "text-muted-foreground"}`}>{row.value}</span>
            <div className="flex h-32 w-full items-end justify-center">
              <div
                className={`w-8 rounded-t-md ${highlighted ? "bg-[#3b82f6]" : "bg-[#e7eef8]"}`}
                style={{ height: `${row.value === 0 ? 8 : Math.max((row.value / max) * 100, 28)}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-[11px] text-muted-foreground">{row.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({ points }: { points: { label: string; value: number }[] }) {
  const width = 220;
  const height = 64;
  const max = Math.max(...points.map((point) => point.value), 1);
  const plot = points.map((point, index) => ({
    x: 6 + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - 12)),
    y: 8 + (1 - point.value / max) * (height - 16),
  }));
  const line = curve(plot);
  const last = plot[plot.length - 1];
  const area = last ? `${line} L${last.x},${height} L${plot[0].x},${height} Z` : "";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-16 w-full">
      <path d={area} fill="#dbeafe" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function piePoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

export function SharePie({ slices }: { slices: { key: string; label: string; value: number }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const size = 168;
  const center = size / 2;
  const radius = 68;
  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const arc = { ...slice, start: cursor, end: cursor + sweep, fill: dutyColor[slice.key] ?? "#3b82f6" };
    cursor += sweep;
    return arc;
  });

  return (
    <div className="grid items-center gap-3 sm:grid-cols-[168px_1fr]">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-40 w-40">
        {arcs.length === 1 ? (
          <circle cx={center} cy={center} r={radius} fill={arcs[0].fill} />
        ) : arcs.map((arc) => {
          const gap = arcs.length > 1 ? 1.5 : 0;
          const [x1, y1] = piePoint(center, center, radius, arc.start + gap);
          const [x2, y2] = piePoint(center, center, radius, arc.end - gap);
          const large = arc.end - arc.start - gap * 2 > 180 ? 1 : 0;
          return (
            <path
              key={arc.key}
              d={`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={arc.fill}
            />
          );
        })}
        <circle cx={center} cy={center} r="38" fill="#fff" />
        <text x={center} y={center - 2} textAnchor="middle" fill="#111827" fontSize="20" fontWeight="700">{total}</text>
        <text x={center} y={center + 14} textAnchor="middle" fill="#6b7280" fontSize="10">marked</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {arcs.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.fill }} />
              {slice.label}
            </span>
            <span className="font-medium">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MiniColumns({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(...data.map((row) => row.value), 1);
  return (
    <div className="mt-4 flex h-16 items-end gap-2">
      {data.map((row, index) => (
        <div key={row.name} className="flex h-full flex-1 items-end" title={row.name}>
          <div
            className={`w-full rounded-t ${index === data.length - 1 ? "bg-[#3b82f6]" : "bg-[#bfdbfe]"}`}
            style={{ height: `${Math.max((row.value / max) * 100, 12)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function DutyRing({ slices }: { slices: { key: string; label: string; value: number }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const size = 156;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 8 : 0;
  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.value / total) * circumference;
    const length = Math.max(sweep - gap, 1);
    const arc = {
      ...slice,
      fill: dutyColor[slice.key] ?? "#c4b5fd",
      length,
      offset: cursor,
    };
    cursor += sweep;
    return arc;
  });

  return (
    <div className="grid items-center gap-3 sm:grid-cols-[168px_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          <defs>
            <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#6d4aff" floodOpacity="0.18" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.fill}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arc.length} ${circumference}`}
              strokeDashoffset={-arc.offset}
              filter="url(#ringGlow)"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-tight">{slices.reduce((sum, slice) => sum + slice.value, 0)}</p>
            <p className="text-[11px] text-muted-foreground">marked</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {arcs.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.fill, boxShadow: `0 0 0 4px ${slice.fill}22` }} />
              {slice.label}
            </span>
            <span className="font-medium">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
