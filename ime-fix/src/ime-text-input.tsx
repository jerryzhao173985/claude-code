import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';

export interface IMETextInputProps {
  value: string;
  placeholder?: string;
  focus?: boolean;
  mask?: string;
  highlightPastedText?: boolean;
  showCursor?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export interface IMECompositionState {
  isComposing: boolean;
  compositionText: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Enhanced TextInput component with proper IME (Input Method Editor) support
 * for Japanese, Chinese, Korean, and other languages that require composition.
 * 
 * This component addresses the performance issues in Claude Code when using
 * Asian input methods by properly handling composition events and debouncing
 * input to prevent excessive re-renders.
 */
export const IMETextInput: React.FC<IMETextInputProps> = ({
  value = '',
  placeholder = '',
  focus = true,
  mask,
  highlightPastedText = false,
  showCursor = true,
  onChange,
  onSubmit,
}) => {
  const [compositionState, setCompositionState] = useState <IMECompositionState>({
    isComposing: false,
    compositionText: '',
    selectionStart: 0,
    selectionEnd: 0,
  });
  
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const inputRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  
  // Debounced onChange to prevent performance issues during rapid IME input
  const debouncedOnChange = useCallback((newValue: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      onChange?.(newValue);
    }, 16); // ~60fps to maintain smooth input
  }, [onChange]);
  
  // Handle composition start (e.g., when user starts typing Japanese)
  const handleCompositionStart = useCallback(() => {
    setCompositionState(prev => ({
      ...prev,
      isComposing: true,
      compositionText: '',
    }));
  }, []);
  
  // Handle composition update (e.g., while typing "kon" -> "こん")
  const handleCompositionUpdate = useCallback((compositionText: string) => {
    setCompositionState(prev => ({
      ...prev,
      compositionText,
    }));
  }, []);
  
  // Handle composition end (e.g., when user selects "こんにちは")
  const handleCompositionEnd = useCallback((compositionText: string) => {
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    const newValue = beforeCursor + compositionText + afterCursor;
    
    setCompositionState({
      isComposing: false,
      compositionText: '',
      selectionStart: 0,
      selectionEnd: 0,
    });
    
    setCursorPosition(cursorPosition + compositionText.length);
    debouncedOnChange(newValue);
  }, [value, cursorPosition, debouncedOnChange]);
  
  // Handle regular keypress events
  const handleInput = useCallback((inputValue: string) => {
    // Don't process input during IME composition
    if (compositionState.isComposing) {
      return;
    }
    
    debouncedOnChange(inputValue);
    setCursorPosition(inputValue.length);
  }, [compositionState.isComposing, debouncedOnChange]);
  
  // Handle submit (Enter key)
  const handleSubmit = useCallback(() => {
    // Don't submit during IME composition
    if (compositionState.isComposing) {
      return;
    }
    
    onSubmit?.(value);
  }, [value, compositionState.isComposing, onSubmit]);
  
  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  const displayValue = useMemo(() => {
    if (mask && value) {
      return mask.repeat(value.length);
    }
    return value;
  }, [value, mask]);
  
  const renderText = () => {
    const beforeCursor = displayValue.substring(0, cursorPosition);
    const afterCursor = displayValue.substring(cursorPosition);
    
    // Show composition text with visual indicator
    if (compositionState.isComposing && compositionState.compositionText) {
      return (
        <Text>
          {beforeCursor}
          <Text color="yellow" inverse>
            {compositionState.compositionText}
          </Text>
          {showCursor && focus && <Text color="gray">█</Text>}
          {afterCursor}
        </Text>
      );
    }
    
    // Regular text display
    if (!displayValue && placeholder) {
      return (
        <Text color="gray">
          {placeholder}
          {showCursor && focus && <Text>█</Text>}
        </Text>
      );
    }
    
    return (
      <Text color={isHighlighted ? 'black' : undefined} backgroundColor={isHighlighted ? 'white' : undefined}>
        {beforeCursor}
        {showCursor && focus && <Text color="gray">█</Text>}
        {afterCursor}
      </Text>
    );
  };
  
  return (
    <Box>
      {renderText()}
      {compositionState.isComposing && (
        <Box marginLeft={1}>
          <Text color="dim">IME: {compositionState.compositionText || 'composing...'}</Text>
        </Box>
      )}
    </Box>
  );
};

export default IMETextInput;