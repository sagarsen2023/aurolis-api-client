import { useState, type MouseEvent } from "react";
import type { LoadSecondPoint } from "@/types/engine/load-engine.type";
import { formatCount, formatMs } from "./format";

const WIDTH = 600;
const HEIGHT = 160;

type Mode = "latency" | "throughput";

const SERIES: Record<
  Mode,
  ReadonlyArray<{
    key: "p50" | "p95" | "requests" | "failed";
    label: string;
    color: string;
  }>
> = {
  latency: [
    { key: "p50", label: "Median", color: "var(--vio)" },
    { key: "p95", label: "95th percentile", color: "var(--s-4xx)" },
  ],
  throughput: [
    { key: "requests", label: "Requests", color: "var(--vio)" },
    { key: "failed", label: "Failed", color: "var(--s-5xx)" },
  ],
};

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((n) => n * power >= value) ?? 10;
  return step * power;
}

function linePath(
  points: LoadSecondPoint[],
  key: "p50" | "p95",
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let path = "";
  let drawing = false;
  points.forEach((point, index) => {
    if (point[key] === 0) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`;
    drawing = true;
  });
  return path;
}

function LoadTimeline({
  mode,
  points,
}: Readonly<{ mode: Mode; points: LoadSecondPoint[] }>) {
  const [hover, setHover] = useState<number | null>(null);
  const series = SERIES[mode];
  const count = Math.max(points.length, 2);
  const peak =
    mode === "latency"
      ? Math.max(0, ...points.map((point) => point.p95))
      : Math.max(0, ...points.map((point) => point.requests));
  const top = niceMax(peak);
  const step = WIDTH / count;
  const x = (index: number) =>
    mode === "latency" ? (index / (count - 1)) * WIDTH : index * step;
  const y = (value: number) => HEIGHT - (value / top) * HEIGHT;
  const format = (value: number) =>
    mode === "latency" ? formatMs(value) : formatCount(value);

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const index =
      mode === "latency"
        ? Math.round(ratio * (count - 1))
        : Math.floor(ratio * count);
    setHover(index >= 0 && index < points.length ? index : null);
  };

  const hovered = hover === null ? null : points[hover];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <ul className="flex items-center gap-4">
          {series.map((entry) => (
            <li key={entry.key} className="flex items-center gap-1.5 text-mute">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.label}
            </li>
          ))}
        </ul>
        <span className="text-dim tabular-nums">
          {hovered
            ? `${hovered.second}s · ${series
                .map((entry) => `${entry.label} ${format(hovered[entry.key])}`)
                .join(" · ")}`
            : `Peak ${format(peak)}${mode === "throughput" ? " req/s" : ""}`}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={
            mode === "latency"
              ? "Response time per second"
              : "Requests per second"
          }
          className="h-40 w-full overflow-visible"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1={0}
              x2={WIDTH}
              y1={HEIGHT * fraction}
              y2={HEIGHT * fraction}
              stroke="var(--border)"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT}
            y2={HEIGHT}
            stroke="var(--border)"
            vectorEffect="non-scaling-stroke"
          />
          {mode === "throughput"
            ? points.map((point, index) => {
                const gap = Math.min(2, step * 0.2);
                const ok = point.requests - point.failed;
                return (
                  <g key={point.second}>
                    <rect
                      x={x(index) + gap / 2}
                      width={Math.max(step - gap, 0.5)}
                      y={y(ok)}
                      height={HEIGHT - y(ok)}
                      fill="var(--vio)"
                      opacity={hover === null || hover === index ? 0.85 : 0.45}
                    />
                    {point.failed > 0 ? (
                      <rect
                        x={x(index) + gap / 2}
                        width={Math.max(step - gap, 0.5)}
                        y={y(point.requests)}
                        height={HEIGHT - y(point.failed)}
                        fill="var(--s-5xx)"
                      />
                    ) : null}
                  </g>
                );
              })
            : series.map((entry) => (
                <path
                  key={entry.key}
                  d={linePath(points, entry.key as "p50" | "p95", x, y)}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          {hover !== null && mode === "latency" ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={0}
              y2={HEIGHT}
              stroke="var(--mute)"
              strokeOpacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        <span className="pointer-events-none absolute top-0 left-1 -translate-y-1/2 bg-card px-1 text-[11px] text-dim tabular-nums">
          {format(top)}
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-dim tabular-nums">
        <span>0s</span>
        <span>{Math.max(points.length - 1, 0)}s</span>
      </div>
    </div>
  );
}

export default LoadTimeline;
