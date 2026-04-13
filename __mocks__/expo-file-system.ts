/** Mock for expo-file-system (new API with File, Directory, Paths). */

const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();

export class File {
  uri: string;
  name: string;

  constructor(...args: unknown[]) {
    if (args.length === 1 && typeof args[0] === "string") {
      this.uri = args[0];
    } else if (args.length === 2) {
      const parent = args[0] as Directory;
      const name = args[1] as string;
      this.uri = `${parent.uri}/${name}`;
    } else {
      this.uri = "file:///mock/file";
    }
    this.name = this.uri.split("/").pop() ?? "";
  }

  get exists(): boolean {
    return mockFiles.has(this.uri);
  }

  get size(): number {
    const content = mockFiles.get(this.uri);
    return content ? content.length : 0;
  }

  write(content: string): void {
    mockFiles.set(this.uri, content);
  }

  text(): string {
    return mockFiles.get(this.uri) ?? "";
  }

  base64(): string {
    return "bW9ja0Jhc2U2NERhdGE="; // "mockBase64Data"
  }

  delete(): void {
    mockFiles.delete(this.uri);
  }
}

export class Directory {
  uri: string;

  constructor(...args: unknown[]) {
    if (args.length === 1 && typeof args[0] === "string") {
      this.uri = args[0];
    } else if (args.length === 2) {
      const parent = args[0] as { uri: string } | string;
      const name = args[1] as string;
      const parentUri = typeof parent === "string" ? parent : parent.uri;
      this.uri = `${parentUri}/${name}`;
    } else {
      this.uri = "file:///mock/dir";
    }
  }

  get exists(): boolean {
    return mockDirs.has(this.uri);
  }

  create(): void {
    mockDirs.add(this.uri);
  }

  delete(): void {
    mockDirs.delete(this.uri);
    // Remove all files under this directory
    for (const key of mockFiles.keys()) {
      if (key.startsWith(this.uri)) {
        mockFiles.delete(key);
      }
    }
  }

  list(): (File | Directory)[] {
    const entries: (File | Directory)[] = [];
    for (const key of mockFiles.keys()) {
      if (key.startsWith(this.uri + "/")) {
        const relative = key.slice(this.uri.length + 1);
        // Only direct children (no nested slashes)
        if (!relative.includes("/")) {
          const f = new File(key);
          entries.push(f);
        }
      }
    }
    return entries;
  }
}

export const Paths = {
  document: { uri: "file:///mock/documents" },
  cache: { uri: "file:///mock/cache" },
};

/** Test helpers to set up mock filesystem state */
export function __setMockFile(uri: string, content: string): void {
  mockFiles.set(uri, content);
}

export function __setMockDir(uri: string): void {
  mockDirs.add(uri);
}

export function __clearMockFs(): void {
  mockFiles.clear();
  mockDirs.clear();
}
