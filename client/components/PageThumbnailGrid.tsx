import React, { useMemo } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
} from "react-native";
import type { PdfChunk, PageRange } from "@/lib/pdfImport";

interface PageThumbnailGridProps {
  chunks: PdfChunk[];
  pageRanges: PageRange[];
  onPageRangesChange(ranges: PageRange[]): void;
}

function boundariesToRanges(boundaries: Set<number>, totalPages: number): PageRange[] {
  const ranges: PageRange[] = [];
  let start = 1;
  for (let page = 1; page <= totalPages; page++) {
    if (boundaries.has(page)) {
      ranges.push([start, page]);
      start = page + 1;
    }
  }
  if (start <= totalPages) ranges.push([start, totalPages]);
  return ranges;
}

function rangesToBoundaries(ranges: PageRange[]): Set<number> {
  const boundaries = new Set<number>();
  for (const [, end] of ranges) {
    boundaries.add(end);
  }
  return boundaries;
}

export function PageThumbnailGrid({ chunks, pageRanges, onPageRangesChange }: PageThumbnailGridProps) {
  const totalPages = chunks.length;
  const boundaries = useMemo(() => {
    const b = rangesToBoundaries(pageRanges);
    b.delete(totalPages); // last page is not a toggleable boundary
    return b;
  }, [pageRanges, totalPages]);

  const toggleBoundary = (afterPage: number) => {
    const next = new Set(boundaries);
    if (next.has(afterPage)) {
      next.delete(afterPage);
    } else {
      next.add(afterPage);
    }
    onPageRangesChange(boundariesToRanges(next, totalPages));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {chunks.map((chunk, index) => {
        const pageNum = index + 1;
        const isLast = index === chunks.length - 1;
        const hasBoundary = boundaries.has(pageNum);
        return (
          <React.Fragment key={pageNum}>
            <View testID="page-thumbnail" style={styles.thumbnail}>
              <Image
                source={{ uri: `data:image/png;base64,${chunk.pngB64s[0]}` }}
                style={styles.image}
                resizeMode="contain"
              />
              <Text style={styles.pageLabel}>Page {pageNum}</Text>
            </View>
            {!isLast && (
              <TouchableOpacity
                testID="page-divider"
                onPress={() => toggleBoundary(pageNum)}
                style={[styles.divider, hasBoundary && styles.dividerActive]}
              >
                <View style={[styles.dividerLine, hasBoundary && styles.dividerLineActive]} />
                {hasBoundary && <Text style={styles.splitLabel}>Split here</Text>}
              </TouchableOpacity>
            )}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  thumbnail: { borderRadius: 8, overflow: "hidden", backgroundColor: "#f5f5f5" },
  image: { width: "100%", height: 200 },
  pageLabel: { textAlign: "center", padding: 4, fontSize: 12, color: "#666" },
  divider: { height: 32, justifyContent: "center", alignItems: "center" },
  dividerActive: {},
  dividerLine: { width: "100%", height: 2, backgroundColor: "#e0e0e0" },
  dividerLineActive: { backgroundColor: "#007AFF", height: 3 },
  splitLabel: { fontSize: 11, color: "#007AFF", marginTop: 2 },
});
