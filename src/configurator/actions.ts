import { LAYOUT_PROFILES, layoutProductsFor, resolveProduct, snapshotOf } from '../catalog';
import { BRAND } from '../config/brand';
import { generateLayout, type LayoutResult } from '../domain/layout/autoLayout';
import { ImportError, exportDesign, exportFileName, importDesign } from '../domain/storage/serialize';
import { meters } from '../lib/format';
import { sceneApi } from '../scene/bridge';
import { useDesignStore } from '../state/designStore';
import { toast, useUiStore } from '../state/uiStore';

/** Acties van de configurator die meerdere lagen raken (opslag, scène, meldingen). */

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportJson() {
  const { design } = useDesignStore.getState();
  const file = exportDesign(design, snapshotOf, BRAND.generator);
  download(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), exportFileName(design, 'json'));
  toast('success', 'Ontwerp geëxporteerd', 'Het JSON-bestand bevat alle maten, posities en rotaties.');
}

export async function importJsonFile(file: File) {
  try {
    if (file.size > 5_000_000) throw new ImportError('Dit bestand is te groot voor een ontwerp.');
    const raw: unknown = JSON.parse(await file.text());
    const { design, warnings } = importDesign(raw, { resolveProduct });
    useDesignStore.getState().loadDesign(design);
    useUiStore.getState().sendCamera('standaard');
    if (warnings.length) toast('warning', `"${design.name}" geopend met ${warnings.length} opmerking${warnings.length > 1 ? 'en' : ''}`, warnings.slice(0, 2).join(' '));
    else toast('success', `"${design.name}" geopend`, `${design.items.length} apparaten geladen.`);
  } catch (error) {
    const message =
      error instanceof ImportError ? error.message : error instanceof SyntaxError ? 'Het bestand is geen geldige JSON.' : 'Het bestand kon niet worden gelezen.';
    toast('error', 'Importeren mislukt', message);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('afbeelding laden mislukt'));
    img.src = src;
  });
}

/** Zet het beeld op een nette achtergrond met een bijschrift en biedt het aan als PNG. */
async function composeAndDownload(source: HTMLImageElement, width: number, height: number) {
  const { design } = useDesignStore.getState();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('geen 2D-context');

  const gradient = ctx.createRadialGradient(width / 2, height * 0.12, 0, width / 2, height * 0.5, Math.max(width, height) * 0.8);
  gradient.addColorStop(0, '#fbfaf8');
  gradient.addColorStop(0.5, '#ecebe6');
  gradient.addColorStop(1, '#d7d4cc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  const scale = Math.max(1, width / 1400);
  const pad = 22 * scale;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0e1113';
  ctx.font = `700 ${Math.round(20 * scale)}px Inter, system-ui, sans-serif`;
  ctx.fillText(design.name, pad, height - pad - 22 * scale);
  ctx.fillStyle = '#4b535b';
  ctx.font = `500 ${Math.round(13 * scale)}px Inter, system-ui, sans-serif`;
  const { room } = design;
  ctx.fillText(
    `${meters(room.width)} × ${meters(room.length)} × ${meters(room.height)}  ·  ${design.items.length} apparaten  ·  ${BRAND.name}`,
    pad,
    height - pad,
  );

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG maken mislukt');
  download(blob, exportFileName(design, 'png'));
}

export async function exportImage() {
  try {
    if (useUiStore.getState().viewMode === '2d') {
      const svg = document.getElementById('plattegrond') as SVGSVGElement | null;
      if (!svg) throw new Error('geen plattegrond');
      const rect = svg.getBoundingClientRect();
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', String(rect.width));
      clone.setAttribute('height', String(rect.height));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        await composeAndDownload(await loadImage(url), Math.round(rect.width * 2), Math.round(rect.height * 2));
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      const data = sceneApi.current?.capture();
      if (!data) throw new Error('geen 3D-beeld');
      const img = await loadImage(data);
      await composeAndDownload(img, img.naturalWidth, img.naturalHeight);
    }
    toast('success', 'Afbeelding opgeslagen', 'Je ontwerp is als PNG gedownload.');
  } catch {
    toast('error', 'Afbeelding maken mislukt', 'Probeer het opnieuw vanuit de 3D-weergave.');
  }
}

let layoutSeed = Math.floor(Math.random() * 100000);

/** Genereert een voorbeeldindeling en vervangt de huidige apparaten (ongedaan te maken). */
export function generateLayoutAction(profileId: string): LayoutResult {
  layoutSeed += 1;
  const { design } = useDesignStore.getState();
  const result = generateLayout({
    room: design.room,
    openings: design.openings,
    obstacles: design.obstacles,
    products: layoutProductsFor(profileId),
    seed: layoutSeed,
    attempts: 8,
  });
  useDesignStore.getState().applyGeneratedLayout(result.items);
  const profile = LAYOUT_PROFILES.find((p) => p.id === profileId);
  if (!result.items.length) {
    toast('warning', 'Geen indeling gevonden', 'Voor deze ruimte paste geen van de voorgestelde apparaten. Probeer een ander profiel of pas de ruimte aan.');
  } else if (result.skipped.length) {
    toast(
      'info',
      `Indeling "${profile?.label}" geplaatst`,
      `${result.items.length} apparaten geplaatst; ${result.skipped.length} paste${result.skipped.length > 1 ? 'n' : ''} niet (${result.skipped
        .slice(0, 2)
        .map((s) => s.label)
        .join(', ')}${result.skipped.length > 2 ? '…' : ''}).`,
    );
  } else {
    toast('success', `Indeling "${profile?.label}" geplaatst`, `${result.items.length} apparaten geplaatst. Pas alles naar wens aan.`);
  }
  return result;
}

export function startNewDesign() {
  useDesignStore.getState().newDesign();
  useUiStore.getState().sendCamera('standaard');
  toast('info', 'Nieuw ontwerp gestart', 'Je vorige ontwerp haal je terug met Ongedaan maken.');
}
