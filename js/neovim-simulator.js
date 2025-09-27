// Visual effects processor for Neovim modes
class VisualEffectsProcessor {
  constructor() {
    this.modeProcessors = {
      'normal': this.processNormalMode.bind(this),
      'insert': this.processInsertMode.bind(this),
      'visual': this.processVisualMode.bind(this)
    };
  }
  
  // Helper method to create tokens - works with both Token and VimToken
  createToken(type, value, start, end, originalToken = null) {
    let newToken;
    
    // If we have an original token and it has a copy method (VimToken), use it
    if (originalToken && typeof originalToken.copy === 'function') {
      newToken = originalToken.copy(type, value, start, end);
    } else if (typeof window !== 'undefined' && window.VimToken) {
      // Check if we have VimToken available (from Prism integration)
      newToken = new window.VimToken(type, value, start, end);
      
      // Preserve Prism classes from original token when splitting
      if (originalToken && originalToken.prismClasses) {
        newToken.prismClasses = [...originalToken.prismClasses];
      }
    } else {
      // Fallback to basic token object
      newToken = {
        type,
        value,
        start,
        end,
        cursor: null,
        selected: false,
        isLastSelectedChar: false,
        prismClasses: []
      };
      
      // Preserve Prism classes from original token when splitting
      if (originalToken && originalToken.prismClasses) {
        newToken.prismClasses = [...originalToken.prismClasses];
      }
    }
    
    return newToken;
  }

  process(tokens, mode, selectionStart, selectionEnd) {
    const processor = this.modeProcessors[mode];
    if (!processor) return tokens;

    return processor(tokens, selectionStart, selectionEnd);
  }

  processNormalMode(tokens, selectionStart, selectionEnd) {
    return this.applyCursor(tokens, selectionStart, 'cursor');
  }

  processInsertMode(tokens, selectionStart, selectionEnd) {
    return this.applyCursor(tokens, selectionStart, 'cursor-insert');
  }

  processVisualMode(tokens, selectionStart, selectionEnd) {
    return this.applySelection(tokens, selectionStart, selectionEnd);
  }

  applyCursor(tokens, position, cursorClass) {
    const result = [...tokens];
    let cursorPlaced = false;

    // First pass: Check if any complex token can handle this position
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // Handle cursor within a token (primary case)
      if (token.start <= position && position <= token.end) {
        // Prioritize complex tokens - they handle nested structures
        if (token.isComplex) {
          // True ComplexVimToken with nested structure
          if (this.shouldSplitComplexTokenForCursor(token, position)) {
            // Apply character-level cursor within the complex token structure
            token.hasPartialCursor = true;
            token.partialCursorPosition = position;
            token.partialCursorClass = cursorClass;
          } else {
            // Apply cursor effects directly to the complex token
            this.applyCursorToComplexToken(token, position, cursorClass);
          }
          cursorPlaced = true;
          break;
        }
      }
    }

    // Second pass: If no complex token handled it, process simple tokens
    if (!cursorPlaced) {
      for (let i = 0; i < result.length; i++) {
        const token = result[i];

        // Handle cursor within a token (only simple tokens now)
        if (token.start <= position && position <= token.end && !token.isComplex) {
          if (typeof token.canBeSplit === 'function' && !token.canBeSplit()) {
            // Simple token that shouldn't be split (like property, selector)
            // BUT for cursor positioning, we ALWAYS want character-level precision
            // so we split despite canBeSplit = false
            const newTokens = this.splitTokenForCursor(token, position, cursorClass);
            result.splice(i, 1, ...newTokens);
            i += newTokens.length - 1; // Adjust index for added tokens
            cursorPlaced = true;
            break;
          } else {
            // Normal token - split as usual
            const newTokens = this.splitTokenForCursor(token, position, cursorClass);
            result.splice(i, 1, ...newTokens);
            i += newTokens.length - 1; // Adjust index for added tokens
            cursorPlaced = true;
            break;
          }
        }
      }
    }

    // Handle cursor at the exact end of any token (for insert mode)
    // Only if cursor wasn't already placed within a token
    if (!cursorPlaced && cursorClass === 'cursor-insert') {
      for (let i = 0; i < result.length; i++) {
        const token = result[i];
        if (position === token.end) {
          // Insert cursor after this token
          const insertCursor = this.createToken('cursor', '', position, position);
          insertCursor.cursor = cursorClass;
          result.splice(i + 1, 0, insertCursor);
          cursorPlaced = true;
          break;
        }
      }
    }

    // Fallback for Insert mode: handle positions not covered by any token
    // This covers gaps in tokenization (like newlines, spaces between tokens, etc.)
    if (!cursorPlaced && cursorClass === 'cursor-insert') {
      // Find where to insert the cursor based on position
      let insertPosition = result.length; // Default to end

      for (let i = 0; i < result.length; i++) {
        const token = result[i];
        if (position < token.start) {
          insertPosition = i;
          break;
        }
        // Also check if position is exactly at token.end - insert after this token
        else if (position === token.end) {
          insertPosition = i + 1;
          break;
        }
      }

      // Create cursor at the specific position
      const insertCursor = this.createToken('cursor', '', position, position);
      insertCursor.cursor = cursorClass;
      result.splice(insertPosition, 0, insertCursor);
    }

    return result;
  }

  applySelection(tokens, selectionStart, selectionEnd) {
    const result = [...tokens];

    // Calculamos la posición del último carácter seleccionado
    const lastSelectedPosition = selectionEnd - 1;

    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // Check if token overlaps with selection
      if (token.start < selectionEnd && token.end > selectionStart) {
        const overlapStart = Math.max(token.start, selectionStart);
        const overlapEnd = Math.min(token.end, selectionEnd);

        if (overlapStart < overlapEnd) {
          // Handle different types of tokens
          if (token.isComplex) {
            // True ComplexVimToken with nested structure
            if (this.shouldSplitComplexToken(token, overlapStart, overlapEnd)) {
              // Apply character-level selection within the complex token structure
              token.hasPartialSelection = true;
              token.partialSelectionStart = overlapStart;
              token.partialSelectionEnd = overlapEnd;
              token.partialLastSelectedPosition = lastSelectedPosition;

              // Ensure no conflicting whole-token properties are set
              token.selected = false;
              token.isLastSelectedChar = false;
            } else {
              // Apply selection effects directly to the complex token
              this.applySelectionToComplexToken(token, overlapStart, overlapEnd, lastSelectedPosition);
            }
          } else if (typeof token.canBeSplit === 'function' && !token.canBeSplit()) {
            // Simple token that shouldn't be split (like property, selector)
            // BUT we need to check if only part of it is selected
            const tokenStart = token.start;
            const tokenEnd = token.end;
            const isEntireTokenSelected = overlapStart <= tokenStart && overlapEnd >= tokenEnd;

            if (isEntireTokenSelected) {
              // Entire token is selected - apply selection to whole token
              this.applySelectionToComplexToken(token, overlapStart, overlapEnd, lastSelectedPosition);
            } else {
              // Only part is selected - we need to split despite canBeSplit = false
              const newTokens = this.splitTokenForSelection(token, overlapStart, overlapEnd, lastSelectedPosition);
              result.splice(i, 1, ...newTokens);
              i += newTokens.length - 1; // Adjust index for added tokens
            }
          } else {
            // Normal token - split as usual
            const newTokens = this.splitTokenForSelection(token, overlapStart, overlapEnd, lastSelectedPosition);
            result.splice(i, 1, ...newTokens);
            i += newTokens.length - 1; // Adjust index for added tokens
          }
        }
      }
    }

    return result;
  }

  /**
   * Determine if a ComplexVimToken should be split for selection
   */
  shouldSplitComplexToken(token, selectionStart, selectionEnd) {
    // For Visual mode selections, we ALWAYS want character-level precision
    // regardless of how much of the token is selected.
    // This ensures consistent behavior and avoids incorrect whole-token highlighting.
    return true;
  }

  /**
   * Convert ComplexVimToken to simple tokens for splitting
   */
  convertComplexTokenToSimple(complexToken) {
    if (!complexToken.isComplex) {
      return [complexToken];
    }

    // Create a simple VimToken with the same properties but no complex structure
    const simpleToken = this.createToken(
      complexToken.type,
      complexToken.value,
      complexToken.start,
      complexToken.end,
      complexToken
    );

    // Copy important properties
    if (complexToken.prismClasses) {
      simpleToken.prismClasses = [...complexToken.prismClasses];
    }

    return [simpleToken];
  }

  /**
   * Apply selection effects to ComplexVimToken without splitting
   */
  applySelectionToComplexToken(token, selectionStart, selectionEnd, lastSelectedPosition) {
    // Determine the type of selection effect to apply
    const tokenStart = token.start;
    const tokenEnd = token.end;

    // Always mark as selected if there's any overlap
    token.selected = true;

    // Check if this token contains the last selected character
    if (lastSelectedPosition >= tokenStart && lastSelectedPosition < tokenEnd) {
      token.isLastSelectedChar = true;
    }
  }

  splitTokenForSelection(token, selectionStart, selectionEnd, lastSelectedPosition) {
    const tokens = [];
    const value = token.value;
    
    // Before selection
    if (token.start < selectionStart) {
      const beforeLength = selectionStart - token.start;
      tokens.push(this.createToken(
        token.type,
        value.substring(0, beforeLength),
        token.start,
        selectionStart,
        token
      ));
    }
    
    // Selection part - Detectamos si contiene el último carácter seleccionado
    const selectionStartInToken = Math.max(0, selectionStart - token.start);
    const selectionEndInToken = Math.min(value.length, selectionEnd - token.start);
    const selectionValue = value.substring(selectionStartInToken, selectionEndInToken);
    
    if (selectionValue) {
      const actualSelectionStart = Math.max(token.start, selectionStart);
      const actualSelectionEnd = Math.min(token.end, selectionEnd);
      
      // Verificamos si este token contiene el último carácter seleccionado
      if (lastSelectedPosition >= actualSelectionStart && lastSelectedPosition < actualSelectionEnd) {
        // Este token contiene el último carácter, necesitamos dividirlo
        const lastCharRelativePos = lastSelectedPosition - actualSelectionStart;
        
        // Parte antes del último carácter (si existe)
        if (lastCharRelativePos > 0) {
          const beforeLastChar = selectionValue.substring(0, lastCharRelativePos);
          const beforeToken = this.createToken(
            token.type,
            beforeLastChar,
            actualSelectionStart,
            actualSelectionStart + lastCharRelativePos,
            token
          );
          beforeToken.selected = true;
          tokens.push(beforeToken);
        }
        
        // El último carácter con cursor de bloque
        const lastChar = selectionValue.charAt(lastCharRelativePos);
        if (lastChar) {
          const lastCharToken = this.createToken(
            token.type,
            lastChar,
            lastSelectedPosition,
            lastSelectedPosition + 1,
            token
          );
          lastCharToken.selected = true;
          lastCharToken.isLastSelectedChar = true; // Marcamos como último carácter
          tokens.push(lastCharToken);
        }
        
        // Parte después del último carácter (si existe)
        const remainingSelection = selectionValue.substring(lastCharRelativePos + 1);
        if (remainingSelection) {
          const afterToken = this.createToken(
            token.type,
            remainingSelection,
            lastSelectedPosition + 1,
            actualSelectionEnd,
            token
          );
          afterToken.selected = true;
          tokens.push(afterToken);
        }
      } else {
        // Este token NO contiene el último carácter, selección normal
        const selectionToken = this.createToken(
          token.type,
          selectionValue,
          actualSelectionStart,
          actualSelectionEnd,
          token
        );
        selectionToken.selected = true;
        tokens.push(selectionToken);
      }
    }
    
    // After selection
    if (token.end > selectionEnd) {
      const afterStartInToken = selectionEnd - token.start;
      tokens.push(this.createToken(
        token.type,
        value.substring(afterStartInToken),
        selectionEnd,
        token.end,
        token
      ));
    }
    
    return tokens;
  }

  /**
   * Determine if a ComplexVimToken should be split for cursor positioning
   */
  shouldSplitComplexTokenForCursor(token, cursorPosition) {
    // For cursor positioning, we ALWAYS want character-level precision
    // regardless of cursor position within the token
    // This ensures that even the first character gets individual cursor treatment
    return true;
  }

  /**
   * Apply cursor effects to ComplexVimToken without splitting
   */
  applyCursorToComplexToken(token, cursorPosition, cursorClass) {
    // Apply cursor directly to the token
    token.cursor = cursorClass;
  }

  /**
   * Split token for cursor positioning (similar to selection but simpler)
   */
  splitTokenForCursor(token, cursorPosition, cursorClass) {
    const tokens = [];
    const value = token.value;

    // Before cursor
    if (token.start < cursorPosition) {
      const beforeLength = cursorPosition - token.start;
      tokens.push(this.createToken(
        token.type,
        value.substring(0, beforeLength),
        token.start,
        cursorPosition,
        token
      ));
    }

    // Cursor character
    const cursorChar = value.charAt(cursorPosition - token.start);
    if (cursorChar) {
      const cursorToken = this.createToken(
        token.type,
        cursorChar,
        cursorPosition,
        cursorPosition + 1,
        token
      );
      cursorToken.cursor = cursorClass;
      tokens.push(cursorToken);
    } else if (cursorClass === 'cursor-insert') {
      // For insert mode, create an empty cursor token at the position
      const insertCursor = this.createToken('cursor', '', cursorPosition, cursorPosition);
      insertCursor.cursor = cursorClass;
      tokens.push(insertCursor);
    }

    // After cursor
    if (token.end > cursorPosition + 1) {
      const afterStartInToken = cursorPosition + 1 - token.start;
      tokens.push(this.createToken(
        token.type,
        value.substring(afterStartInToken),
        cursorPosition + 1,
        token.end,
        token
      ));
    }

    return tokens;
  }
}

// Token renderer
class TokenRenderer {
  constructor(highlighter) {
    this.highlighter = highlighter;
    this.escapeHtml = this.escapeHtml.bind(this);
  }

  render(tokens) {
    return tokens.map(token => this.renderToken(token)).join('');
  }

  renderToken(token) {
    // Handle ComplexVimToken with nested structure
    if (token.isComplex && typeof token.applyVimEffects === 'function') {
      // Check if this token has partial cursor
      if (token.hasPartialCursor && typeof token.applyCursorWithPosition === 'function') {
        return token.applyCursorWithPosition(
          token.partialCursorPosition,
          token.partialCursorClass
        );
      }
      // Check if this token has partial selection
      else if (token.hasPartialSelection && typeof token.applyVimEffectsWithPartialSelection === 'function') {
        return token.applyVimEffectsWithPartialSelection(
          token.partialSelectionStart,
          token.partialSelectionEnd,
          token.partialLastSelectedPosition
        );
      } else {
        return token.applyVimEffects();
      }
    }

    const escapedValue = this.escapeHtml(token.value);
    const classes = this.getTokenClasses(token);

    // Handle newlines specially
    if (token.type === 'newline') {
      if (token.selected) {
        return '<span class="visual-selection">\n</span>';
      }
      return '\n';
    }

    // Handle empty cursor tokens for insert mode
    if (token.type === 'cursor' && token.value === '') {
      return '<span class="cursor-insert"></span>';
    }

    if (classes.length > 0) {
      return `<span class="${classes.join(' ')}">${escapedValue}</span>`;
    }
    return escapedValue;
  }

  getTokenClasses(token) {
    const classes = [];
    
    // Add syntax highlighting class using the highlighter
    if (token.type && token.type !== 'text') {
      // Check if it's a VimToken with Prism classes
      if (token.prismClasses && token.prismClasses.length > 0) {
        classes.push(...token.prismClasses);
      } else if (this.highlighter && this.highlighter.getTokenClassName) {
        // Fallback to original highlighter
        const className = this.highlighter.getTokenClassName(token.type);
        if (className) {
          classes.push(className);
        }
      }
    }
    
    // Add cursor class
    if (token.cursor) {
      classes.push(token.cursor);
    }
    
    // Add visual block cursor class for last selected character
    if (token.isLastSelectedChar) {
      classes.push('visual-block-cursor');
    }
    // Add selection class (but not if it's the last selected char, to avoid conflict)
    else if (token.selected) {
      classes.push('visual-selection');
    }
    
    return classes;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Neovim mode simulator
class NeovimModeSimulator {
  constructor(highlighter = null) {
    this.visualEffectsProcessor = new VisualEffectsProcessor();
    this.highlighter = highlighter;
  }

  processCode(sourceCode, mode, selectionStart, selectionEnd) {
    // Use the highlighter passed in constructor or require it as parameter
    const highlighter = this.highlighter;
    if (!highlighter) {
      throw new Error('No highlighter available. Please initialize NeovimSimulator with a highlighter.');
    }
    
    // Create renderer with the specific highlighter
    const renderer = new TokenRenderer(highlighter);
    
    // Tokenize the source code
    const tokens = highlighter.tokenize(sourceCode);
    
    // Apply visual effects based on mode
    const processedTokens = this.visualEffectsProcessor.process(
      tokens, 
      mode, 
      selectionStart, 
      selectionEnd
    );
    
    // Render the tokens
    const renderedCode = renderer.render(processedTokens);
    
    // Add status bar based on mode
    const statusBar = this.generateStatusBar(mode);
    
    // Combine code with status bar
    return renderedCode + statusBar;
  }

  generateStatusBar(mode) {
    const modeText = mode.toUpperCase();
    return `\n<div class="status-bar-ide">-- ${modeText} --</div>`;
  }

  validateModeInput(mode, selectionStart, selectionEnd) {
    const errors = [];

    // Special handling for Insert mode with no selection
    if (mode === 'insert' && selectionStart === selectionEnd) {
      return { valid: true, errors: [] };
    }

    // For visual mode, require selection
    if (mode === 'visual' && selectionStart === selectionEnd) {
      errors.push('Please select some text in the source code for Visual mode');
    }

    // For other modes, require selection
    if (mode !== 'visual' && mode !== 'insert' && selectionStart === selectionEnd) {
      errors.push('Please select some text in the source code');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export for ES module usage
export {
    NeovimModeSimulator as NeovimSimulator // Export with alias for convenience
    ,
    TokenRenderer, VisualEffectsProcessor
};

