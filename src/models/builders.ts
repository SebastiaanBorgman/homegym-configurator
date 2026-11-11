import { ALL_IN_ONE_INNER_HALF, JCUP_HEIGHT, SAFETY_HEIGHT, halfRackLayout } from '../catalog/collision';
import type { ModelKind } from '../catalog/types';
import { Kit, MAT } from './kit';

/**
 * Procedurele modellen van fitnessapparatuur.
 *
 * Elk model is een VEREENVOUDIGDE RECONSTRUCTIE: herkenbaar als het type toestel, opgebouwd
 * binnen exact de buitenmaten (w × d × h) van het product, maar geen replica van het origineel.
 * Afspraak per bouwfunctie: de uiterste onderdelen raken alle zes de vlakken van het
 * omhullende blok, en niets steekt erbuiten.
 */

export type ModelParams = Record<string, number | string | boolean | number[]>;
type Builder = (k: Kit, p: ModelParams) => void;

const num = (p: ModelParams, key: string, fallback: number) => (typeof p[key] === 'number' ? (p[key] as number) : fallback);

/** J-cup aan de achterzijde van een staander; de stang rust op JCUP_HEIGHT. */
function jCup(k: Kit, x: number, faceZ: number, width: number, dir: 1 | -1) {
  k.boxUp(width, 0.02, 0.09, x, JCUP_HEIGHT - 0.02, faceZ + dir * 0.045, MAT.steelDark);
  k.boxUp(width, 0.13, 0.012, x, JCUP_HEIGHT - 0.02, faceZ + dir * 0.006, MAT.steelDark);
  k.boxUp(width, 0.05, 0.012, x, JCUP_HEIGHT - 0.02, faceZ + dir * 0.084, MAT.steelDark);
}

// ───────────────────────────────── Racks ─────────────────────────────────

const powerRack: Builder = (k, p) => {
  const { w, d, h } = k;
  const t = num(p, 'tube', 0.075);
  const x = w / 2 - t / 2;
  const z = d / 2 - t / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) k.boxUp(t, h, t, sx * x, 0, sz * z, MAT.steelBlack);
    k.boxUp(t, t, d - 2 * t, sx * x, 0, 0, MAT.steelBlack); // voetbalk
    k.box(t, t, d - 2 * t, sx * x, h - t / 2, 0, MAT.steelBlack); // bovenbalk
    k.cyl(0.02, d - t, 'z', sx * x, SAFETY_HEIGHT, 0, MAT.chrome); // pin/pipe-safety
    jCup(k, sx * x, z - t / 2, t * 0.9, -1);
    // rubberen voetjes
    k.boxUp(t * 1.02, 0.012, t * 1.02, sx * x, 0, z, MAT.rubber);
    k.boxUp(t * 1.02, 0.012, t * 1.02, sx * x, 0, -z, MAT.rubber);
  }
  k.boxUp(w - 2 * t, t, t, 0, 0, -z, MAT.steelBlack); // achterbalk onder
  k.box(w - 2 * t, t, t, 0, h - t / 2, -z, MAT.steelBlack); // achterbalk boven
  k.box(0.3, t * 0.6, 0.004, 0, h - t / 2, -z + t / 2 + 0.002, MAT.steelGrey); // naamplaat
  k.cyl(0.016, w - 2 * t, 'x', 0, h - t / 2, z, MAT.chrome); // optrekstang
};

const halfRack: Builder = (k, p) => {
  const { w, d, h } = k;
  const t = num(p, 'tube', 0.06);
  const L = halfRackLayout({ width: w, depth: d, height: h }, t);
  const ux = L.frameHalfWidth - t / 2;
  const uz = L.uprightZ;
  const rz = -d / 2 + t / 2;
  const rearH = h * 0.62;
  for (const s of [-1, 1]) {
    k.boxUp(t, t, d, s * ux, 0, 0, MAT.steelBlack); // voet over de volle diepte
    k.boxUp(t, h, t, s * ux, 0, uz, MAT.steelBlack); // hoofdstaander
    k.boxUp(t, rearH, t, s * ux, 0, rz, MAT.steelBlack); // opslagstaander
    k.box(t * 0.8, t * 0.8, uz - rz, s * ux, rearH - t / 2, (uz + rz) / 2, MAT.steelBlack);
    // schijfhouders naar buiten: bepalen de totale breedte
    for (const y of [0.34, 0.72]) k.cyl(0.024, 0.12, 'x', s * (L.frameHalfWidth + 0.06), y, rz, MAT.chrome);
    // spotter arm met beschermstrip
    const armZ = uz + t / 2 + L.armLength / 2;
    k.box(t, 0.09, L.armLength, s * ux, L.armHeight, armZ, MAT.steelBlack);
    k.box(t * 0.8, 0.012, L.armLength * 0.94, s * ux, L.armHeight + 0.05, armZ, MAT.plasticLight);
    jCup(k, s * ux, uz + t / 2, t * 0.9, 1);
  }
  k.boxUp(2 * ux - t, t, t, 0, 0, rz, MAT.steelBlack);
  k.boxUp(2 * ux - t, t, t, 0, 0, uz, MAT.steelBlack);
  k.box(2 * ux - t, t, t * 0.7, 0, h - 0.32, uz, MAT.steelBlack);
  k.cyl(0.016, 2 * ux, 'x', 0, h - t / 2, uz, MAT.chrome); // optrekstang
};

const allInOne: Builder = (k) => {
  const { w, d, h } = k;
  const t = 0.07;
  const inner = Math.min(ALL_IN_ONE_INNER_HALF, w / 2 - 0.2);
  const ix = inner + t / 2;
  const ox = w / 2 - t / 2;
  const z = d / 2 - t / 2;
  for (const s of [-1, 1]) {
    for (const sz of [-1, 1]) k.boxUp(t, h, t, s * ix, 0, sz * z, MAT.steelBlack);
    k.boxUp(t, h, t, s * ox, 0, -z, MAT.steelBlack);
    k.boxUp(t, h * 0.9, t, s * ox, 0, z * 0.35, MAT.steelBlack);
    k.boxUp(t, t, d, s * ix, 0, 0, MAT.steelBlack);
    k.boxUp(t, t, d, s * ox, 0, 0, MAT.steelBlack);
    k.box(t, t, d - 2 * t, s * ix, h - t / 2, 0, MAT.steelBlack);
    k.box(ox - ix, t, t, s * (ix + ox) / 2, h - t / 2, -z, MAT.steelBlack);
    // kabelkolom met katrolslede
    const cx = s * (ix + (ox - ix) * 0.5);
    k.cyl(0.014, h - 0.3, 'y', cx, h / 2, z * 0.35, MAT.chrome);
    k.box(0.1, 0.13, 0.1, cx, 1.05, z * 0.35, MAT.steelDark);
    k.cyl(0.035, 0.03, 'x', cx, 1.05, z * 0.35 + 0.07, MAT.plasticDark);
    k.boxUp(ox - ix - 0.05, 0.24, 0.1, cx, 0.3, -z + 0.16, MAT.steelDark); // gewichtsslede
    k.cyl(0.024, 0.2, 'z', s * ox, 0.75, -z + t / 2 + 0.1, MAT.chrome); // schijfhouder
    k.cyl(0.024, 0.2, 'z', s * ox, 1.15, -z + t / 2 + 0.1, MAT.chrome);
    // geleidestangen van de Smith machine
    k.cyl(0.0125, h - 0.3, 'y', s * (inner - 0.05), h / 2, 0.12, MAT.chrome);
  }
  k.boxUp(w, t, t, 0, 0, -z, MAT.steelBlack); // achterbalk: bepaalt de totale breedte
  k.box(2 * inner, t, t, 0, h - t / 2, -z, MAT.steelBlack);
  k.cyl(0.016, 2 * inner, 'x', 0, h - t / 2, z, MAT.chrome); // optrekstang
  k.cyl(0.0145, 2 * inner + 0.5, 'x', 0, 1.3, 0.12, MAT.chrome); // Smith-stang
  k.box(0.34, t * 0.55, 0.004, 0, h - t / 2, -z + t / 2 + 0.002, MAT.steelGrey);
};

// ───────────────────────────────── Banken ─────────────────────────────────

const adjustableBench: Builder = (k) => {
  const { w, d, h } = k;
  const padW = Math.min(0.29, w * 0.48);
  const padT = 0.065;
  const padY = h - padT / 2;
  const padLen = Math.min(1.32, d - 0.08);
  const backLen = padLen * 0.7;
  const seatLen = padLen - backLen - 0.02;
  const z0 = -padLen / 2;
  k.rounded(padW, padT, backLen, 0, padY, z0 + backLen / 2, MAT.pad);
  k.rounded(padW, padT, seatLen, 0, padY, z0 + backLen + 0.02 + seatLen / 2, MAT.pad);
  // onderstel
  k.boxUp(w, 0.05, 0.08, 0, 0, -d / 2 + 0.04, MAT.steelBlack); // achtervoet: volle breedte
  k.boxUp(w * 0.5, 0.05, 0.08, 0, 0, d / 2 - 0.16, MAT.steelBlack);
  k.box(0.075, 0.075, d - 0.24, 0, 0.11, -0.04, MAT.steelBlack);
  k.boxUp(0.075, h - padT - 0.05, 0.075, 0, 0.05, -d / 2 + 0.24, MAT.steelBlack);
  k.boxUp(0.075, h - padT - 0.05, 0.075, 0, 0.05, d / 2 - 0.34, MAT.steelBlack);
  k.beam([0, 0.14, -0.1], [0, h - padT - 0.02, -d / 2 + 0.5], 0.05, MAT.steelDark);
  k.box(padW * 0.8, 0.02, backLen * 0.9, 0, h - padT - 0.01, z0 + backLen / 2, MAT.steelDark);
  k.box(padW * 0.8, 0.02, seatLen * 0.9, 0, h - padT - 0.01, z0 + backLen + 0.02 + seatLen / 2, MAT.steelDark);
  // wielen en handgreep aan het voeteneinde
  for (const s of [-1, 1]) {
    k.cyl(0.035, 0.03, 'x', s * (w * 0.25 + 0.02), 0.035, d / 2 - 0.16, MAT.rubber);
    k.box(0.02, 0.02, 0.15, s * 0.08, 0.13, d / 2 - 0.075, MAT.steelBlack);
  }
  k.box(0.18, 0.025, 0.025, 0, 0.13, d / 2 - 0.0125, MAT.steelBlack);
  k.boxUp(0.03, 0.012, 0.085, -w / 2 + 0.015, 0, -d / 2 + 0.04, MAT.rubber);
  k.boxUp(0.03, 0.012, 0.085, w / 2 - 0.015, 0, -d / 2 + 0.04, MAT.rubber);
};

const utilityBench: Builder = (k) => {
  const { w, d, h } = k;
  const padW = Math.min(0.28, w * 0.5);
  const padT = 0.06;
  const padTop = Math.min(0.48, h - 0.12);
  const padY = padTop - padT / 2;
  const zPost = d / 2 - 0.42;
  k.rounded(padW, padT, 0.82, 0, padY, -d / 2 + 0.08 + 0.41, MAT.pad);
  k.rounded(padW, padT, 0.34, 0, padY, -d / 2 + 0.92 + 0.17, MAT.pad);
  k.boxUp(w, 0.04, 0.06, 0, 0, -d / 2 + 0.03, MAT.steelBlack); // achtervoet: volle breedte
  k.boxUp(w * 0.7, 0.04, 0.06, 0, 0, zPost - 0.05, MAT.steelBlack);
  k.box(0.05, 0.05, d - 0.5, 0, 0.1, -0.22, MAT.steelBlack);
  k.boxUp(0.05, padTop - padT - 0.04, 0.05, 0, 0.04, -d / 2 + 0.2, MAT.steelBlack);
  k.boxUp(0.05, padTop - padT - 0.04, 0.05, 0, 0.04, zPost - 0.05, MAT.steelBlack);
  k.beam([0, 0.12, -0.25], [0, padTop - padT - 0.02, -d / 2 + 0.55], 0.04, MAT.steelDark);
  // leg developer: bovenste rollen bepalen de hoogte, onderste de diepte
  k.boxUp(0.05, h - 0.1 - 0.04, 0.05, 0, 0.04, zPost, MAT.steelBlack);
  k.cyl(0.05, Math.min(0.5, w * 0.85), 'x', 0, h - 0.05, zPost, MAT.pad);
  k.beam([0, h - 0.14, zPost + 0.04], [0, 0.13, d / 2 - 0.07], 0.04, MAT.steelBlack);
  k.cyl(0.05, Math.min(0.5, w * 0.85), 'x', 0, 0.12, d / 2 - 0.05, MAT.pad);
  k.cyl(0.0125, 0.16, 'z', 0, 0.3, d / 2 - 0.2, MAT.chrome);
};

// ───────────────────────────── Stangen en gewichten ─────────────────────────────

const barbell: Builder = (k, p) => {
  const { w, h } = k;
  const r = h / 2;
  const sleeve = num(p, 'sleeveLength', 0.415);
  const shaft = num(p, 'shaftDiameter', 0.0285) / 2;
  k.cyl(shaft, w, 'x', 0, r, 0, MAT.steelDark);
  for (const s of [-1, 1]) {
    k.cyl(r, sleeve, 'x', s * (w / 2 - sleeve / 2), r, 0, MAT.chrome);
    k.cyl(r, 0.03, 'x', s * (w / 2 - sleeve - 0.015), r, 0, MAT.steelGrey);
  }
};

const plateStack: Builder = (k, p) => {
  const { w, h } = k;
  const plates = Array.isArray(p.plates) ? (p.plates as number[]) : [h];
  const r = w / 2;
  let y = 0;
  plates.forEach((thickness, i) => {
    k.cyl(r, thickness, 'y', 0, y + thickness / 2, 0, i % 2 ? MAT.rubberAlt : MAT.rubber, 'fine');
    y += thickness;
  });
  // stalen naaf en gat van de bovenste schijf
  k.cyl(0.046, 0.004, 'y', 0, h - 0.002, 0, MAT.chrome);
  k.cyl(0.0253, 0.0045, 'y', 0, h - 0.00225, 0, MAT.rubber);
};

function hexDumbbell(k: Kit, kg: number, x: number, yRest: number, z: number) {
  const R = 0.032 + 0.0016 * kg;
  const head = 0.035 + 0.0022 * kg;
  const grip = 0.128;
  const y = yRest + R;
  k.cyl(0.016, grip + 0.02, 'z', x, y, z, MAT.chrome);
  for (const s of [-1, 1]) k.cyl(R, head, 'z', x, y, z + s * (grip / 2 + head / 2), MAT.rubber, 'hex');
}

const dumbbellRack: Builder = (k, p) => {
  const { w, d, h } = k;
  const t = 0.05;
  const x = w / 2 - t / 2;
  const tiers = [
    { y: 0.17, z: 0.09, kg: [17.5, 17.5, 20, 20] },
    { y: 0.455, z: 0, kg: [10, 10, 12.5, 12.5, 15, 15] },
    { y: h - 0.115, z: -0.09, kg: [2.5, 2.5, 5, 5, 7.5, 7.5] },
  ];
  for (const s of [-1, 1]) {
    k.boxUp(t, t, d, s * x, 0, 0, MAT.steelBlack); // voet over de volle diepte
    k.boxUp(t, h, t, s * x, 0, -d / 2 + t / 2 + 0.08, MAT.steelBlack); // achterstaander tot volle hoogte
    k.boxUp(t, h * 0.5, t, s * x, 0, d / 2 - t / 2 - 0.1, MAT.steelBlack);
    for (const tier of tiers) k.box(t * 0.6, 0.045, 0.27, s * x, tier.y - 0.005, tier.z, MAT.steelBlack);
  }
  for (const tier of tiers) {
    // schuin legvlak: achterste rail hoger dan de voorste
    k.box(w - 2 * t, 0.03, 0.045, 0, tier.y + 0.012, tier.z - 0.085, MAT.steelDark);
    k.box(w - 2 * t, 0.03, 0.045, 0, tier.y - 0.022, tier.z + 0.085, MAT.steelDark);
    if (p.loaded === true) {
      const span = w - 2 * t - 0.16;
      tier.kg.forEach((kg, i) => {
        const px = -span / 2 + (span * i) / (tier.kg.length - 1);
        hexDumbbell(k, kg, px, tier.y + 0.012, tier.z);
      });
    }
  }
};

const storageRack: Builder = (k) => {
  const { w, d, h } = k;
  const t = 0.06;
  const x = w / 2 - t / 2;
  const shelf = w - 2 * t - 0.04;
  for (const s of [-1, 1]) {
    k.boxUp(t, t, d, s * x, 0.06, 0, MAT.steelBlack); // voet op wielen
    k.boxUp(t, h - 0.19, t, s * x, 0.12, 0, MAT.steelBlack);
    for (const sz of [-1, 1]) k.cyl(0.03, 0.026, 'x', s * x, 0.03, sz * (d / 2 - 0.06), MAT.rubber);
  }
  // twee vlakke lagen (kettlebells, medicine balls) met opstaande randen
  for (const y of [0.3, 0.68]) {
    k.box(shelf, 0.02, d - 0.1, 0, y, 0, MAT.steelDark);
    k.box(shelf, 0.05, 0.02, 0, y + 0.025, d / 2 - 0.06, MAT.steelDark);
    k.box(shelf, 0.05, 0.02, 0, y + 0.025, -d / 2 + 0.06, MAT.steelDark);
  }
  // schuine dumbbell-bovenlaag: de achterste rail is het hoogste punt
  k.box(shelf, 0.03, 0.06, 0, h - 0.015, -0.1, MAT.steelDark);
  k.box(shelf, 0.03, 0.06, 0, h - 0.07, 0.1, MAT.steelDark);
  for (const s of [-1, 1]) k.box(t * 0.6, 0.09, 0.3, s * x, h - 0.045, 0, MAT.steelBlack);
};

const dumbbellTower: Builder = (k) => {
  const { w, d, h } = k;
  for (const sz of [-1, 1]) k.boxUp(w, 0.04, 0.06, 0, 0, sz * (d / 2 - 0.03), MAT.steelBlack);
  k.boxUp(0.06, 0.04, d - 0.12, 0, 0, 0, MAT.steelBlack);
  k.boxUp(0.07, h - 0.07, 0.05, 0, 0.04, 0, MAT.steelBlack);
  k.box(0.2, 0.03, 0.03, 0, h - 0.015, 0, MAT.steelDark); // handgreep bovenop
  const levels = 10;
  for (let i = 0; i < levels; i++) {
    const y = 0.16 + i * ((h - 0.32) / (levels - 1));
    const span = (w - 0.06) * (1 - i * 0.022);
    for (const sz of [-1, 1]) k.box(span, 0.012, 0.022, 0, y, sz * 0.045, MAT.steelDark);
    for (const sx of [-1, 1]) k.box(0.012, 0.03, 0.11, sx * (span / 2 - 0.006), y + 0.012, 0, MAT.plasticDark);
  }
};

const adjustableDumbbell: Builder = (k) => {
  const { w, d, h } = k;
  const R = Math.min(d / 2 - 0.004, 0.1);
  const cy = h - R;
  k.boxUp(w, 0.035, d, 0, 0, 0, MAT.plasticDark); // houder: volle breedte en diepte
  k.cyl(0.017, 0.15, 'x', 0, cy, 0, MAT.rubber);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const r = i === 0 ? R : R - 0.004 - i * 0.004;
      k.cyl(r, 0.017, 'x', s * (0.085 + i * 0.021), cy, 0, i % 2 ? MAT.steelDark : MAT.rubberAlt);
    }
    k.cyl(0.05, 0.016, 'x', s * (w / 2 - 0.014), cy, 0, MAT.accentRed); // draaiknop
  }
};

const kettlebell: Builder = (k) => {
  const { w, d, h } = k;
  const body = d / 2;
  const hr = 0.016;
  k.sphere(Math.min(body, w / 2 - 0.004), body, body, 0, body, 0, MAT.steelBlack);
  k.cyl(body * 0.6, 0.012, 'y', 0, 0.006, 0, MAT.steelBlack); // vlakke bodem
  for (const s of [-1, 1]) {
    k.cyl(hr, h - hr - body * 1.35, 'y', s * (w / 2 - hr), (h - hr + body * 1.35) / 2, 0, MAT.steelBlack);
    k.sphere(hr, hr, hr, s * (w / 2 - hr), h - hr, 0, MAT.steelBlack);
    k.beam([s * (w / 2 - hr), body * 1.4, 0], [s * body * 0.45, body * 1.75, 0], hr * 1.8, MAT.steelBlack);
  }
  k.cyl(hr, w - 2 * hr, 'x', 0, h - hr, 0, MAT.steelBlack); // handgreep: bepaalt de hoogte
};

const plyoBox: Builder = (k) => {
  const { w, d, h } = k;
  const t = 0.018;
  k.box(w - 0.03, h - 0.03, d - 0.03, 0, h / 2, 0, MAT.rubber); // donker binnenwerk, zichtbaar door de grepen
  k.boxUp(w, t, d, 0, 0, 0, MAT.woodEdge);
  k.boxUp(w, t, d, 0, h - t, 0, MAT.wood);
  for (const s of [-1, 1]) k.boxUp(w, h - 2 * t, t, 0, t, s * (d / 2 - t / 2), MAT.wood);
  // zijpanelen met een uitgespaard handgat
  const slotH = 0.045;
  const slotW = 0.14;
  const slotY = h * 0.62;
  const panelD = d - 2 * t;
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - t / 2);
    k.boxUp(t, slotY - slotH / 2 - t, panelD, x, t, 0, MAT.woodEdge);
    k.boxUp(t, h - t - (slotY + slotH / 2), panelD, x, slotY + slotH / 2, 0, MAT.woodEdge);
    for (const sz of [-1, 1]) {
      k.box(t, slotH, (panelD - slotW) / 2, x, slotY, sz * (slotW / 2 + (panelD - slotW) / 4), MAT.woodEdge);
    }
  }
};

// ───────────────────────────── Krachtstations ─────────────────────────────

const functionalTrainer: Builder = (k) => {
  const { w, d, h } = k;
  const colW = Math.min(0.36, w * 0.25);
  const colD = d * 0.6;
  const cx = w / 2 - colW / 2;
  const cz = -d / 2 + colD / 2;
  const front = cz + colD / 2;
  for (const s of [-1, 1]) {
    k.boxUp(0.1, 0.06, d, s * (w / 2 - 0.05), 0, 0, MAT.steelBlack); // voet over de volle diepte
    k.boxUp(colW, h - 0.12, colD, s * cx, 0, cz, MAT.steelBlack); // kolom met gewichtsstapel
    k.boxUp(colW * 0.56, 0.95, 0.012, s * cx, 0.28, front + 0.006, MAT.steelGrey); // gewichtsstapel
    for (let i = 1; i < 10; i++) k.box(colW * 0.58, 0.006, 0.014, s * cx, 0.28 + i * 0.095, front + 0.007, MAT.steelBlack);
    k.box(0.03, 0.02, 0.03, s * cx, 0.62, front + 0.02, MAT.accentGreen); // selectiepen
    // verstelbare katrol met handgreep
    const rail = s * (cx - colW / 2 + 0.055);
    k.cyl(0.018, h - 0.5, 'y', rail, (h - 0.5) / 2 + 0.2, front + 0.07, MAT.chrome);
    k.box(0.1, 0.14, 0.1, rail, 1.5, front + 0.07, MAT.steelDark);
    k.cyl(0.04, 0.03, 'x', rail, 1.5, front + 0.14, MAT.plasticDark);
    k.cyl(0.003, 0.22, 'y', rail, 1.36, front + 0.15, MAT.steelGrey);
    k.cyl(0.015, 0.13, 'x', rail, 1.24, front + 0.15, MAT.rubber);
  }
  k.box(w, 0.12, colD * 0.55, 0, h - 0.06, cz, MAT.steelBlack); // bovenbalk: volle breedte en hoogte
  k.boxUp(w - 2 * colW, 0.08, 0.08, 0, 0.1, -d / 2 + 0.06, MAT.steelBlack);
  for (const s of [-1, 1]) k.cyl(0.016, 0.3, 'z', s * 0.28, h - 0.07, cz + colD * 0.275 + 0.14, MAT.rubber); // optrekgrepen
  k.box(0.3, 0.07, 0.004, 0, h - 0.06, cz + colD * 0.275 + 0.002, MAT.steelGrey);
};

/** Bank met leg developer, gedeeld door de krachtstations. Geeft de z van de zitting terug. */
function stationSeat(k: Kit, zSeat: number, zBack: number) {
  const { d } = k;
  k.rounded(0.34, 0.07, 0.4, 0, 0.5, zSeat, MAT.pad);
  k.rounded(0.3, 0.62, 0.07, 0, 0.95, zBack, MAT.pad);
  k.boxUp(0.06, 0.41, 0.06, 0, 0.06, zSeat - 0.05, MAT.steelBlack);
  // leg developer: de onderste rol is het voorste punt van het toestel
  const zLeg = zSeat + 0.27;
  k.boxUp(0.05, 0.44, 0.05, 0, 0.06, zLeg, MAT.steelBlack);
  k.cyl(0.045, 0.4, 'x', 0, 0.52, zLeg + 0.05, MAT.pad);
  k.beam([0, 0.45, zLeg + 0.03], [0, 0.15, d / 2 - 0.07], 0.04, MAT.steelBlack);
  k.cyl(0.045, 0.4, 'x', 0, 0.14, d / 2 - 0.045, MAT.pad);
}

const multiGym: Builder = (k) => {
  const { w, d, h } = k;
  const zMast = -d / 2 + 0.42;
  const zBoomEnd = zMast + 0.7;
  k.boxUp(0.08, 0.06, d, 0, 0, 0, MAT.steelBlack); // hoofdbalk over de volle diepte
  k.boxUp(Math.min(0.8, w * 0.75), 0.06, 0.08, 0, 0, -d / 2 + 0.04, MAT.steelBlack);
  k.boxUp(Math.min(0.6, w * 0.6), 0.06, 0.08, 0, 0, 0.15, MAT.steelBlack);
  // gewichtenkolom
  k.boxUp(0.34, 1.75, 0.22, 0, 0.06, -d / 2 + 0.15, MAT.steelDark);
  k.boxUp(0.26, 0.9, 0.012, 0, 0.2, -d / 2 + 0.266, MAT.steelGrey);
  for (let i = 1; i < 10; i++) k.box(0.27, 0.006, 0.014, 0, 0.2 + i * 0.09, -d / 2 + 0.267, MAT.steelBlack);
  k.box(0.03, 0.02, 0.03, 0, 0.56, -d / 2 + 0.28, MAT.accentGreen);
  // mast en giek met lat-stang
  k.boxUp(0.07, h - 0.06, 0.07, 0, 0.06, zMast, MAT.steelBlack);
  k.box(0.07, 0.07, zBoomEnd - zMast + 0.07, 0, h - 0.035, (zMast + zBoomEnd) / 2, MAT.steelBlack);
  k.cyl(0.05, 0.03, 'x', 0, h - 0.09, zBoomEnd, MAT.plasticDark);
  k.cyl(0.003, 0.34, 'y', 0, h - 0.29, zBoomEnd, MAT.steelGrey);
  k.cyl(0.014, Math.min(1.0, w - 0.1), 'x', 0, h - 0.46, zBoomEnd, MAT.chrome);
  // butterfly-armen: de armkussens bepalen de totale breedte
  const zPivot = zMast + 0.08;
  k.box(0.5, 0.05, 0.05, 0, 1.45, zPivot, MAT.steelBlack);
  for (const s of [-1, 1]) {
    const ax = w / 2 - 0.045;
    k.beam([s * 0.25, 1.45, zPivot], [s * (ax - 0.02), 1.02, zPivot + 0.34], 0.045, MAT.steelBlack);
    k.cyl(0.045, 0.34, 'y', s * ax, 0.86, zPivot + 0.36, MAT.pad);
  }
  stationSeat(k, zMast + 0.36, zMast + 0.12);
};

const leverageGym: Builder = (k) => {
  const { w, d, h } = k;
  const fx = Math.min(0.5, w / 2 - 0.25);
  const zTower = -d / 2 + 0.2;
  for (const s of [-1, 1]) {
    k.boxUp(0.06, 0.06, d, s * fx, 0, 0, MAT.steelBlack); // voetbalken over de volle diepte
    k.boxUp(0.06, h, 0.06, s * fx, 0, zTower, MAT.steelBlack); // toren tot volle hoogte
    // hefboomarm met schijfhouder naar buiten: bepaalt de totale breedte
    k.beam([s * fx, 1.5, zTower + 0.05], [s * fx, 1.08, zTower + 0.75], 0.05, MAT.steelBlack);
    k.cyl(0.016, 0.16, 'x', s * (fx - 0.1), 1.08, zTower + 0.75, MAT.rubber);
    const horn = w / 2 - fx;
    k.cyl(0.024, horn, 'x', s * (fx + horn / 2), 1.22, zTower + 0.5, MAT.chrome);
    k.beam([s * fx, 0.06, zTower + 0.5], [s * fx, 0.9, zTower + 0.06], 0.04, MAT.steelDark);
  }
  k.boxUp(2 * fx, 0.06, 0.06, 0, 0, -d / 2 + 0.03, MAT.steelBlack);
  k.boxUp(2 * fx, 0.06, 0.06, 0, 0, 0.3, MAT.steelBlack);
  k.box(2 * fx + 0.06, 0.06, 0.06, 0, h - 0.03, zTower, MAT.steelBlack);
  k.box(0.06, 0.06, 0.62, 0, h - 0.03, zTower + 0.31, MAT.steelBlack);
  k.cyl(0.05, 0.03, 'x', 0, h - 0.09, zTower + 0.6, MAT.plasticDark);
  k.cyl(0.003, 0.34, 'y', 0, h - 0.29, zTower + 0.6, MAT.steelGrey);
  k.cyl(0.014, Math.min(0.95, 2 * fx - 0.1), 'x', 0, h - 0.46, zTower + 0.6, MAT.chrome);
  k.boxUp(0.06, 0.06, d - 0.5, 0, 0, 0.1, MAT.steelBlack);
  stationSeat(k, zTower + 0.62, zTower + 0.36);
};

// ───────────────────────────────── Cardio ─────────────────────────────────

const rower: Builder = (k) => {
  const { w, d, h } = k;
  const zFly = -d / 2 + 0.38;
  const railStart = d / 2 - 1.45;
  k.boxUp(w, 0.04, 0.06, 0, 0, -d / 2 + 0.03, MAT.alu); // voorpoot: volle breedte
  for (const s of [-1, 1]) {
    k.beam([s * (w / 2 - 0.05), 0.04, -d / 2 + 0.05], [s * 0.09, 0.3, zFly], 0.04, MAT.alu);
    k.cyl(0.025, 0.02, 'x', s * (w / 2 - 0.03), 0.045, -d / 2 + 0.03, MAT.rubber);
  }
  // vliegwielhuis
  k.cyl(0.27, 0.15, 'x', 0, 0.33, zFly, MAT.plasticDark, 'fine');
  k.cyl(0.2, 0.156, 'x', 0, 0.33, zFly, MAT.plasticGrey, 'fine');
  k.cyl(0.05, 0.16, 'x', 0, 0.33, zFly, MAT.steelDark);
  // monorail met zitje
  k.box(0.07, 0.07, railStart - zFly + 0.1, 0, 0.27, (zFly + railStart) / 2, MAT.alu);
  k.box(0.09, 0.07, d / 2 - 0.06 - railStart, 0, 0.27, (railStart + d / 2 - 0.06) / 2, MAT.alu);
  k.box(0.05, 0.012, d / 2 - 0.1 - railStart, 0, 0.311, (railStart + d / 2 - 0.1) / 2, MAT.steelGrey);
  k.rounded(0.3, 0.05, 0.25, 0, 0.335, railStart + 0.55, MAT.pad, 0.02); // zithoogte 36 cm
  k.boxUp(0.05, 0.24, 0.05, 0, 0.03, d / 2 - 0.09, MAT.steelBlack);
  k.boxUp(0.3, 0.03, 0.08, 0, 0, d / 2 - 0.04, MAT.steelBlack); // achterpoot: voorste punt
  // voetsteunen, handgreep en monitor
  for (const s of [-1, 1]) {
    const f = k.box(0.12, 0.3, 0.02, s * 0.14, 0.34, zFly + 0.46, MAT.plasticDark);
    f.rotation.x = -Math.PI / 4;
  }
  k.cyl(0.016, 0.44, 'x', 0, 0.52, zFly + 0.33, MAT.rubber);
  k.beam([0, 0.55, zFly + 0.02], [0, h - 0.15, zFly + 0.24], 0.035, MAT.alu);
  k.box(0.16, 0.14, 0.04, 0, h - 0.07, zFly + 0.26, MAT.plasticDark); // monitor: hoogste punt
  k.box(0.12, 0.09, 0.004, 0, h - 0.07, zFly + 0.282, MAT.screen);
};

const bikeErg: Builder = (k) => {
  const { w, d, h } = k;
  const zFly = -d / 2 + 0.3;
  for (const s of [-1, 1]) k.boxUp(w, 0.04, 0.06, 0, 0, s * (d / 2 - 0.03), MAT.steelBlack); // poten: volle breedte en diepte
  k.box(0.06, 0.06, d - 0.1, 0, 0.07, 0, MAT.alu);
  k.cyl(0.24, 0.12, 'x', 0, 0.36, zFly, MAT.plasticDark, 'fine');
  k.cyl(0.17, 0.126, 'x', 0, 0.36, zFly, MAT.plasticGrey, 'fine');
  k.beam([0, 0.1, -0.05], [0, 0.36, zFly], 0.05, MAT.alu);
  // zadel
  k.beam([0, 0.1, 0.2], [0, 0.9, 0.36], 0.045, MAT.alu);
  k.rounded(0.16, 0.05, 0.26, 0, 0.95, 0.38, MAT.pad, 0.02);
  // stuur en monitor
  k.beam([0, 0.45, zFly + 0.14], [0, 1.06, zFly + 0.02], 0.045, MAT.alu);
  k.cyl(0.014, 0.44, 'x', 0, 1.08, zFly, MAT.rubber);
  for (const s of [-1, 1]) k.cyl(0.014, 0.12, 'z', s * 0.1, 1.08, zFly - 0.06, MAT.rubber);
  k.boxUp(0.03, h - 0.12 - 1.08, 0.03, 0, 1.08, zFly + 0.01, MAT.alu);
  k.box(0.14, 0.12, 0.03, 0, h - 0.06, zFly + 0.02, MAT.plasticDark); // monitor: hoogste punt
  k.box(0.11, 0.08, 0.004, 0, h - 0.06, zFly + 0.037, MAT.screen);
  // trapas en pedalen
  k.cyl(0.09, 0.03, 'x', 0, 0.36, 0.06, MAT.steelDark);
  k.box(0.02, 0.17, 0.03, 0.09, 0.44, 0.06, MAT.steelDark);
  k.box(0.02, 0.17, 0.03, -0.09, 0.28, 0.06, MAT.steelDark);
  k.box(0.09, 0.02, 0.07, 0.15, 0.52, 0.06, MAT.plasticDark);
  k.box(0.09, 0.02, 0.07, -0.15, 0.2, 0.06, MAT.plasticDark);
};

const skiErg: Builder = (k) => {
  const { w, d, h } = k;
  const zCol = -d / 2 + 0.08;
  k.boxUp(w, 0.03, d, 0, 0, 0, MAT.rubberGrey); // vloerplaat: volle breedte en diepte
  k.boxUp(w * 0.8, 0.004, d * 0.62, 0, 0.03, d * 0.14, MAT.rubber);
  k.boxUp(0.1, h - 0.03, 0.06, 0, 0.03, zCol, MAT.steelBlack); // kolom tot volle hoogte
  for (const s of [-1, 1]) {
    k.beam([s * 0.2, 0.03, zCol + 0.38], [s * 0.04, 0.92, zCol + 0.04], 0.03, MAT.steelBlack);
    k.cyl(0.003, 0.5, 'y', s * 0.2, h - 0.33, zCol + 0.2, MAT.steelGrey);
    k.cyl(0.016, 0.13, 'y', s * 0.2, h - 0.64, zCol + 0.2, MAT.rubber);
  }
  k.cyl(0.2, 0.14, 'x', 0, h - 0.34, zCol + 0.16, MAT.plasticDark, 'fine');
  k.cyl(0.14, 0.146, 'x', 0, h - 0.34, zCol + 0.16, MAT.plasticGrey, 'fine');
  k.box(0.5, 0.04, 0.05, 0, h - 0.06, zCol + 0.14, MAT.steelBlack);
  k.box(0.14, 0.12, 0.03, 0, 1.45, zCol + 0.06, MAT.plasticDark);
  k.box(0.11, 0.08, 0.004, 0, 1.45, zCol + 0.077, MAT.screen);
};

const airBike: Builder = (k) => {
  const { w, d, h } = k;
  const base = Math.min(1.13, d - 0.1); // voetafdruk op de vloer is korter dan de totale lengte
  const foot = Math.min(0.603, w);
  const zFan = -d / 2 + 0.37;
  const zRear = -d / 2 + base - 0.035;
  k.boxUp(foot, 0.05, 0.07, 0, 0, -d / 2 + 0.035, MAT.steelBlack); // voorpoot: achterste punt
  k.boxUp(foot, 0.05, 0.07, 0, 0, zRear, MAT.steelBlack);
  k.box(0.07, 0.07, base - 0.07, 0, 0.085, -d / 2 + base / 2, MAT.steelBlack);
  // ventilatorkooi
  k.cyl(0.33, 0.12, 'x', 0, 0.42, zFan, MAT.steelBlack, 'fine');
  k.cyl(0.29, 0.126, 'x', 0, 0.42, zFan, MAT.steelGrey, 'fine');
  k.cyl(0.06, 0.13, 'x', 0, 0.42, zFan, MAT.steelDark);
  k.cyl(0.015, Math.min(0.4, foot), 'x', 0, 0.44, zFan - 0.2, MAT.steelDark); // voetsteunen
  // zadel in de achterste stand: voorste punt van het toestel
  k.beam([0, 0.12, zRear - 0.25], [0, 0.84, d / 2 - 0.34], 0.06, MAT.steelBlack);
  k.box(0.05, 0.04, 0.34, 0, 0.87, d / 2 - 0.3, MAT.steelDark);
  k.rounded(0.26, 0.07, 0.3, 0, 0.925, d / 2 - 0.15, MAT.pad, 0.025);
  // bewegende armen: de handgrepen zijn het breedste en hoogste punt
  const gx = w / 2 - 0.019;
  for (const s of [-1, 1]) {
    k.beam([s * 0.14, 0.45, zFan + 0.26], [s * (gx - 0.03), h - 0.12, zFan + 0.36], 0.04, MAT.steelBlack);
    k.cyl(0.019, 0.14, 'z', s * gx, h - 0.019, zFan + 0.4, MAT.rubber);
    k.box(0.1, 0.02, 0.07, s * 0.2, s > 0 ? 0.3 : 0.5, zFan + 0.42, MAT.plasticDark); // pedalen
  }
  k.cyl(0.09, 0.03, 'x', 0, 0.4, zFan + 0.42, MAT.steelDark);
  k.beam([0, 0.72, zFan + 0.12], [0, 1.14, zFan + 0.2], 0.04, MAT.steelBlack);
  k.box(0.2, 0.12, 0.03, 0, 1.2, zFan + 0.2, MAT.plasticDark);
  k.box(0.16, 0.08, 0.004, 0, 1.2, zFan + 0.217, MAT.screen);
};

const treadmill: Builder = (k) => {
  const { w, d, h } = k;
  const zHood = -d / 2 + 0.21;
  const deckLen = d - 0.3;
  for (const s of [-1, 1]) {
    k.boxUp(0.07, 0.16, deckLen, s * (w / 2 - 0.035), 0, 0.15, MAT.plasticGrey); // zijprofielen: volle breedte
    k.boxUp(0.06, h - 0.26, 0.08, s * (w / 2 - 0.05), 0.1, -d / 2 + 0.36, MAT.steelBlack);
    k.box(0.05, 0.05, 0.5, s * (w / 2 - 0.05), h - 0.3, -d / 2 + 0.66, MAT.rubber); // handrails
  }
  k.boxUp(w - 0.14, 0.13, deckLen - 0.02, 0, 0.01, 0.15, MAT.belt); // loopvlak
  k.boxUp(w - 0.02, 0.2, 0.42, 0, 0, zHood, MAT.plasticDark); // motorkap: achterste punt
  k.box(w * 0.5, 0.01, 0.2, 0, 0.2, zHood, MAT.plasticGrey);
  k.box(w - 0.04, 0.16, 0.3, 0, h - 0.08, -d / 2 + 0.32, MAT.plasticDark); // console: hoogste punt
  k.box(w * 0.5, 0.11, 0.004, 0, h - 0.07, -d / 2 + 0.472, MAT.screen);
  k.cyl(0.02, w - 0.2, 'x', 0, h - 0.3, -d / 2 + 0.5, MAT.rubber);
};

const crosstrainer: Builder = (k) => {
  const { w, d, h } = k;
  const zFly = -d / 2 + 0.34;
  k.boxUp(w, 0.05, 0.07, 0, 0, -d / 2 + 0.035, MAT.steelBlack); // voorpoot: volle breedte
  k.boxUp(w * 0.85, 0.05, 0.07, 0, 0, d / 2 - 0.035, MAT.steelBlack); // achterpoot: voorste punt
  k.box(0.07, 0.07, d - 0.1, 0, 0.085, 0, MAT.steelBlack);
  k.cyl(0.26, 0.14, 'x', 0, 0.36, zFly, MAT.plasticLight, 'fine');
  k.cyl(0.19, 0.146, 'x', 0, 0.36, zFly, MAT.plasticGrey, 'fine');
  k.beam([0, 0.5, zFly - 0.02], [0, 1.36, zFly + 0.1], 0.06, MAT.steelBlack);
  k.box(0.22, 0.16, 0.05, 0, 1.45, zFly + 0.11, MAT.plasticDark);
  k.box(0.17, 0.1, 0.004, 0, 1.46, zFly + 0.137, MAT.screen);
  k.cyl(0.014, 0.38, 'x', 0, 1.2, zFly + 0.12, MAT.rubber);
  for (const s of [-1, 1]) {
    const gx = Math.min(0.24, w / 2 - 0.03);
    k.beam([s * 0.2, 0.55, zFly + 0.14], [s * gx, h - 0.2, zFly + 0.2], 0.035, MAT.steelGrey);
    k.cyl(0.02, 0.2, 'y', s * gx, h - 0.1, zFly + 0.2, MAT.rubber); // handgrepen: hoogste punt
    k.beam([s * 0.14, 0.3, zFly + 0.1], [s * 0.14, 0.2, d / 2 - 0.26], 0.04, MAT.steelGrey);
    k.box(0.14, 0.03, 0.36, s * 0.14, 0.27, 0.16, MAT.plasticDark);
  }
};

/** Vangnet voor producten zonder eigen model: een neutraal blok op ware grootte. */
const plainBox: Builder = (k) => {
  const { w, d, h } = k;
  k.boxUp(w, h, d, 0, 0, 0, MAT.neutral);
};

export const BUILDERS: Record<ModelKind, Builder> = {
  powerRack,
  halfRack,
  allInOne,
  adjustableBench,
  utilityBench,
  barbell,
  plateStack,
  dumbbellRack,
  storageRack,
  dumbbellTower,
  adjustableDumbbell,
  kettlebell,
  plyoBox,
  functionalTrainer,
  multiGym,
  leverageGym,
  rower,
  bikeErg,
  skiErg,
  airBike,
  treadmill,
  crosstrainer,
  box: plainBox,
};
