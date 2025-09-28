#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { init as licenseCheckerInit } from 'license-checker-rseidelsohn';

// license-checker exposes a callback interface; wrap it so we can use async/await.
const initAsync = promisify(licenseCheckerInit);

function licenseValueToString(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return 'UNKNOWN';
  }

  return String(value);
}

function packageNameFromIdentifier(identifier) {
  if (!identifier) {
    return identifier;
  }

  const atIndex = identifier.lastIndexOf('@');
  if (atIndex <= 0) {
    return identifier;
  }

  return identifier.slice(0, atIndex);
}

function markdownLink(identifier, repository) {
  const packageName = packageNameFromIdentifier(identifier);

  if (repository && typeof repository === 'string') {
    // Handle git+ URLs so the rendered link is browser-friendly.
    const cleanedRepository = repository.startsWith('git+')
      ? repository.slice(4)
      : repository;
    return `[${identifier}](${cleanedRepository})`;
  }

  if (packageName) {
    // Fall back to the npm package page when we have no explicit repository URL.
    const npmUrl = `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
    return `[${identifier}](${npmUrl})`;
  }

  return identifier;
}

async function main() {
  const start = path.resolve(process.cwd());

  // Collect package names that are marked optional in package-lock.json to keep
  // platform-specific binaries out of the final attribution list.
  const optionalPackages = (() => {
    try {
      const lockPath = path.join(start, 'package-lock.json');
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const packages = lock.packages || {};
      const names = new Set();

      Object.entries(packages).forEach(([pkgPath, pkgInfo]) => {
        if (!pkgInfo || !pkgInfo.optional) {
          return;
        }

        const segments = pkgPath.split('node_modules/');
        const inferredName = pkgInfo.name || segments[segments.length - 1];

        if (inferredName) {
          names.add(inferredName);
        }
      });

      return names;
    } catch (error) {
      return new Set();
    }
  })();

  // Collect the dependency graph (direct + transitive) with their license metadata.
  const results = await initAsync({
    start,
    json: true,
  });

  const rows = Object.entries(results)
    .map(([dependency, info]) => ({
      dependency,
      license: licenseValueToString(info.licenses),
      repository: info.repository,
      optional: optionalPackages.has(packageNameFromIdentifier(dependency)),
    }))
    .filter((row) => !row.optional)
    .sort((a, b) => a.dependency.localeCompare(b.dependency));

  // Markdown header for the generated table.
  const lines = ['| Package | License |', '| --- | --- |'];

  rows.forEach((row) => {
    const link = markdownLink(row.dependency, row.repository);
    const license = row.license || 'UNKNOWN';
    lines.push(`| ${link} | ${license} |`);
  });

  console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error('Failed to generate license markdown table:', error);
  process.exitCode = 1;
});
