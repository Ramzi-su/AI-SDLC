export interface Point {
  x: number;
  y: number;
}

export type ShapeKind = 'freehand' | 'rectangle' | 'ellipse';

export interface Sketch {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** SVG path in local coordinates, drawn inside a width x height box. */
  path: string;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker: drops points that deviate less than `epsilon` px from the line. */
export function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], first, last);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }
  if (maxDistance <= epsilon) return [first, last];
  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

export function toPath(points: Point[], close: boolean): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const round = (n: number) => Math.round(n * 10) / 10;
  return (
    `M${round(first.x)} ${round(first.y)}` +
    rest.map(p => ` L${round(p.x)} ${round(p.y)}`).join('') +
    (close ? ' Z' : '')
  );
}

const MIN_SIZE = 12;
// Thin strokes (e.g. a straight line) get padded to this size so they stay easy to grab.
const MIN_BOX = 24;
const CLOSE_DISTANCE = 40;

/**
 * Turns a raw freehand stroke (canvas coordinates) into a positioned shape.
 * Returns null for strokes too small to be intentional.
 */
export function strokeToSketch(stroke: Point[]): Sketch | null {
  if (stroke.length < 2) return null;
  const xs = stroke.map(p => p.x);
  const ys = stroke.map(p => p.y);
  const strokeWidth = Math.max(...xs) - Math.min(...xs);
  const strokeHeight = Math.max(...ys) - Math.min(...ys);
  if (strokeWidth < MIN_SIZE && strokeHeight < MIN_SIZE) return null;

  const width = Math.max(strokeWidth, MIN_BOX);
  const height = Math.max(strokeHeight, MIN_BOX);
  const minX = Math.min(...xs) - (width - strokeWidth) / 2;
  const minY = Math.min(...ys) - (height - strokeHeight) / 2;

  const local = simplify(stroke, 2).map(p => ({ x: p.x - minX, y: p.y - minY }));
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  // A stroke that ends near where it started is treated as a cut-out outline.
  // The threshold scales with the stroke so a short straight line never counts as closed.
  const closeThreshold = Math.min(CLOSE_DISTANCE, Math.max(strokeWidth, strokeHeight) * 0.3);
  const closed = Math.hypot(end.x - start.x, end.y - start.y) < closeThreshold;

  return {
    kind: 'freehand',
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(width),
    height: Math.round(height),
    path: toPath(local, closed),
  };
}

const ELLIPSE_SEGMENTS = 36;

/**
 * Builds a rectangle or ellipse from a drag between two canvas points.
 * With `constrain` (Shift held) it becomes a square or circle.
 * Ellipses are stored as polygons so they share rendering and hit-testing with freehand shapes.
 */
export function dragToShape(kind: 'rectangle' | 'ellipse', start: Point, end: Point, constrain: boolean): Sketch | null {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (constrain) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  const width = Math.round(Math.abs(dx));
  const height = Math.round(Math.abs(dy));
  if (width < MIN_SIZE || height < MIN_SIZE) return null;

  let path: string;
  if (kind === 'rectangle') {
    path = `M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`;
  } else {
    const points: Point[] = [];
    for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
      const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
      points.push({ x: width / 2 + (width / 2) * Math.cos(angle), y: height / 2 + (height / 2) * Math.sin(angle) });
    }
    path = toPath(points, true);
  }

  return {
    kind,
    x: Math.round(Math.min(start.x, start.x + dx)),
    y: Math.round(Math.min(start.y, start.y + dy)),
    width,
    height,
    path,
  };
}

function parsePath(path: string): { points: Point[]; closed: boolean } {
  const points: Point[] = [];
  const re = /[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g;
  let match;
  while ((match = re.exec(path)) !== null) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  return { points, closed: /Z\s*$/.test(path) };
}

function insidePolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export interface PlacedSketch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  path?: string;
  pathWidth?: number;
  pathHeight?: number;
}

/**
 * Whether a canvas point touches a drawn shape: inside a closed outline,
 * or within `tolerance` px of the line. Accounts for the shape having been moved and resized.
 */
export function hitsSketch(shape: PlacedSketch, point: Point, tolerance: number): boolean {
  if (!shape.path) return false;
  const width = shape.width || 1;
  const height = shape.height || 1;
  const scaleX = width / (shape.pathWidth || width);
  const scaleY = height / (shape.pathHeight || height);
  const originX = shape.x || 0;
  const originY = shape.y || 0;

  // Cheap rejection before checking the outline itself.
  if (
    point.x < originX - tolerance || point.x > originX + width + tolerance ||
    point.y < originY - tolerance || point.y > originY + height + tolerance
  ) {
    return false;
  }

  const { points, closed } = parsePath(shape.path);
  const placed = points.map(p => ({ x: originX + p.x * scaleX, y: originY + p.y * scaleY }));
  if (closed && placed.length > 2 && insidePolygon(point, placed)) return true;

  const segments = closed ? [...placed, placed[0]] : placed;
  for (let i = 1; i < segments.length; i++) {
    if (distanceToSegment(point, segments[i - 1], segments[i]) <= tolerance) return true;
  }
  return false;
}
