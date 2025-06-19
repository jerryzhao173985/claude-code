#!/usr/bin/env node

/**
 * Interactive demo application for testing IME input functionality
 * 
 * This demo allows testing of Japanese, Chinese, Korean, and other
 * IME input methods to verify the fix works correctly.
 */

import React, { useState, useCallback } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import { IMETextInput } from '../src/ime-text-input';
import { containsIMECharacters, requiresIME } from '../src/ime-handler';
import chalk from 'chalk';

interface DemoState {
  currentInput: string;
  history: string[];
  mode: 'input' | 'help' | 'stats';
  stats: {
    totalInputs: number;
    imeInputs: number;
    averageLength: number;
  };
}

const IMEDemo: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<DemoState>({
    currentInput: '',
    history: [],
    mode: 'input',
    stats: {
      totalInputs: 0,
      imeInputs: 0,
      averageLength: 0,
    },
  });
  
  const handleInputChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, currentInput: value }));
  }, []);
  
  const handleSubmit = useCallback((value: string) => {
    if (!value.trim()) return;
    
    const hasIME = containsIMECharacters(value);
    const newHistory = [...state.history, value];
    const totalInputs = state.stats.totalInputs + 1;
    const imeInputs = state.stats.imeInputs + (hasIME ? 1 : 0);
    const totalLength = newHistory.reduce((sum, str) => sum + str.length, 0);
    
    setState(prev => ({
      ...prev,
      currentInput: '',
      history: newHistory,
      stats: {
        totalInputs,
        imeInputs,
        averageLength: totalLength / totalInputs,
      },
    }));
  }, [state.history, state.stats]);
  
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    
    if (key.tab) {
      setState(prev => ({
        ...prev,
        mode: prev.mode === 'input' ? 'help' : prev.mode === 'help' ? 'stats' : 'input',
      }));
      return;
    }
    
    if (input === 'q' && state.mode !== 'input') {
      setState(prev => ({ ...prev, mode: 'input' }));
      return;
    }
    
    if (key.escape) {
      setState(prev => ({ ...prev, currentInput: '' }));
      return;
    }
  });
  
  const renderInput = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🌏 IME Input Demo - Test Japanese, Chinese, Korean input
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color="gray">
          Type any text (try: こんにちは, 你好, 안녕하세요) and press Enter
        </Text>
      </Box>
      
      <Box borderStyle="round" paddingX={1} marginBottom={1}>
        <Text color="yellow">Input: </Text>
        <IMETextInput 
          value={state.currentInput}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          placeholder="Type here (IME supported)..."
          focus={true}
          showCursor={true}
        />
      </Box>
      
      {state.history.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>Recent inputs:</Text>
          {state.history.slice(-5).map((input, index) => {
            const hasIME = containsIMECharacters(input);
            const chars = Array.from(input);
            return (
              <Box key={index} marginLeft={2}>
                <Text color={hasIME ? 'magenta' : 'white'}>
                  {hasIME ? '🌸' : '📝'} {input}
                  <Text color="dim"> ({chars.length} chars)</Text>
                  {hasIME && (
                    <Text color="cyan"> - Contains IME characters</Text>
                  )}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
      
      <Box flexDirection="column" marginTop={1}>
        <Text color="dim">Controls:</Text>
        <Text color="dim">  • Tab: Switch views (Input → Help → Stats)</Text>
        <Text color="dim">  • Escape: Clear current input</Text>
        <Text color="dim">  • Ctrl+C: Exit</Text>
      </Box>
    </Box>
  );
  
  const renderHelp = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          📚 IME Input Help
        </Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text color="yellow" bold>What is IME?</Text>
        <Text>
          IME (Input Method Editor) allows typing languages that have more characters
          than can fit on a keyboard, such as Japanese, Chinese, Korean, etc.
        </Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text color="yellow" bold>Test Examples:</Text>
        <Text color="green">🇯🇵 Japanese:</Text>
        <Text marginLeft={2}>• こんにちは (konnichiwa - hello)</Text>
        <Text marginLeft={2}>• ありがとう (arigatou - thank you)</Text>
        <Text marginLeft={2}>• さようなら (sayounara - goodbye)</Text>
        
        <Text color="green" marginTop={1}>🇨🇳 Chinese:</Text>
        <Text marginLeft={2}>• 你好 (nǐ hǎo - hello)</Text>
        <Text marginLeft={2}>• 谢谢 (xiè xiè - thank you)</Text>
        <Text marginLeft={2}>• 再见 (zài jiàn - goodbye)</Text>
        
        <Text color="green" marginTop={1}>🇰🇷 Korean:</Text>
        <Text marginLeft={2}>• 안녕하세요 (annyeonghaseyo - hello)</Text>
        <Text marginLeft={2}>• 감사합니다 (gamsahamnida - thank you)</Text>
        <Text marginLeft={2}>• 안녕히 가세요 (annyeonghi gaseyo - goodbye)</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text color="yellow" bold>Performance Features:</Text>
        <Text>• ⚡ Debounced input for smooth typing</Text>
        <Text>• 🎯 Frame rate limiting (60 FPS max)</Text>
        <Text>• 🔍 Visual composition indicators</Text>
        <Text>• ⏱️ Sub-50ms latency for IME input</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="dim">Press Tab to switch to Stats view, or 'q' to return to Input</Text>
      </Box>
    </Box>
  );
  
  const renderStats = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          📊 Input Statistics
        </Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={2}>
        <Text color="yellow" bold>Session Stats:</Text>
        <Text>📝 Total inputs: <Text color="green">{state.stats.totalInputs}</Text></Text>
        <Text>🌸 IME inputs: <Text color="magenta">{state.stats.imeInputs}</Text></Text>
        <Text>📏 Average length: <Text color="cyan">{state.stats.averageLength.toFixed(1)} chars</Text></Text>
        <Text>🎯 IME usage: <Text color="yellow">{
          state.stats.totalInputs > 0 
            ? `${((state.stats.imeInputs / state.stats.totalInputs) * 100).toFixed(1)}%`
            : '0%'
        }</Text></Text>
      </Box>
      
      {state.history.length > 0 && (
        <Box flexDirection="column" marginBottom={2}>
          <Text color="yellow" bold>All Inputs:</Text>
          {state.history.map((input, index) => {
            const hasIME = containsIMECharacters(input);
            const imeChars = Array.from(input).filter(requiresIME);
            return (
              <Box key={index} marginLeft={1}>
                <Text color={hasIME ? 'magenta' : 'white'}>
                  {index + 1}. {input}
                  <Text color="dim"> [{input.length} total, {imeChars.length} IME]</Text>
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color="dim">Press Tab to return to Input view, or 'q' to return to Input</Text>
      </Box>
    </Box>
  );
  
  return (
    <Box padding={1} flexDirection="column">
      {state.mode === 'input' && renderInput()}
      {state.mode === 'help' && renderHelp()}
      {state.mode === 'stats' && renderStats()}
    </Box>
  );
};

// Main entry point
if (require.main === module) {
  console.clear();
  render(<IMEDemo />);
}

export default IMEDemo;