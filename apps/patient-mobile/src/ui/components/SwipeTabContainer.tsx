import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
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

interface SwipeTabContainerProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  renderScreen: (tab: MainTab) => React.ReactNode;
}

export function SwipeTabContainer({
  activeTab,
  onTabChange,
  renderScreen,
}: SwipeTabContainerProps) {
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  const translateX = useRef(new Animated.Value(0)).current;

  // Track dragging state to render adjacent tab during drag
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null);

  const activeIndex = MAIN_SWIPE_TABS.indexOf(activeTab);
  const isMainTab = activeIndex !== -1;

  // Keep ref to latest props/state for PanResponder
  const stateRef = useRef({
    activeIndex,
    isMainTab,
    screenWidth,
    onTabChange,
  });

  useEffect(() => {
    stateRef.current = {
      activeIndex,
      isMainTab,
      screenWidth,
      onTabChange,
    };
  }, [activeIndex, isMainTab, screenWidth, onTabChange]);

  const handleLayout = (e: any) => {
    const width = e.nativeEvent?.layout?.width;
    if (width && width > 0 && width !== screenWidth) {
      setScreenWidth(width);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const { isMainTab, activeIndex } = stateRef.current;
        if (!isMainTab) return false;

        const { dx, dy } = gestureState;
        // Horizontal intent: dx must dominate dy significantly and exceed initial slop
        const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 10;
        if (!isHorizontal) return false;

        // Boundary checks:
        // If on first tab (Home), cannot swipe right (dx > 0)
        if (activeIndex === 0 && dx > 0) return false;
        // If on last tab (Profile), cannot swipe left (dx < 0)
        if (activeIndex === MAIN_SWIPE_TABS.length - 1 && dx < 0) return false;

        return true;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const { activeIndex } = stateRef.current;
        let dx = gestureState.dx;

        // Prevent dragging past boundaries
        if (activeIndex === 0 && dx > 0) {
          dx = 0;
        } else if (activeIndex === MAIN_SWIPE_TABS.length - 1 && dx < 0) {
          dx = 0;
        }

        if (dx < 0) {
          setDragDirection('right'); // dragging towards right tab (finger moves left)
        } else if (dx > 0) {
          setDragDirection('left'); // dragging towards left tab (finger moves right)
        }

        translateX.setValue(dx);
      },
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const { activeIndex, screenWidth, onTabChange } = stateRef.current;
        const { dx, vx } = gestureState;

        const distanceThreshold = screenWidth * 0.25;
        const velocityThreshold = 0.4;

        let targetTab: MainTab | null = null;
        let targetX = 0;

        // Swiping Left (finger moves to left, next tab on the right)
        if ((dx < -distanceThreshold || vx < -velocityThreshold) && activeIndex < MAIN_SWIPE_TABS.length - 1) {
          targetTab = MAIN_SWIPE_TABS[activeIndex + 1] ?? null;
          targetX = -screenWidth;
        }
        // Swiping Right (finger moves to right, previous tab on the left)
        else if ((dx > distanceThreshold || vx > velocityThreshold) && activeIndex > 0) {
          targetTab = MAIN_SWIPE_TABS[activeIndex - 1] ?? null;
          targetX = screenWidth;
        }

        if (targetTab) {
          Animated.timing(translateX, {
            toValue: targetX,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            setDragDirection(null);
            onTabChange(targetTab!);
          });
        } else {
          // Spring back to current tab
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
          }).start(() => {
            setDragDirection(null);
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }).start(() => {
          setDragDirection(null);
        });
      },
    })
  ).current;

  // If not a main swipe tab (e.g., secondary views like billing, dental, consents, documents, notifications),
  // render directly without gesture handlers
  if (!isMainTab) {
    return <View style={styles.container}>{renderScreen(activeTab)}</View>;
  }

  const adjacentTab: MainTab | null =
    dragDirection === 'right' && activeIndex < MAIN_SWIPE_TABS.length - 1
      ? (MAIN_SWIPE_TABS[activeIndex + 1] ?? null)
      : dragDirection === 'left' && activeIndex > 0
      ? (MAIN_SWIPE_TABS[activeIndex - 1] ?? null)
      : null;

  const adjacentOffset = dragDirection === 'right' ? screenWidth : -screenWidth;

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.slideContainer,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={[styles.screenWrapper, { width: screenWidth }]}>
          {renderScreen(activeTab)}
        </View>

        {adjacentTab && (
          <Animated.View
            style={[
              styles.screenWrapper,
              styles.adjacentScreen,
              {
                width: screenWidth,
                transform: [{ translateX: adjacentOffset }],
              },
            ]}
          >
            {renderScreen(adjacentTab)}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  slideContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  screenWrapper: {
    flex: 1,
    height: '100%',
  },
  adjacentScreen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
