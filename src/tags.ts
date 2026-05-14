const TAG_SEPARATOR = '|';
const TAG_PREFIX = '#';
const TAG_PATTERN = /#([a-zA-Z0-9_-]+)/g;

export type ParsedNote = {
  tags: string[];
  note: string;
};

export function parseTags(raw: string | undefined): ParsedNote {
  if (!raw) return { tags: [], note: '' };

  const separatorIdx = raw.indexOf(TAG_SEPARATOR);

  if (separatorIdx === -1) {
    const tags = extractTags(raw);
    if (tags.length > 0) {
      return { tags, note: '' };
    }
    return { tags: [], note: raw };
  }

  const tagPart = raw.slice(0, separatorIdx).trim();
  const notePart = raw.slice(separatorIdx + 1).trim();

  return {
    tags: extractTags(tagPart),
    note: notePart,
  };
}

function extractTags(text: string): string[] {
  const matches = text.matchAll(TAG_PATTERN);
  return Array.from(matches, (m) => m[1].toLowerCase());
}

export function serializeTags(tags: string[], note: string): string {
  const cleanTags = tags
    .map((t) => t.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    .filter(Boolean);

  if (cleanTags.length === 0) return note;

  const tagStr = cleanTags.map((t) => `${TAG_PREFIX}${t}`).join(' ');
  if (!note) return tagStr;
  return `${tagStr} ${TAG_SEPARATOR} ${note}`;
}

export function getAllTags(notes: (string | undefined)[]): string[] {
  const tagSet = new Set<string>();
  for (const note of notes) {
    const { tags } = parseTags(note);
    for (const tag of tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
