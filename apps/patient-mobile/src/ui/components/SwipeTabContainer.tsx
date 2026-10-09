import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';
import type { MainTab } from './BottomNavBar';

export const MAIN_SWIPE_TABS: MainTab[] = [
  'home',
  'appointments',
  'records',
  'prescriptions',
  'profile',
];

export const SWIPE_DISTANCE_RATIO = 0.28;
export const SWIPE_VELOCITY_THRESHOLD = 0.4;

export const shouldStartMainTabSwipe = (
  activeIndex: number,
  dx: number,
  dy: number,
) => {
  const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 10;
  if (!isHorizontal) return false;
  if (activeIndex === 0 && dx > 0) return false;
  if (activeIndex === MAIN_SWIPE_TABS.length - 1 && dx < 0) return false;
  return activeIndex >= 0 && activeIndex < MAIN_SWIPE_TABS.length;
};

export const resolveSwipeTargetIndex = (
  activeIndex: number,
  dx: number,
  vx: number,
  screenWidth: number,
) => {
  const distanceThreshold = screenWidth * SWIPE_DISTANCE_RATIO;
  if (
    (dx < -distanceThreshold || vx < -SWIPE_VELOCITY_THRESHOLD) &&
    activeIndex < MAIN_SWIPE_TABS.length - 1
  ) {
    return activeIndex + 1;
  }
  if (
    (dx > distanceThreshold || vx > SWIPE_VELOCITY_THRESHOLD) &&
    activeIndex > 0
  ) {
    return activeIndex - 1;
  }
  return activeIndex;
};

interface SwipeTabContainerProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  renderScreen: (tab: MainTab) => React.ReactNode;
  tabPosition: Animated.Value;
}

const tabsToPrepare = (activeIndex: number) =>
  MAIN_SWIPE_TABS.filter((_, index) => Math.abs(index - activeIndex) <= 1);

export function SwipeTabContainer({
  activeTab,
  onTabChange,
  renderScreen,
  tabPosition,
}: SwipeTabContainerProps) {
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  const activeIndex = MAIN_SWIPE_TABS.indexOf(activeTab);
  const isMainTab = activeIndex !== -1;
  const [mountedTabs, setMountedTabs] = useState<Set<MainTab>>(
    () => new Set(tabsToPrepare(Math.max(0, activeIndex))),
  );
  const transitionIdRef = useRef(0);
  const stateRef = useRef({ activeIndex, isMainTab, screenWidth, onTabChange });

  useEffect(() => {
    stateRef.current = { activeIndex, isMainTab, screenWidth, onTabChange };
  }, [activeIndex, isMainTab, screenWidth, onTabChange]);

  useEffect(() => {
    transitionIdRef.current += 1;
    tabPosition.stopAnimation();
    if (isMainTab) {
      tabPosition.setValue(activeIndex);
      setMountedTabs((current) => {
        const next = new Set(current);
        for (const tab of tabsToPrepare(activeIndex)) next.add(tab);
        return next.size === current.size ? current : next;
      });
    }
  }, [activeIndex, isMainTab, tabPosition]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== screenWidth) setScreenWidth(width);
  };

  const settleAt = (targetIndex: number, commit: boolean) => {
    const transitionId = ++transitionIdRef.current;
    Animated.timing(tabPosition, {
      toValue: targetIndex,
      duration: commit ? 190 : 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || transitionId !== transitionIdRef.current || !commit) return;
      const targetTab = MAIN_SWIPE_TABS[targetIndex];
      if (targetTab) stateRef.current.onTabChange(targetTab);
    });
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const state = stateRef.current;
        return state.isMainTab && shouldStartMainTabSwipe(
          state.activeIndex,
          gestureState.dx,
          gestureState.dy,
        );
      },
      onMoveShouldSetPanResponderCapture: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const state = stateRef.current;
        return state.isMainTab && shouldStartMainTabSwipe(
          state.activeIndex,
          gestureState.dx,
          gestureState.dy,
        );
      },
      onPanResponderGrant: () => {
        transitionIdRef.current += 1;
        tabPosition.stopAnimation();
        tabPosition.setValue(stateRef.current.activeIndex);
      },
      onPanResponderMove: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const state = stateRef.current;
        if (state.screenWidth <= 0) return;
        const gesturePosition = state.activeIndex - gestureState.dx / state.screenWidth;
        tabPosition.setValue(Math.max(0, Math.min(MAIN_SWIPE_TABS.length - 1, gesturePosition)));
      },
      onPanResponderRelease: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const state = stateRef.current;
        const targetIndex = resolveSwipeTargetIndex(
          state.activeIndex,
          gestureState.dx,
          gestureState.vx,
          state.screenWidth,
        );
        settleAt(targetIndex, targetIndex !== state.activeIndex);
      },
      onPanResponderTerminate: () => settleAt(stateRef.current.activeIndex, false),
      onPanResponderTerminationRequest: () => false,
    }),
    [tabPosition],
  );

  if (!isMainTab) {
    return <View style={styles.container}>{renderScreen(activeTab)}</View>;
  }

  const preparedTabs = new Set(mountedTabs);
  for (const tab of tabsToPrepare(activeIndex)) preparedTabs.add(tab);
  const trackTranslateX = Animated.multiply(tabPosition, -screenWidth);

  return (
    <View style={styles.container} onLayout={handleLayout} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.track,
          {
            width: screenWidth * MAIN_SWIPE_TABS.length,
            transform: [{ translateX: trackTranslateX }],
          },
        ]}
      >
        {MAIN_SWIPE_TABS.map((tab) => (
          <View key={tab} style={[styles.screenWrapper, { width: screenWidth }]}>
            {preparedTabs.has(tab) ? renderScreen(tab) : null}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
  },
  screenWrapper: {
    height: '100%',
  },
});
