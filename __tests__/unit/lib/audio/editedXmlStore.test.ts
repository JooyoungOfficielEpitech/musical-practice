import { saveEditedXml } from "../../../../client/lib/audio/editedXmlStore";

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    write: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../../../../client/lib/fileStorage", () => ({
  resolveExistingUri: jest.fn((uri: string) => `/resolved/${uri}`),
}));

import { File } from "expo-file-system";
import { resolveExistingUri } from "../../../../client/lib/fileStorage";

const mockResolveExistingUri = resolveExistingUri as jest.MockedFunction<
  typeof resolveExistingUri
>;
const MockFile = File as jest.MockedClass<typeof File>;

describe("editedXmlStore — saveEditedXml", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves the musicXmlUri and writes to file", async () => {
    const sheetId = "sheet-123";
    const musicXmlUri = "sheets/sheet-123/score.musicxml";
    const xml = "<score-partwise>test</score-partwise>";

    mockResolveExistingUri.mockReturnValue("/local/sheets/sheet-123/score.musicxml");

    await saveEditedXml(sheetId, musicXmlUri, xml);

    expect(mockResolveExistingUri).toHaveBeenCalledWith(musicXmlUri);
    expect(MockFile).toHaveBeenCalledWith("/local/sheets/sheet-123/score.musicxml");
  });

  it("calls file.write with the XML content", async () => {
    const sheetId = "sheet-123";
    const musicXmlUri = "sheets/sheet-123/score.musicxml";
    const xml = "<score-partwise>updated</score-partwise>";

    mockResolveExistingUri.mockReturnValue("/local/sheets/sheet-123/score.musicxml");
    const mockWrite = jest.fn().mockResolvedValue(undefined);
    MockFile.mockImplementation(() => ({
      write: mockWrite,
    } as any));

    await saveEditedXml(sheetId, musicXmlUri, xml);

    expect(mockWrite).toHaveBeenCalledWith(xml);
  });

  it("rejects if resolveExistingUri throws", async () => {
    const sheetId = "sheet-123";
    const musicXmlUri = "invalid-uri";
    const xml = "<score-partwise>test</score-partwise>";

    mockResolveExistingUri.mockImplementation(() => {
      throw new Error("Invalid URI");
    });

    await expect(saveEditedXml(sheetId, musicXmlUri, xml)).rejects.toThrow(
      "Failed to save edited XML for sheet sheet-123",
    );
  });

  it("rejects if file.write throws", async () => {
    const sheetId = "sheet-123";
    const musicXmlUri = "sheets/sheet-123/score.musicxml";
    const xml = "<score-partwise>test</score-partwise>";

    mockResolveExistingUri.mockReturnValue("/local/sheets/sheet-123/score.musicxml");
    const mockWrite = jest.fn().mockRejectedValue(new Error("I/O error"));
    MockFile.mockImplementation(() => ({
      write: mockWrite,
    } as any));

    await expect(saveEditedXml(sheetId, musicXmlUri, xml)).rejects.toThrow(
      "Failed to save edited XML for sheet sheet-123",
    );
  });

  it("preserves XML content through save and resolve flow", async () => {
    const sheetId = "sheet-456";
    const musicXmlUri = "sheets/sheet-456/notes.xml";
    const xml = '<?xml version="1.0"?><score-partwise><part-list/></score-partwise>';

    mockResolveExistingUri.mockReturnValue("/resolved/sheets/sheet-456/notes.xml");
    const mockWrite = jest.fn().mockResolvedValue(undefined);
    MockFile.mockImplementation(() => ({
      write: mockWrite,
    } as any));

    await saveEditedXml(sheetId, musicXmlUri, xml);

    expect(mockWrite).toHaveBeenCalledWith(xml);
  });
});
