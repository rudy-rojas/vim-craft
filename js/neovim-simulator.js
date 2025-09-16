// Visual effects processor for Neovim modes
class VisualEffectsProcessor {
  constructor() {
    this.modeProcessors = {
      'normal': this.processNormalMode.bind(this),
      'insert': this.processInsertMode.bind(this),
      'visual': this.processVisualMode.bind(this)
    };
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
    
    for (let i = 0; i < result.length; i++) {
      const token = result[i];
      
      // Handle cursor at the exact end of a token (for insert mode)
      if (position === token.end && cursorClass === 'cursor-insert') {
        // Insert cursor after this token
        const insertCursor = new Token('cursor', '', position, position);
        insertCursor.cursor = cursorClass;
        result.splice(i + 1, 0, insertCursor);
        break;
      }
      
      // Handle cursor within a token
      if (token.start <= position && position < token.end) {
        // Split token at cursor position
        const relativePos = position - token.start;
        const beforeCursor = token.value.substring(0, relativePos);
        const atCursor = token.value.charAt(relativePos);
        const afterCursor = token.value.substring(relativePos + 1);

        const newTokens = [];
        
        if (beforeCursor) {
          newTokens.push(new Token(token.type, beforeCursor, token.start, token.start + beforeCursor.length));
        }
        
        if (atCursor) {
          const cursorToken = new Token(token.type, atCursor, position, position + 1);
          cursorToken.cursor = cursorClass;
          newTokens.push(cursorToken);
        } else if (cursorClass === 'cursor-insert') {
          // For insert mode, create an empty cursor token at the position
          const insertCursor = new Token('cursor', '', position, position);
          insertCursor.cursor = cursorClass;
          newTokens.push(insertCursor);
        }
        
        if (afterCursor) {
          newTokens.push(new Token(token.type, afterCursor, position + 1, token.end));
        }

        result.splice(i, 1, ...newTokens);
        break;
      }
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
          const newTokens = this.splitTokenForSelection(token, overlapStart, overlapEnd, lastSelectedPosition);
          result.splice(i, 1, ...newTokens);
          i += newTokens.length - 1; // Adjust index for added tokens
        }
      }
    }

    return result;
  }

  splitTokenForSelection(token, selectionStart, selectionEnd, lastSelectedPosition) {
    const tokens = [];
    const value = token.value;
    
    // Before selection
    if (token.start < selectionStart) {
      const beforeLength = selectionStart - token.start;
      tokens.push(new Token(
        token.type,
        value.substring(0, beforeLength),
        token.start,
        selectionStart
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
          const beforeToken = new Token(
            token.type,
            beforeLastChar,
            actualSelectionStart,
            actualSelectionStart + lastCharRelativePos
          );
          beforeToken.selected = true;
          tokens.push(beforeToken);
        }
        
        // El último carácter con cursor de bloque
        const lastChar = selectionValue.charAt(lastCharRelativePos);
        if (lastChar) {
          const lastCharToken = new Token(
            token.type,
            lastChar,
            lastSelectedPosition,
            lastSelectedPosition + 1
          );
          lastCharToken.selected = true;
          lastCharToken.isLastSelectedChar = true; // Marcamos como último carácter
          tokens.push(lastCharToken);
        }
        
        // Parte después del último carácter (si existe)
        const remainingSelection = selectionValue.substring(lastCharRelativePos + 1);
        if (remainingSelection) {
          const afterToken = new Token(
            token.type,
            remainingSelection,
            lastSelectedPosition + 1,
            actualSelectionEnd
          );
          afterToken.selected = true;
          tokens.push(afterToken);
        }
      } else {
        // Este token NO contiene el último carácter, selección normal
        const selectionToken = new Token(
          token.type,
          selectionValue,
          actualSelectionStart,
          actualSelectionEnd
        );
        selectionToken.selected = true;
        tokens.push(selectionToken);
      }
    }
    
    // After selection
    if (token.end > selectionEnd) {
      const afterStartInToken = selectionEnd - token.start;
      tokens.push(new Token(
        token.type,
        value.substring(afterStartInToken),
        selectionEnd,
        token.end
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
      const className = this.highlighter.getTokenClassName(token.type);
      if (className) {
        classes.push(className);
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
  constructor() {
    this.visualEffectsProcessor = new VisualEffectsProcessor();
  }

  processCode(sourceCode, highlighter, mode, selectionStart, selectionEnd) {
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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VisualEffectsProcessor,
    TokenRenderer,
    NeovimModeSimulator
  };
}
