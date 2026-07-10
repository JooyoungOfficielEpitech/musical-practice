/**
 * PracticeContext — processing sheets must reconcile on a timer so the
 * library flips to Ready without an app restart.
 */
import React from "react";
import { render, act } from "@testing-library/react-native";

const processingSheet = {
  id: "s1",
  title: "Hermes",
  artist: "",
  imageUris: [],
  createdAt: 1,
  folder: "Musical",
  isFavorite: false,
  omrStatus: "processing",
  omrJobId: "job-1",
};

const mockGetSheets = jest.fn();
jest.mock("../../../client/lib/storage", () => ({
  getSheets: (...a: unknown[]) => mockGetSheets(...a),
  saveSheet: jest.fn(),
  updateSheet: jest.fn(),
  patchSheet: jest.fn().mockResolvedValue(null),
  deleteSheet: jest.fn(),
  generateId: () => "generated-id",
}));

jest.mock("../../../client/lib/migration", () => ({
  migrateFileUrisToDocument: jest.fn(async (sheets: unknown[]) => sheets),
}));

jest.mock("../../../client/lib/fileStorage", () => ({
  copyImagesToStorage: jest.fn(async (uris: string[]) => uris),
  copyToLocalStorage: jest.fn(),
  isDocumentUri: () => true,
}));

const mockReconcile = jest.fn().mockResolvedValue(null);
jest.mock("../../../client/lib/omrReconcile", () => ({
  reconcileOmrSheet: (...a: unknown[]) => mockReconcile(...a),
}));

jest.mock("../../../client/lib/omrQueue", () => ({
  downloadPreview: jest.fn().mockResolvedValue(null),
}));

import { PracticeProvider } from "../../../client/context/PracticeContext";

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("PracticeContext pending-job polling", () => {
  it("re-reconciles processing sheets every poll tick", async () => {
    mockGetSheets.mockResolvedValue([processingSheet]);

    render(
      <PracticeProvider>
        <></>
      </PracticeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Initial reconcile on load
    expect(mockReconcile).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockReconcile).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockReconcile).toHaveBeenCalledTimes(3);
  });

  it("does not start a poll when nothing is processing", async () => {
    mockGetSheets.mockResolvedValue([
      { ...processingSheet, omrStatus: "ready", resultStoragePath: undefined },
    ]);

    render(
      <PracticeProvider>
        <></>
      </PracticeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
