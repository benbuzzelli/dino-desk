import type { DinoSpecies } from './draw';
import { profileKey } from './profile';

export interface DinoRecord {
  species: DinoSpecies;
  version: number;
  encounters: number;
  firstSeen: number;
  foundIn?: string;
}

function loadRaw(): DinoRecord[] {
  try {
    const raw = localStorage.getItem(profileKey('collection'));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function save(records: DinoRecord[]) {
  try {
    localStorage.setItem(profileKey('collection'), JSON.stringify(records));
  } catch {}
}

export function trackDinoEncounter(species: DinoSpecies, version = 0, game?: string) {
  const records = loadRaw();
  const existing = records.find((r) => r.species === species && r.version === version);
  if (existing) {
    existing.encounters++;
  } else {
    records.push({
      species,
      version,
      encounters: 1,
      firstSeen: Date.now(),
      foundIn: game,
    });
  }
  save(records);
}

export function getCollection(): DinoRecord[] {
  return loadRaw().sort((a, b) => a.firstSeen - b.firstSeen);
}

export function getCollectionCount(): number {
  return loadRaw().length;
}

const ALL_SPECIES: DinoSpecies[] = ['rex', 'stego', 'bronto', 'raptor', 'ankylo', 'para', 'spino', 'ptera', 'tric'];
const V1_SPECIES: DinoSpecies[] = ['rex', 'stego', 'bronto', 'raptor', 'ankylo', 'para', 'spino', 'ptera'];

export interface CollectionSlot {
  species: DinoSpecies;
  version: number;
  label: string;
  record: DinoRecord | null;
}

export function getAllSlots(): CollectionSlot[] {
  const records = loadRaw();
  const slots: CollectionSlot[] = [];

  const LABELS: Record<DinoSpecies, string> = {
    rex: 'T-Rex',
    stego: 'Stegosaurus',
    bronto: 'Brontosaurus',
    raptor: 'Raptor',
    ankylo: 'Ankylosaurus',
    para: 'Parasaurolophus',
    spino: 'Spinosaurus',
    ptera: 'Pteranodon',
    tric: 'Triceratops',
  };

  const V1_LABELS: Partial<Record<DinoSpecies, string>> = {
    rex: 'Tiny Rex',
    stego: 'Brave Stego',
    bronto: 'Big Bronto',
    raptor: 'Wild Raptor',
    ankylo: 'Cool Ankylo',
    para: 'Happy Para',
    spino: 'Fast Spino',
    ptera: 'Lucky Ptera',
  };

  for (const sp of ALL_SPECIES) {
    slots.push({
      species: sp,
      version: 0,
      label: LABELS[sp],
      record: records.find((r) => r.species === sp && r.version === 0) ?? null,
    });
  }

  for (const sp of V1_SPECIES) {
    slots.push({
      species: sp,
      version: 1,
      label: V1_LABELS[sp] ?? sp,
      record: records.find((r) => r.species === sp && r.version === 1) ?? null,
    });
  }

  return slots;
}
