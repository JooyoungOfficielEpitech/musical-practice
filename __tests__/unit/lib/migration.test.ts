import { migrateSheetMusic, migrateFileUrisToDocument } from "../../../client/lib/migration";
import type { SheetMusic } from "../../../client/lib/storage";

// Mock fileStorage module
const mockCopy = jest.fn();
const mockDirCreate = jest.fn();
let mockFileExists = false;

jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string;
    get exists() { return mockFileExists; }
    copy = mockCopy;
    delete = jest.fn();
    constructor(...uris: any[]) {
      this.uri = uris
        .map((u: any) => (typeof u === "object" && u.uri ? u.uri : u))
        .join("/");
    }
  }

  class MockDirectory {
    uri: string;
    exists = false;
    create = mockDirCreate;
    constructor(...uris: any[]) {
      this.uri = uris
        .map((u: any) => (typeof u === "object" && u.uri ? u.uri : u))
        .join("/");
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: "/permanent/documents",
    },
  };
});

describe("migrateSheetMusic", () => {
  it("migrates legacy imageUri to imageUris array", () => {
    const legacy = {
      id: "1",
      title: "Test",
      artist: "Artist",
      imageUri: "old.jpg",
      createdAt: 1000,
      folder: "Musical",
      bpm: 120,
      key: "C",
      isFavorite: false,
    };

    const result = migrateSheetMusic(legacy);

    expect(result.imageUris).toEqual(["old.jpg"]);
    expect(result.audioUri).toBeUndefined();
    expect((result as any).imageUri).toBeUndefined();
  });

  it("preserves existing imageUris without change", () => {
    const modern = {
      id: "2",
      title: "Test",
      artist: "Artist",
      imageUris: ["a.jpg", "b.jpg"],
      audioUri: "song.mp3",
      createdAt: 1000,
      folder: "Pop",
      bpm: 100,
      key: "D",
      isFavorite: true,
    };

    const result = migrateSheetMusic(modern);

    expect(result.imageUris).toEqual(["a.jpg", "b.jpg"]);
    expect(result.audioUri).toBe("song.mp3");
  });

  it("handles empty array input", () => {
    const result = migrateSheetMusic({
      id: "3",
      title: "Empty",
      artist: "",
      imageUris: [],
      createdAt: 0,
      folder: "",
      bpm: 0,
      key: "",
      isFavorite: false,
    });

    expect(result.imageUris).toEqual([]);
  });

  it("prioritizes imageUris over imageUri when both exist", () => {
    const both = {
      id: "4",
      title: "Both",
      artist: "Artist",
      imageUri: "legacy.jpg",
      imageUris: ["new1.jpg", "new2.jpg"],
      createdAt: 1000,
      folder: "Jazz",
      bpm: 90,
      key: "E",
      isFavorite: false,
    };

    const result = migrateSheetMusic(both);

    expect(result.imageUris).toEqual(["new1.jpg", "new2.jpg"]);
    expect((result as any).imageUri).toBeUndefined();
  });
});

describe("migrateFileUrisToDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileExists = false;
  });

  it("copies cache URIs to permanent storage", async () => {
    mockFileExists = true; // source file exists in cache

    const sheets: SheetMusic[] = [
      {
        id: "1",
        title: "Test",
        artist: "A",
        imageUris: ["/tmp/cache/photo.jpg"],
        audioUri: "/tmp/cache/song.mp3",
        createdAt: 1000,
        folder: "Musical",
        isFavorite: false,
      },
    ];

    const result = await migrateFileUrisToDocument(sheets);

    // Images and audio should be copied
    expect(mockCopy).toHaveBeenCalled();
    expect(result[0].imageUris[0]).toContain("/permanent/documents");
    expect(result[0].audioUri).toContain("/permanent/documents");
  });

  it("skips sheets already in document storage", async () => {
    const sheets: SheetMusic[] = [
      {
        id: "2",
        title: "Already Saved",
        artist: "B",
        imageUris: ["/permanent/documents/images/existing.jpg"],
        audioUri: "/permanent/documents/audio/existing.mp3",
        createdAt: 1000,
        folder: "Pop",
        isFavorite: false,
      },
    ];

    const result = await migrateFileUrisToDocument(sheets);

    expect(mockCopy).not.toHaveBeenCalled();
    expect(result[0].imageUris[0]).toBe("/permanent/documents/images/existing.jpg");
  });

  it("removes URIs for files that no longer exist in cache", async () => {
    mockFileExists = false; // file deleted from cache

    const sheets: SheetMusic[] = [
      {
        id: "3",
        title: "Lost Files",
        artist: "C",
        imageUris: ["/tmp/cache/deleted.jpg"],
        audioUri: "/tmp/cache/deleted.mp3",
        createdAt: 1000,
        folder: "Jazz",
        isFavorite: false,
      },
    ];

    const result = await migrateFileUrisToDocument(sheets);

    // Files don't exist → URIs should be cleared
    expect(result[0].imageUris).toEqual([]);
    expect(result[0].audioUri).toBeUndefined();
  });

  it("returns unchanged array when all sheets already migrated", async () => {
    const sheets: SheetMusic[] = [
      {
        id: "4",
        title: "Done",
        artist: "D",
        imageUris: ["/permanent/documents/images/a.jpg"],
        createdAt: 1000,
        folder: "Musical",
        isFavorite: false,
      },
    ];

    const result = await migrateFileUrisToDocument(sheets);

    expect(result).toEqual(sheets);
  });
});
