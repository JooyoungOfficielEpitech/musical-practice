/**
 * Integration tests for file persistence in sheet music workflow.
 * Verifies that addSheet/editSheet copy files from cache to permanent storage.
 */

// Track copy calls to verify files are copied to permanent storage
import {
  copyImagesToStorage,
  copyToLocalStorage,
  isDocumentUri,
} from "../../client/lib/fileStorage";

const mockCopy = jest.fn();
const mockDirCreate = jest.fn();

jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string;
    exists = true;
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
      document: { uri: "/permanent/documents" },
    },
  };
});

describe("File Persistence Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addSheet file copy workflow", () => {
    it("copies cache image URIs to permanent storage", async () => {
      const cacheUris = [
        "/tmp/cache/ImagePicker/photo1.jpg",
        "/tmp/cache/ImagePicker/photo2.png",
      ];

      const permanentUris = await copyImagesToStorage(cacheUris);

      expect(permanentUris).toHaveLength(2);
      permanentUris.forEach((uri) => {
        expect(isDocumentUri(uri)).toBe(true);
      });
      expect(mockCopy).toHaveBeenCalledTimes(2);
    });

    it("copies cache audio URI to permanent storage", async () => {
      const cacheAudioUri = "/tmp/cache/DocumentPicker/song.mp3";

      const permanentUri = await copyToLocalStorage(cacheAudioUri, "audio");

      expect(permanentUri).toBeTruthy();
      expect(isDocumentUri(permanentUri!)).toBe(true);
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it("does not re-copy URIs already in permanent storage", async () => {
      const mixedUris = [
        "/permanent/documents/images/already_saved.jpg",
        "/tmp/cache/ImagePicker/new_photo.jpg",
      ];

      const result = await copyImagesToStorage(mixedUris);

      expect(result).toHaveLength(2);
      // Only the cache URI should trigger a copy
      expect(mockCopy).toHaveBeenCalledTimes(1);
      // The permanent URI should be kept as-is
      expect(result[0]).toBe("/permanent/documents/images/already_saved.jpg");
    });
  });

  describe("editSheet file copy workflow", () => {
    it("only copies new images when editing", async () => {
      // Simulate edit: 2 existing permanent URIs + 1 new cache URI
      const imageUris = [
        "/permanent/documents/images/existing1.jpg",
        "/permanent/documents/images/existing2.jpg",
        "/tmp/cache/ImagePicker/new_photo.jpg",
      ];

      const result = await copyImagesToStorage(imageUris);

      expect(result).toHaveLength(3);
      // Only 1 new image should be copied
      expect(mockCopy).toHaveBeenCalledTimes(1);
      // Existing URIs preserved
      expect(result[0]).toBe("/permanent/documents/images/existing1.jpg");
      expect(result[1]).toBe("/permanent/documents/images/existing2.jpg");
    });
  });
});
