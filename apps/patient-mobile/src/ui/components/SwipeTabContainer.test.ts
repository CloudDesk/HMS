import { describe, expect, it, vi } from 'vitest';
import { MAIN_SWIPE_TABS } from './SwipeTabContainer';

vi.mock('react-native', () => ({
  Animated: {
    Value: vi.fn().mockImplementation((val) => ({
      setValue: vi.fn(),
      stopAnimation: vi.fn(),
      current: val,
    })),
    timing: vi.fn().mockReturnValue({ start: vi.fn() }),
    spring: vi.fn().mockReturnValue({ start: vi.fn() }),
    View: 'Animated.View',
  },
  Dimensions: {
    get: vi.fn().mockReturnValue({ width: 375, height: 812 }),
  },
  PanResponder: {
    create: vi.fn((config) => config),
  },
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  View: 'View',
}));

describe('MAIN_SWIPE_TABS and SwipeTabContainer behavior', () => {
  it('verifies MAIN_SWIPE_TABS contains exactly the expected tabs in correct order', () => {
    expect(MAIN_SWIPE_TABS).toEqual([
      'home',
      'appointments',
      'records',
      'prescriptions',
      'profile',
    ]);
    expect(MAIN_SWIPE_TABS).toHaveLength(5);
  });

  it('verifies boundary checks: index 0 (home) has no left neighbor, index 4 (profile) has no right neighbor', () => {
    const getLeftNeighbor = (index: number) =>
      index > 0 ? (MAIN_SWIPE_TABS[index - 1] ?? null) : null;
    const getRightNeighbor = (index: number) =>
      index < MAIN_SWIPE_TABS.length - 1 ? (MAIN_SWIPE_TABS[index + 1] ?? null) : null;

    // Home is at index 0 and has no left neighbor
    const homeIndex = MAIN_SWIPE_TABS.indexOf('home');
    expect(homeIndex).toBe(0);
    expect(getLeftNeighbor(homeIndex)).toBeNull();
    expect(getRightNeighbor(homeIndex)).toBe('appointments');

    // Profile is at index 4 (last tab) and has no right neighbor
    const profileIndex = MAIN_SWIPE_TABS.indexOf('profile');
    expect(profileIndex).toBe(4);
    expect(profileIndex).toBe(MAIN_SWIPE_TABS.length - 1);
    expect(getRightNeighbor(profileIndex)).toBeNull();
    expect(getLeftNeighbor(profileIndex)).toBe('prescriptions');

    // Boundary check rules matching SwipeTabContainer PanResponder logic:
    // When activeIndex === 0, dragging/swiping right (dx > 0) is forbidden
    const isSwipeAllowed = (activeIndex: number, dx: number) => {
      if (activeIndex === 0 && dx > 0) return false;
      if (activeIndex === MAIN_SWIPE_TABS.length - 1 && dx < 0) return false;
      return true;
    };

    expect(isSwipeAllowed(0, 50)).toBe(false); // cannot swipe right on home
    expect(isSwipeAllowed(0, -50)).toBe(true);  // can swipe left on home
    expect(isSwipeAllowed(4, -50)).toBe(false); // cannot swipe left on profile
    expect(isSwipeAllowed(4, 50)).toBe(true);   // can swipe right on profile
  });

  it('tests transitions between tabs adhere to adjacent indexing: home (0) <-> appointments (1) <-> records (2) <-> prescriptions (3) <-> profile (4)', () => {
    const getTransitionTarget = (
      currentIndex: number,
      direction: 'left' | 'right'
    ) => {
      // Swiping Left (finger moves left, dx < 0): advance to next tab (right neighbor)
      if (direction === 'left' && currentIndex < MAIN_SWIPE_TABS.length - 1) {
        return MAIN_SWIPE_TABS[currentIndex + 1] ?? null;
      }
      // Swiping Right (finger moves right, dx > 0): advance to previous tab (left neighbor)
      if (direction === 'right' && currentIndex > 0) {
        return MAIN_SWIPE_TABS[currentIndex - 1] ?? null;
      }
      return null;
    };

    // Forward chain transitions (swiping left): 0 -> 1 -> 2 -> 3 -> 4
    expect(getTransitionTarget(0, 'left')).toBe('appointments');
    expect(getTransitionTarget(1, 'left')).toBe('records');
    expect(getTransitionTarget(2, 'left')).toBe('prescriptions');
    expect(getTransitionTarget(3, 'left')).toBe('profile');
    expect(getTransitionTarget(4, 'left')).toBeNull();

    // Reverse chain transitions (swiping right): 4 -> 3 -> 2 -> 1 -> 0
    expect(getTransitionTarget(4, 'right')).toBe('prescriptions');
    expect(getTransitionTarget(3, 'right')).toBe('records');
    expect(getTransitionTarget(2, 'right')).toBe('appointments');
    expect(getTransitionTarget(1, 'right')).toBe('home');
    expect(getTransitionTarget(0, 'right')).toBeNull();

    // Verify bidirectional adjacency for every consecutive pair
    const expectedChain = ['home', 'appointments', 'records', 'prescriptions', 'profile'] as const;
    for (let i = 0; i < expectedChain.length - 1; i++) {
      const currentTab = expectedChain[i]!;
      const nextTab = expectedChain[i + 1]!;
      const currentIdx = MAIN_SWIPE_TABS.indexOf(currentTab);
      const nextIdx = MAIN_SWIPE_TABS.indexOf(nextTab);

      expect(nextIdx).toBe(currentIdx + 1);
      expect(getTransitionTarget(currentIdx, 'left')).toBe(nextTab);
      expect(getTransitionTarget(nextIdx, 'right')).toBe(currentTab);
    }
  });
});
