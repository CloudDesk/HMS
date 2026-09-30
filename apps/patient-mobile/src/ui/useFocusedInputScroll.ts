import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, TextInput, type NativeSyntheticEvent, type NativeScrollEvent, type ScrollView } from 'react-native';

export function focusedInputScrollDelta(inputTop: number, inputHeight: number, viewportTop: number, viewportBottom: number) {
  if (inputTop + inputHeight > viewportBottom - 16) return inputTop + inputHeight - viewportBottom + 16;
  if (inputTop < viewportTop + 16) return inputTop - viewportTop - 16;
  return 0;
}

// Let KeyboardAvoidingView size the viewport; scroll only the focused input.
export function useFocusedInputScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const frame = useRef<number | null>(null);
  const ensureVisible = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input) return;
      scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (TextInput.State.currentlyFocusedInput() !== input) return;
          const viewportBottom = Math.min(viewportTop + viewportHeight, Keyboard.metrics()?.screenY ?? Infinity);
          const delta = focusedInputScrollDelta(inputTop, inputHeight, viewportTop, viewportBottom);
          if (delta) scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: true });
        });
      });
    });
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', ensureVisible);
    return () => {
      show.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [ensureVisible]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);
  return { scrollRef, onInputFocus: ensureVisible, ensureVisible, onScroll };
}
