import { resolveExistingUri } from "../../../client/lib/fileStorage";

// File.exists is true only for paths under the *current* container.
jest.mock("expo-file-system", () => {
  const CURRENT = "/permanent/documents";
  class MockFile {
    uri: string;
    constructor(...uris: any[]) {
      this.uri = uris.map((u: any) => (typeof u === "object" && u.uri ? u.uri : u)).join("/");
    }
    get exists() {
      return this.uri.startsWith(CURRENT);
    }
  }
  class MockDirectory {
    uri: string;
    exists = false;
    create = jest.fn();
    constructor(...uris: any[]) {
      this.uri = uris.map((u: any) => (typeof u === "object" && u.uri ? u.uri : u)).join("/");
    }
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { document: { uri: CURRENT } } };
});

describe("resolveExistingUri", () => {
  it("returns the original URI when the file exists", () => {
    const uri = "/permanent/documents/music/score.musicxml";
    expect(resolveExistingUri(uri)).toBe(uri);
  });

  it("rebases a stale-container URI to the current container when the original is gone", () => {
    // Old app-container path that no longer exists after an update
    const stale = "/var/mobile/Containers/Data/Application/OLD-UUID/Documents/music/score.musicxml";
    expect(resolveExistingUri(stale)).toBe("/permanent/documents/music/score.musicxml");
  });

  it("rebases a stale audio URI the same way", () => {
    const stale = "/var/OLD-UUID/Documents/audio/song.mp3";
    expect(resolveExistingUri(stale)).toBe("/permanent/documents/audio/song.mp3");
  });

  it("returns empty/undefined inputs unchanged", () => {
    expect(resolveExistingUri("")).toBe("");
  });

  it("leaves a non-document URI alone when it cannot be rebased", () => {
    const remote = "https://example.com/song.mp3";
    expect(resolveExistingUri(remote)).toBe(remote);
  });
});
