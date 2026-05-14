import { gunzipSync, gzipSync } from "zlib";

export type BackupArchiveEntry = {
  path: string;
  data: Buffer;
  mtime?: Date;
};

const blockSize = 512;

function normalizeArchivePath(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);

  if (!parts.length || parts.some((part) => part === "." || part === "..") || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Unsafe backup archive path: ${value}`);
  }

  return parts.join("/");
}

function splitTarPath(name: string) {
  if (Buffer.byteLength(name) <= 100) {
    return { name, prefix: "" };
  }

  const segments = name.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    const prefix = segments.slice(0, index).join("/");
    const rest = segments.slice(index).join("/");
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(rest) <= 100) {
      return { name: rest, prefix };
    }
  }

  throw new Error(`Backup archive path is too long: ${name}`);
}

function writeString(header: Buffer, offset: number, length: number, value: string) {
  header.fill(0, offset, offset + length);
  header.write(value, offset, Math.min(length, Buffer.byteLength(value)), "utf8");
}

function writeOctal(header: Buffer, offset: number, length: number, value: number) {
  const octal = Math.trunc(value).toString(8).padStart(length - 1, "0");
  header.write(octal.slice(-(length - 1)), offset, length - 1, "ascii");
  header[offset + length - 1] = 0;
}

function readString(header: Buffer, offset: number, length: number) {
  const slice = header.subarray(offset, offset + length);
  const zero = slice.indexOf(0);
  return slice.subarray(0, zero === -1 ? slice.length : zero).toString("utf8");
}

function readOctal(header: Buffer, offset: number, length: number) {
  const raw = readString(header, offset, length).trim();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function createHeader(entry: BackupArchiveEntry) {
  const safePath = normalizeArchivePath(entry.path);
  const { name, prefix } = splitTarPath(safePath);
  const header = Buffer.alloc(blockSize, 0);
  const mtime = Math.floor((entry.mtime?.getTime() ?? Date.now()) / 1000);

  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, entry.data.length);
  writeOctal(header, 136, 12, mtime);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, 257, 6, "ustar");
  writeString(header, 263, 2, "00");
  writeString(header, 265, 32, "liax_space");
  writeString(header, 297, 32, "liax_space");
  writeString(header, 345, 155, prefix);

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }

  const checksumOctal = checksum.toString(8).padStart(6, "0");
  header.write(checksumOctal.slice(-6), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

function pad(data: Buffer) {
  const remainder = data.length % blockSize;
  return remainder ? Buffer.alloc(blockSize - remainder, 0) : Buffer.alloc(0);
}

export function createTarGzArchive(entries: BackupArchiveEntry[]) {
  const chunks: Buffer[] = [];

  for (const entry of entries) {
    chunks.push(createHeader(entry), entry.data, pad(entry.data));
  }

  chunks.push(Buffer.alloc(blockSize * 2, 0));
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

export function parseTarGzArchive(bytes: Buffer): BackupArchiveEntry[] {
  const tar = gunzipSync(bytes);
  const entries: BackupArchiveEntry[] = [];
  let offset = 0;

  while (offset + blockSize <= tar.length) {
    const header = tar.subarray(offset, offset + blockSize);
    offset += blockSize;

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const path = normalizeArchivePath(prefix ? `${prefix}/${name}` : name);
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || "0".charCodeAt(0));
    const data = tar.subarray(offset, offset + size);
    offset += size + (size % blockSize ? blockSize - (size % blockSize) : 0);

    if (type === "0" || type === "\0") {
      entries.push({ path, data: Buffer.from(data) });
    }
  }

  return entries;
}
