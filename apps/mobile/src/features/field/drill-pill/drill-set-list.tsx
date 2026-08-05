import React from "react";
import { FlatList, type ListRenderItemInfo } from "react-native";
import { Pressable } from "@eight2five/ui/components/pressable";
import type { DrillSet, DrillTerminology } from "@eight2five/mobile/drill";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";
import type { FieldPresetId } from "@eight2five/drill-schema";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import {
  getDrillSetHudPresentation,
  type CountDisplayMode,
} from "../field-hud-state";
import { DrillSetMetricGrid } from "./drill-set-metric-grid";
import type { DrillPillColumnMetrics } from "./drill-pill-layout";

export const DRILL_SET_ROW_HEIGHT = 84;

export function DrillSetList({
  pages,
  selectedIndex,
  columns,
  countDisplayMode,
  metricMode,
  terminology,
  fieldPreset,
  expanded,
  onSelectIndex,
}: {
  readonly pages: readonly DrillSet[];
  readonly selectedIndex: number;
  readonly columns: DrillPillColumnMetrics;
  readonly countDisplayMode: CountDisplayMode;
  readonly metricMode: TransitionMetricMode;
  readonly terminology: DrillTerminology;
  readonly fieldPreset: FieldPresetId;
  readonly expanded: boolean;
  readonly onSelectIndex: (index: number) => void;
}) {
  const theme = useEight2FiveTheme();
  const listRef = React.useRef<FlatList<DrillSet>>(null);

  React.useEffect(() => {
    if (!expanded || selectedIndex < 0 || pages.length === 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: false,
        viewPosition: 0.5,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded, pages.length, selectedIndex]);

  const renderItem = React.useCallback(
    ({ item, index }: ListRenderItemInfo<DrillSet>) => {
      const selected = index === selectedIndex;
      const presentation = getDrillSetHudPresentation({
        page: item,
        previousPage: index > 0 ? pages[index - 1] : undefined,
        metricMode,
        fieldPreset,
        terminology,
      });
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${presentation.term.toLowerCase()} ${presentation.set}`}
          accessibilityState={{ selected }}
          onPress={() => onSelectIndex(index)}
          style={{
            height: DRILL_SET_ROW_HEIGHT,
            justifyContent: "center",
            backgroundColor: selected ? theme.accent : "transparent",
          }}
          testID={`drill-set-row-${index}`}
        >
          <DrillSetMetricGrid
            presentation={presentation}
            columns={columns}
            countDisplayMode={countDisplayMode}
            metricMode={metricMode}
            selected={selected}
          />
        </Pressable>
      );
    },
    [
      columns,
      countDisplayMode,
      fieldPreset,
      metricMode,
      onSelectIndex,
      pages,
      selectedIndex,
      terminology,
      theme.accent,
    ],
  );

  return (
    <FlatList
      ref={listRef}
      data={pages as DrillSet[]}
      renderItem={renderItem}
      keyExtractor={(page) => page.id}
      getItemLayout={(_data, index) => ({
        index,
        length: DRILL_SET_ROW_HEIGHT,
        offset: DRILL_SET_ROW_HEIGHT * index,
      })}
      extraData={`${countDisplayMode}:${metricMode}:${selectedIndex}`}
      style={{ flex: 1 }}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      onScrollToIndexFailed={({ index }) => {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, index * DRILL_SET_ROW_HEIGHT),
          animated: false,
        });
      }}
      testID="drill-set-list"
    />
  );
}
