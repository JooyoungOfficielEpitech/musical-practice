import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import {
  ImportLandingView,
  ImportConfirmView,
  formatFileSize,
} from "../../client/components/PdfImportSetupViews";

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#000", textSecondary: "#666", primary: "#2563EB",
      backgroundDefault: "#FFF", surface: "#F8F9FA", buttonText: "#FFF",
      borderLight: "#EEE",
    },
  }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

describe("formatFileSize", () => {
  it("formats KB and MB, hides unknown", () => {
    expect(formatFileSize(500)).toBe("1 KB");
    expect(formatFileSize(200 * 1024)).toBe("200 KB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(0)).toBeNull();
  });
});

describe("ImportLandingView", () => {
  it("explains the flow and fires onChoose", () => {
    const onChoose = jest.fn();
    const { getByLabelText, getByText } = render(
      <ImportLandingView onChoose={onChoose} onGoBack={jest.fn()} isPicking={false} />,
    );
    expect(getByText("Import a PDF score")).toBeTruthy();
    expect(getByText(/background/)).toBeTruthy();
    fireEvent.press(getByLabelText("Choose PDF"));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it("goes back to the library without a pick", () => {
    const onGoBack = jest.fn();
    const { getByLabelText } = render(
      <ImportLandingView onChoose={jest.fn()} onGoBack={onGoBack} isPicking={false} />,
    );
    fireEvent.press(getByLabelText("Back to library"));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it("disables choosing while the picker is open", () => {
    const onChoose = jest.fn();
    const { getByLabelText, getByText } = render(
      <ImportLandingView onChoose={onChoose} onGoBack={jest.fn()} isPicking />,
    );
    expect(getByText("Opening…")).toBeTruthy();
    fireEvent.press(getByLabelText("Choose PDF"));
    expect(onChoose).not.toHaveBeenCalled();
  });
});

function confirmProps(overrides: Record<string, unknown> = {}) {
  return {
    fileName: "Hadestown-VS.pdf",
    fileSizeBytes: 2.4 * 1024 * 1024,
    pageCount: 4,
    title: "Hadestown VS",
    onTitleChange: jest.fn(),
    onStart: jest.fn(),
    onChooseDifferent: jest.fn(),
    ...overrides,
  };
}

describe("ImportConfirmView", () => {
  it("shows file facts and starts the scan with the edited title", () => {
    const props = confirmProps();
    const { getByText, getByLabelText } = render(<ImportConfirmView {...(props as any)} />);
    expect(getByText("Hadestown-VS.pdf")).toBeTruthy();
    expect(getByText("4 pages · 2.4 MB")).toBeTruthy();
    fireEvent.changeText(getByLabelText("Score title"), "Wait For Me");
    expect(props.onTitleChange).toHaveBeenCalledWith("Wait For Me");
    fireEvent.press(getByLabelText("Start scan"));
    expect(props.onStart).toHaveBeenCalledTimes(1);
  });

  it("hides the page count when unknown", () => {
    const { getByText, queryByText } = render(
      <ImportConfirmView {...(confirmProps({ pageCount: null, fileSizeBytes: 1024 * 1024 }) as any)} />,
    );
    expect(getByText("1.0 MB")).toBeTruthy();
    expect(queryByText(/pages/)).toBeNull();
  });

  it("warns on long scores", () => {
    const { getByText } = render(
      <ImportConfirmView {...(confirmProps({ pageCount: 20 }) as any)} />,
    );
    expect(getByText(/Long score/)).toBeTruthy();
  });

  it("lets the user pick a different file", () => {
    const props = confirmProps();
    const { getByLabelText } = render(<ImportConfirmView {...(props as any)} />);
    fireEvent.press(getByLabelText("Choose a different PDF"));
    expect(props.onChooseDifferent).toHaveBeenCalledTimes(1);
  });
});
