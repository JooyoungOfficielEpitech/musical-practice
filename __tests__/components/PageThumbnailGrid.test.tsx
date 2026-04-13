import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PageThumbnailGrid } from "../../client/components/PageThumbnailGrid";
import type { PdfChunk } from "../../client/lib/pdfImport";

const makeChunks = (n: number): PdfChunk[] =>
  Array.from({ length: n }, (_, i) => ({
    pageRange: [i + 1, i + 1] as [number, number],
    pngB64s: [`page${i + 1}base64`],
  }));

describe("PageThumbnailGrid", () => {
  it("renders one thumbnail per chunk", () => {
    const { getAllByTestId } = render(
      <PageThumbnailGrid chunks={makeChunks(3)} pageRanges={[]} onPageRangesChange={jest.fn()} />
    );
    expect(getAllByTestId("page-thumbnail")).toHaveLength(3);
  });

  it("no boundaries selected → dividers exist between pages", () => {
    const { getAllByTestId } = render(
      <PageThumbnailGrid chunks={makeChunks(3)} pageRanges={[]} onPageRangesChange={jest.fn()} />
    );
    expect(getAllByTestId("page-divider")).toHaveLength(2);
  });

  it("tapping a divider toggles a boundary and calls onPageRangesChange", () => {
    const onChange = jest.fn();
    const { getAllByTestId } = render(
      <PageThumbnailGrid chunks={makeChunks(3)} pageRanges={[]} onPageRangesChange={onChange} />
    );
    const dividers = getAllByTestId("page-divider");
    fireEvent.press(dividers[0]); // boundary after page 1
    expect(onChange).toHaveBeenCalledWith([[1, 1], [2, 3]]);
  });

  it("tapping active boundary removes it", () => {
    const onChange = jest.fn();
    const { getAllByTestId } = render(
      <PageThumbnailGrid
        chunks={makeChunks(3)}
        pageRanges={[[1, 1], [2, 3]]}
        onPageRangesChange={onChange}
      />
    );
    const dividers = getAllByTestId("page-divider");
    fireEvent.press(dividers[0]); // remove boundary after page 1
    expect(onChange).toHaveBeenCalledWith([[1, 3]]);
  });
});
