#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { init as licenseCheckerInit } from 'license-checker-rseidelsohn';
import parseSpdx from 'spdx-expression-parse';

const args = process.argv.slice(2);
// When --verbose is passed we emit the full dependency/license table for CI logs.
const verbose = args.includes('--verbose');

const allowedLicenses = new Set([
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'ISC',
  'MIT',
  'MIT*',
  'MPL-2.0',
  'MPL-2.0-no-copyleft-exception',
  'BlueOak-1.0.0',
  '0BSD',
  'Python-2.0',
  'Unlicense',
  'WTFPL',
  'Zlib',
]);

// Wrap the callback API so we can await license-checker results.
const initAsync = promisify(licenseCheckerInit);

function isAllowedLicenseId(licenseId, hasPlus = false) {
  if (!licenseId) {
    return false;
  }

  if (allowedLicenses.has(licenseId)) {
    return true;
  }

  if (hasPlus) {
    return allowedLicenses.has(licenseId);
  }

  return false;
}

function evaluateLicenseAst(ast) {
  if (ast.license) {
    return isAllowedLicenseId(ast.license, ast.plus);
  }

  if (ast.left && ast.right && ast.conjunction) {
    if (ast.conjunction === 'or') {
      return evaluateLicenseAst(ast.left) || evaluateLicenseAst(ast.right);
    }

    if (ast.conjunction === 'and') {
      return evaluateLicenseAst(ast.left) && evaluateLicenseAst(ast.right);
    }
  }

  return false;
}

function expressionIsPermissive(expression) {
  if (!expression || typeof expression !== 'string') {
    return false;
  }

  const normalized = expression.trim();

  if (!normalized) {
    return false;
  }

  if (normalized.toUpperCase() === 'UNLICENSED') {
    return false;
  }

  if (normalized.startsWith('SEE LICENSE IN')) {
    return false;
  }

  if (allowedLicenses.has(normalized)) {
    return true;
  }

  try {
    // Parse SPDX expressions like "MIT OR Apache-2.0" and validate via the AST.
    const ast = parseSpdx(normalized);
    return evaluateLicenseAst(ast);
  } catch (error) {
    return false;
  }
}

function licenseValueIsPermissive(value) {
  if (Array.isArray(value)) {
    // license-checker may return multiple licenses; every one must be acceptable.
    return value.every((entry) => expressionIsPermissive(entry));
  }

  if (typeof value === 'string') {
    return expressionIsPermissive(value);
  }

  return false;
}

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

async function main() {
  const start = path.resolve(process.cwd());

  // Build the dependency graph (direct + transitive) with license metadata.
  const results = await initAsync({
    start,
    json: true,
  });

  const failures = [];

  const tableRows = [];

  for (const [dependency, info] of Object.entries(results)) {
    const licenses = licenseValueToString(info.licenses);

    tableRows.push({
      dependency,
      license: licenses,
    });

    if (!licenseValueIsPermissive(info.licenses)) {
      failures.push({
        dependency,
        licenses,
        repository: info.repository,
      });
    }
  }

  if (verbose) {
    // Sort for consistent CI output.
    tableRows.sort((a, b) => a.dependency.localeCompare(b.dependency));
    console.log('Dependency license inventory (including transitives):');
    console.table(tableRows);
  }

  if (failures.length > 0) {
    console.error('Found dependencies that are not covered by the approved permissive licenses:\n');
    failures.forEach((failure) => {
      console.error(`- ${failure.dependency}`);
      console.error(`  license: ${failure.licenses || 'UNKNOWN'}`);
      if (failure.repository) {
        console.error(`  repo: ${failure.repository}`);
      }
      console.error('');
    });
    console.error('Update the whitelist in utils/checkLicenses.mjs if additional permissive licenses should be allowed.');
    process.exitCode = 1;
    return;
  }

  console.log('All dependencies use permissive licenses that allow for commercial use.');
}

main().catch((error) => {
  console.error('License check failed to complete:', error);
  process.exitCode = 1;
});
