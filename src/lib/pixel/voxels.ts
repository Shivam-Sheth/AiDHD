export type Voxel = { x: number; y: number; z: number; color: string };

export type VoxelModel = {
  voxels: Voxel[];
  extent: number;
};

export type PixelObjectKey = "plane" | "hotel" | "ticket" | "dining";

export const PIXEL_OBJECT_ORDER: PixelObjectKey[] = [
  "plane",
  "hotel",
  "ticket",
  "dining",
];

export const PIXEL_OBJECT_META: Record<
  PixelObjectKey,
  { label: string; blurb: string; accent: string }
> = {
  plane: {
    label: "Flights",
    blurb: "Live Duffel options ranked for the group — cabin, timing, and split cost.",
    accent: "#5eead4",
  },
  hotel: {
    label: "Hotels",
    blurb: "Stays that clear every budget cap, with trust scores before you pick.",
    accent: "#e8c47a",
  },
  ticket: {
    label: "Tickets",
    blurb: "Concerts, clubs, and shows from Ticketmaster — scoped spend per seat.",
    accent: "#f0a0b8",
  },
  dining: {
    label: "Dining",
    blurb: "Tables that fit the night — pre-show bites or a destination dinner.",
    accent: "#a8d4ff",
  },
};

const INK = "#e8ecf5";
const MUTE = "#9aa3b5";
const EDGE = "#1c2030";

function normalize(voxels: Voxel[]): VoxelModel {
  if (!voxels.length) return { voxels, extent: 1 };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  for (const v of voxels) {
    v.x -= cx;
    v.y -= cy;
    v.z -= cz;
  }
  return {
    voxels,
    extent: Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1,
  };
}

function fill(
  bounds: { x: number; y: number; z: number },
  pred: (x: number, y: number, z: number) => string | null,
): Voxel[] {
  const out: Voxel[] = [];
  for (let x = -bounds.x; x <= bounds.x; x++) {
    for (let y = -bounds.y; y <= bounds.y; y++) {
      for (let z = -bounds.z; z <= bounds.z; z++) {
        const color = pred(x, y, z);
        if (color) out.push({ x, y, z, color });
      }
    }
  }
  return out;
}

function inEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

/** Side-view airliner with wings and tail. */
function buildPlane(): VoxelModel {
  const accent = "#5eead4";
  const body = "#dfe6f5";
  const wing = "#7fd8c9";
  const window = "#1a2233";
  return normalize(
    fill({ x: 16, y: 8, z: 10 }, (x, y, z) => {
      const az = Math.abs(z);
      // fuselage
      if (Math.abs(y) <= 2 && az <= 2 && x >= -12 && x <= 12) {
        if (y === 1 && az <= 1 && x > -8 && x < 8 && x % 3 === 0) return window;
        if (x >= 10) return accent;
        return body;
      }
      // cockpit taper
      if (x >= 12 && x <= 15 && Math.abs(y) <= 1 && az <= 1) return accent;
      // main wings
      if (y >= -1 && y <= 0 && x >= -2 && x <= 4 && az >= 2 && az <= 9) {
        return az > 7 ? MUTE : wing;
      }
      // rear stabilizers
      if (x >= -12 && x <= -8 && y >= 0 && y <= 5 && az <= 1) {
        return y > 3 ? accent : wing;
      }
      if (x >= -11 && x <= -8 && Math.abs(y) <= 1 && az >= 2 && az <= 5) {
        return wing;
      }
      // engines
      if (y <= -1 && y >= -3 && (az === 4 || az === 5) && x >= 0 && x <= 3) {
        return EDGE;
      }
      return null;
    }),
  );
}

/** Mid-rise hotel with lit windows. */
function buildHotel(): VoxelModel {
  const stone = "#d7dce8";
  const roof = "#e8c47a";
  const glass = "#5eead4";
  const dark = "#121622";
  return normalize(
    fill({ x: 9, y: 14, z: 7 }, (x, y, z) => {
      const ax = Math.abs(x);
      const az = Math.abs(z);
      // wide base / lobby
      if (y <= -11 && ax <= 8 && az <= 6) return y === -11 ? MUTE : EDGE;
      // roof terrace
      if (y >= 12 && y <= 13 && ax <= 6 && az <= 5) return roof;
      // sign / crown
      if (y === 14 && ax <= 3 && az <= 2) return "#f0a0b8";
      // tower body
      if (y >= -10 && y <= 11 && ax <= 5 && az <= 4) {
        const shell = ax === 5 || az === 4;
        if (shell) {
          // window grid on facade
          if (y % 3 === 0 && ((az === 4 && ax <= 4) || (ax === 5 && az <= 3))) {
            return (x + z + y) % 2 === 0 ? glass : dark;
          }
          return stone;
        }
        return EDGE;
      }
      // canopy over entrance
      if (y === -9 && ax <= 2 && z >= 4 && z <= 6) return roof;
      // door
      if (y >= -10 && y <= -8 && Math.abs(x) <= 1 && z === 4) return dark;
      return null;
    }),
  );
}

/** Concert / event ticket stub. */
function buildTicket(): VoxelModel {
  const paper = "#f0e8ef";
  const stripe = "#f0a0b8";
  const ink = "#1a1420";
  const perf = "#c4b0bc";
  return normalize(
    fill({ x: 12, y: 7, z: 2 }, (x, y, z) => {
      const az = Math.abs(z);
      if (az > 1) return null;
      // perforation bite on left
      if (x <= -10 && Math.abs(y) <= 5) {
        const bite = Math.sin(y * 1.2) * 0.6;
        if (x + 10 < bite) return null;
      }
      if (x >= -11 && x <= 11 && Math.abs(y) <= 5) {
        if (Math.abs(y) === 5 || x === 11 || x === -11) return stripe;
        if (x === -7) return perf;
        if (y === 3 && x > -5 && x < 8) return ink;
        if (y === 0 && x > -5 && x < 9) return MUTE;
        if (y === -3 && x > -4 && x < 6) return stripe;
        return paper;
      }
      return null;
    }),
  );
}

/** Round table + plate + glass for dining. */
function buildDining(): VoxelModel {
  const wood = "#c4a484";
  const plate = "#eef2f8";
  const rim = "#a8d4ff";
  const glass = "#5eead4";
  const stem = "#9ad0c4";
  return normalize(
    fill({ x: 11, y: 9, z: 11 }, (x, y, z) => {
      const r = Math.sqrt(x * x + z * z);
      // thick table top
      if ((y === 0 || y === -1) && r <= 9.5) {
        if (r > 8.6) return MUTE;
        return y === 0 ? wood : "#a88868";
      }
      // pedestal + foot
      if (y <= -2 && y >= -6 && r <= 1.8) return EDGE;
      if (y === -7 && r <= 4.5) return MUTE;
      // plate stack
      if (y === 1 && r <= 4.6) return r > 3.8 ? rim : plate;
      if (y === 2 && r <= 3.2) return r > 2.6 ? rim : plate;
      // food
      if (y === 3 && r <= 1.9) return "#f0a0b8";
      if (y === 3 && r > 1.9 && r <= 2.6 && z > 0) return "#e8c47a";
      // wine glass to the side
      {
        const gx = x - 6;
        const gz = z - 1;
        const gr = Math.sqrt(gx * gx + gz * gz);
        if (y >= 2 && y <= 6 && gr <= 1.8 && gr >= 1.1) return glass;
        if (y === 2 && gr <= 1.8) return "#2f7a70";
        if (y >= 0 && y <= 2 && gr <= 0.55) return stem;
        if (y === 0 && gr <= 1.5 && gx * gx + gz * gz <= 2.4) return stem;
      }
      // fork + knife
      if (y === 1 && z >= -8 && z <= -6) {
        if (x >= -4 && x <= 1) return x <= -2 ? INK : MUTE;
        if (x >= 2 && x <= 5) return MUTE;
      }
      return null;
    }),
  );
}

export const MODEL_BUILDERS: Record<PixelObjectKey, () => VoxelModel> = {
  plane: buildPlane,
  hotel: buildHotel,
  ticket: buildTicket,
  dining: buildDining,
};
