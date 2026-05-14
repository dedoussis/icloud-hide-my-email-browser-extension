import { browser } from 'wxt/browser';
import { HmeEmail } from './iCloudClient';
import { parseTags } from './tags';

type ExportRow = {
  email: string;
  label: string;
  note: string;
  tags: string;
  forwardTo: string;
  active: boolean;
  origin: string;
  created: string;
};

function toExportRow(hme: HmeEmail): ExportRow {
  const { tags, note } = parseTags(hme.note);
  return {
    email: hme.hme,
    label: hme.label,
    note,
    tags: tags.join(', '),
    forwardTo: hme.forwardToEmail,
    active: hme.isActive,
    origin: hme.origin,
    created: new Date(hme.createTimestamp).toISOString(),
  };
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(hmeEmails: HmeEmail[]): string {
  const headers = [
    'email',
    'label',
    'note',
    'tags',
    'forwardTo',
    'active',
    'origin',
    'created',
  ];
  const rows = hmeEmails.map(toExportRow);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => escapeCsvField(String(row[h as keyof ExportRow])))
        .join(',')
    ),
  ];

  return csvLines.join('\n');
}

export function exportToJson(hmeEmails: HmeEmail[]): string {
  return JSON.stringify(hmeEmails.map(toExportRow), null, 2);
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  if (browser.downloads?.download) {
    browser.downloads.download({ url, filename, saveAs: true }).then(() => {
      URL.revokeObjectURL(url);
    });
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
