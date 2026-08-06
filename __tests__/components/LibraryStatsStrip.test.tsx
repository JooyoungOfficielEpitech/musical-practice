/**
 * Tests for LibraryStatsStrip component
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { LibraryStatsStrip } from "../../client/components/LibraryStatsStrip";
import type { UserStats } from "../../client/lib/storage";

jest.mock("../../client/hooks/useTheme", () => ({
  useTheme: () => ({
    colors: {
      text: "#1C1917",
      textSecondary: "#6B6560",
      surface: "#F4F1EC",
      primary: "#1C1917",
      warning: "#D97706",
      accent: "#D97706",
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

describe("LibraryStatsStrip", () => {
  it("should render null when totalSessions is 0", () => {
    const stats: UserStats = {
      totalPracticeTime: 0,
      totalSessions: 0,
      averageAccuracy: 0,
      streak: 0,
      lastPracticeDate: "",
    };

    const { toJSON } = render(<LibraryStatsStrip stats={stats} />);
    expect(toJSON()).toBeNull();
  });

  it("should display all stat cards when sessions exist", () => {
    const stats: UserStats = {
      totalPracticeTime: 3600,
      totalSessions: 10,
      averageAccuracy: 85,
      streak: 5,
      lastPracticeDate: "Fri Mar 15 2024",
    };

    const { getByText } = render(<LibraryStatsStrip stats={stats} />);

    expect(getByText("5")).toBeTruthy(); // streak
    expect(getByText("1h 0m")).toBeTruthy(); // total time
    expect(getByText("10")).toBeTruthy(); // session count
  });

  it("should format duration correctly", () => {
    const stats: UserStats = {
      totalPracticeTime: 7920, // 2h 12m
      totalSessions: 5,
      averageAccuracy: 80,
      streak: 3,
      lastPracticeDate: "Thu Mar 14 2024",
    };

    const { getByText } = render(<LibraryStatsStrip stats={stats} />);
    expect(getByText("2h 12m")).toBeTruthy();
  });

  it("should format duration as minutes only when under 1 hour", () => {
    const stats: UserStats = {
      totalPracticeTime: 1800, // 30 minutes
      totalSessions: 5,
      averageAccuracy: 80,
      streak: 2,
      lastPracticeDate: "Wed Mar 13 2024",
    };

    const { getByText } = render(<LibraryStatsStrip stats={stats} />);
    expect(getByText("30m")).toBeTruthy();
  });

  it("should display 0m when totalPracticeTime is 0 and sessions > 0", () => {
    const stats: UserStats = {
      totalPracticeTime: 0,
      totalSessions: 1, // at least one session
      averageAccuracy: 0,
      streak: 1,
      lastPracticeDate: "Mon Mar 11 2024",
    };

    const { getByText } = render(<LibraryStatsStrip stats={stats} />);
    expect(getByText("0m")).toBeTruthy();
  });

  it("should show correct labels for each stat", () => {
    const stats: UserStats = {
      totalPracticeTime: 3600,
      totalSessions: 10,
      averageAccuracy: 85,
      streak: 5,
      lastPracticeDate: "Fri Mar 15 2024",
    };

    const { getByText } = render(<LibraryStatsStrip stats={stats} />);
    expect(getByText("day streak")).toBeTruthy();
    expect(getByText("practiced")).toBeTruthy();
    expect(getByText("sessions")).toBeTruthy();
  });

  it("should handle large session counts", () => {
    const stats: UserStats = {
      totalPracticeTime: 86400, // 1 day in seconds
      totalSessions: 999,
      averageAccuracy: 90,
      streak: 30,
      lastPracticeDate: "Fri Mar 15 2024",
    };

    const { getByText } = render(<LibraryStatsStrip stats={stats} />);
    expect(getByText("999")).toBeTruthy();
    expect(getByText("24h 0m")).toBeTruthy();
  });
});
