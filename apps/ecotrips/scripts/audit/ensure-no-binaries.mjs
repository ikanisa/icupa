#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const bannedExtensions = new Map([
  [".png", "PNG images are not allowed; prefer SVG"],
  [".jpg", "JPEG images are not allowed; prefer SVG"],
  [".jpeg", "JPEG images are not allowed; prefer SVG"],
  [".gif", "GIF assets are not supported"],
  [".ico", "ICO favicons must be replaced with SVG"],
  [".webp", "WEBP assets are not supported"],
  [".avif", "AVIF assets are not supported"],
  [".bmp", "Bitmap images are not supported"],
  [".tif", "TIFF images are not supported"],
  [".tiff", "TIFF images are not supported"],
  [".zip", "Zip archives are not allowed"],
  [".gz", "Compressed archives are not allowed"],
  [".bz2", "Compressed archives are not allowed"],
  [".xz", "Compressed archives are not allowed"],
  [".tar", "Tar archives are not allowed"],
  [".7z", "7zip archives are not allowed"],
  [".pdf", "PDF documents are not allowed"],
  [".mp3", "Audio files are not supported"],
  [".mp4", "Video files are not supported"],
  [".mov", "Video files are not supported"],
  [".avi", "Video files are not supported"],
  [".wav", "Audio files are not supported"],
  [".flac", "Audio files are not supported"],
  [".wasm", "WASM binaries are not allowed"],
  [".ttf", "Font binaries are not supported"],
  [".otf", "Font binaries are not supported"],
  [".woff", "Font binaries are not supported"],
  [".woff2", "Font binaries are not supported"],
  [".exe", "Executable binaries are not allowed"],
  [".dll", "Executable binaries are not allowed"],
  [".bin", "Binary blobs are not allowed"],
]);

function getTrackedFiles() {
  const output = execSync("git ls-files", { encoding: "utf8" }).trim();
  return output === "" ? [] : output.split("\n");
}

function inspectFile(path) {
  const extension = extname(path).toLowerCase();
  if (bannedExtensions.has(extension)) {
    return {
      path,
      reason: bannedExtensions.get(extension),
    };
  }

  const buffer = readFileSync(path);

  if (buffer.includes(0)) {
    return {
      path,
      reason: "File contains null bytes and is likely binary.",
    };
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    return {
      path,
      reason: `File is not valid UTF-8 text: ${error.message}`,
    };
  }

  return null;
}

function main() {
  const trackedFiles = getTrackedFiles();
  const offenders = [];

  for (const file of trackedFiles) {
    const issue = inspectFile(file);
    if (issue) {
      offenders.push(issue);
    }
  }

  if (offenders.length > 0) {
    console.error("\n⛔ Binary or unsupported files detected:\n");
    for (const offender of offenders) {
      console.error(` - ${offender.path}: ${offender.reason}`);
    }
    console.error("\nPlease replace these assets with supported text-based alternatives (preferably SVG or JSON).\n");
    process.exitCode = 1;
    return;
  }

  console.log("✅ No binary files detected in tracked sources.");
}

main();
