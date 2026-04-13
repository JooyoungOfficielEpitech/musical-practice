import {
  copyToLocalStorage,
  deleteLocalFile,
  copyImagesToStorage,
  fileExists,
  isDocumentUri,
} from "../../../client/lib/fileStorage";

// Track instances created
const mockFileInstances: any[] = [];
const mockDirInstances: any[] = [];

jest.mock("expo-file-system", () => {
  const mockCopy = jest.fn();
  const mockDelete = jest.fn();
  const mockDirCreate = jest.fn();

  class MockFile {
    uri: string;
    copy = mockCopy;
    delete = mockDelete;
    constructor(...uris: any[]) {
      // Mimic real File: if first arg is Directory/File, use its .uri
      this.uri = uris.map((u: any) => (typeof u === "object" && u.uri ? u.uri : u)).join("/");
      mockFileInstances.push(this);
    }
  }

  class MockDirectory {
    uri: string;
    exists = false;
    create = mockDirCreate;
    constructor(...uris: any[]) {
      this.uri = uris.map((u: any) => (typeof u === "object" && u.uri ? u.uri : u)).join("/");
      mockDirInstances.push(this);
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: { uri: "/mock/documents" },
      join: (...parts: string[]) => parts.join("/"),
    },
    __mockCopy: mockCopy,
    __mockDelete: mockDelete,
    __mockDirCreate: mockDirCreate,
  };
});

const mockModule = jest.requireMock("expo-file-system");

describe("fileStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileInstances.length = 0;
    mockDirInstances.length = 0;
  });

  describe("copyToLocalStorage", () => {
    it("copies file to documents directory with images prefix", async () => {
      const result = await copyToLocalStorage("/tmp/photo.jpg", "images");

      expect(result).toBeTruthy();
      expect(result).toContain("images");
      expect(result).toMatch(/\.jpg$/);
      expect(mockModule.__mockCopy).toHaveBeenCalledTimes(1);
    });

    it("copies file to documents directory with audio prefix", async () => {
      const result = await copyToLocalStorage("/tmp/song.mp3", "audio");

      expect(result).toBeTruthy();
      expect(result).toContain("audio");
      expect(result).toMatch(/\.mp3$/);
    });

    it("returns null for empty source URI", async () => {
      const result = await copyToLocalStorage("", "images");

      expect(result).toBeNull();
      expect(mockModule.__mockCopy).not.toHaveBeenCalled();
    });

    it("returns null when file copy throws", async () => {
      mockModule.__mockCopy.mockImplementationOnce(() => {
        throw new Error("Disk full");
      });

      const result = await copyToLocalStorage("/tmp/photo.jpg", "images");

      expect(result).toBeNull();
    });

    it("preserves file extension from source", async () => {
      const result = await copyToLocalStorage("/tmp/image.png", "images");

      expect(result).toMatch(/\.png$/);
    });

    it("creates target directory if it does not exist", async () => {
      await copyToLocalStorage("/tmp/photo.jpg", "images");

      expect(mockDirInstances.length).toBeGreaterThan(0);
      // Directory starts with exists=false, so create should be called
      expect(mockModule.__mockDirCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteLocalFile", () => {
    it("deletes a file and returns true", async () => {
      const result = await deleteLocalFile("/mock/documents/images/abc.jpg");

      expect(mockModule.__mockDelete).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it("returns false when delete throws", async () => {
      mockModule.__mockDelete.mockImplementationOnce(() => {
        throw new Error("Not found");
      });

      const result = await deleteLocalFile("/mock/documents/images/abc.jpg");

      expect(result).toBe(false);
    });

    it("returns false for empty URI", async () => {
      const result = await deleteLocalFile("");

      expect(result).toBe(false);
      expect(mockModule.__mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("copyImagesToStorage", () => {
    it("copies all images and returns new URIs", async () => {
      const uris = ["/tmp/a.jpg", "/tmp/b.png"];
      const result = await copyImagesToStorage(uris);

      expect(result).toHaveLength(2);
      result.forEach((uri) => {
        expect(uri).toContain("images");
      });
      expect(mockModule.__mockCopy).toHaveBeenCalledTimes(2);
    });

    it("returns empty array for empty input", async () => {
      const result = await copyImagesToStorage([]);

      expect(result).toEqual([]);
      expect(mockModule.__mockCopy).not.toHaveBeenCalled();
    });

    it("skips failed copies and returns only successful ones", async () => {
      mockModule.__mockCopy
        .mockImplementationOnce(() => {}) // first succeeds
        .mockImplementationOnce(() => { throw new Error("fail"); }); // second fails

      const result = await copyImagesToStorage(["/tmp/a.jpg", "/tmp/b.jpg"]);

      expect(result).toHaveLength(1);
    });

    it("skips URIs already in document storage", async () => {
      const uris = ["/mock/documents/images/existing.jpg", "/tmp/new.jpg"];
      const result = await copyImagesToStorage(uris);

      // First URI already in documents → should not be copied, just kept
      // Second URI is new → should be copied
      expect(mockModule.__mockCopy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe("/mock/documents/images/existing.jpg");
    });
  });

  describe("fileExists", () => {
    it("returns true when file exists", () => {
      // Temporarily make File instances have exists = true
      const OrigFile = mockModule.File;
      const origProto = OrigFile.prototype.exists;
      Object.defineProperty(OrigFile.prototype, "exists", { value: true, configurable: true });

      const result = fileExists("/mock/documents/images/test.jpg");

      expect(result).toBe(true);

      // Restore
      Object.defineProperty(OrigFile.prototype, "exists", { value: origProto, configurable: true });
    });

    it("returns false for empty URI", () => {
      const result = fileExists("");

      expect(result).toBe(false);
    });

    it("returns false when file check throws", () => {
      // The mock File doesn't have exists property, so it should return false
      const result = fileExists("/nonexistent/file.jpg");

      expect(result).toBe(false);
    });
  });

  describe("isDocumentUri", () => {
    it("returns true for URIs in document directory", () => {
      expect(isDocumentUri("/mock/documents/images/test.jpg")).toBe(true);
    });

    it("returns false for cache URIs", () => {
      expect(isDocumentUri("/tmp/cache/photo.jpg")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isDocumentUri("")).toBe(false);
    });
  });
});
