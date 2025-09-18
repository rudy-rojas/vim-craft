// Visual effects processor for Neovim modes
class VisualEffectsProcessor {
  constructor() {
    this.modeProcessors = {
      'normal': this.processNormalMode.bind(this),
      'insert': this.processInsertMode.bind(this),
      'visual': this.processVisualMode.bind(this)
    };
  }
  
  // Helper method to create tokens - works with new VimToken structure
  createToken(content, type = 'text', cssClasses = [], originalToken = null) {
    let newToken;
    
    // If we have an original token and it has a copy method (VimToken), use it
    if (originalToken && typeof originalToken.copy === 'function') {
      newToken = originalToken.copy(content, type, cssClasses);
    } else if (typeof window !== 'undefined' && window.VimToken) {
      // Use VimToken constructor with new signature
      newToken = new window.VimToken(content, type, cssClasses);
      
      // Preserve context from original token when splitting
      if (originalToken && originalToken.context) {
        newToken.context = originalToken.context;
      }
    } else {
      // Fallback to basic token object with new structure
      newToken = {
        content,
        type,
        cssClasses: cssClasses || [],
        context: '',
        cursor: null,
        selected: false,
        isLastSelectedChar: false,
        // Legacy compatibility
        value: content,
        prismClasses: cssClasses || []
      };
      
      // Preserve context from original token when splitting
      if (originalToken && originalToken.context) {
        newToken.context = originalToken.context;
      }
    }
    
    // CRITICAL: Preserve originalHTML when splitting tokens
    // For split tokens, we need to generate their own originalHTML based on content
    if (originalToken && originalToken.originalHTML && content) {
      // If this is a partial token (split from original), generate appropriate originalHTML
      if (content === (originalToken.content || originalToken.value)) {
        // Full content match - use original HTML
        newToken.originalHTML = originalToken.originalHTML;
      } else {
        // Partial content - generate new HTML structure preserving Prism classes
        newToken.originalHTML = this.generatePartialHTML(content, originalToken);
      }
    } else if (originalToken && !originalToken.originalHTML) {
      // If original token doesn't have originalHTML, generate it
      newToken.originalHTML = this.generatePartialHTML(content, originalToken);
    }
    
    return newToken;
  }

  /**
   * Generate HTML for partial tokens that preserve Prism.js structure
   */
  generatePartialHTML(content, originalToken) {
    // Escape the content for HTML (use a simple escape function)
    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Get the CSS classes from the original token
    const cssClasses = originalToken.cssClasses || originalToken.prismClasses || [];
    
    // If we have a valid token type that's not just 'text', create the appropriate structure
    if (originalToken.type && originalToken.type !== 'text' && cssClasses.length > 0) {
      // Reconstruct the HTML with the same classes as the original
      return `<span class="${cssClasses.join(' ')}">${escapedContent}</span>`;
    }
    
    // For plain text tokens or tokens without classes, return plain text
    return escapedContent;
  }

  process(tokens, mode, selectionStart, selectionEnd) {
    const processor = this.modeProcessors[mode];
    if (!processor) return tokens;

    // Add position information to tokens if missing
    const tokensWithPositions = this.addPositionInfo(tokens);
    
    return processor(tokensWithPositions, selectionStart, selectionEnd);
  }

  // Helper to add position information to tokens
  addPositionInfo(tokens) {
    let position = 0;
    return tokens.map(token => {
      const content = token.content || token.value || '';
      const start = position;
      const end = position + content.length;
      position = end;
      
      // Add position info to token (non-mutating)
      return {
        ...token,
        start,
        end
      };
    });
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
        const insertCursor = this.createToken('', 'cursor', []);
        insertCursor.cursor = cursorClass;
        result.splice(i + 1, 0, insertCursor);
        break;
      }
      
      // Handle cursor within a token
      if (token.start <= position && position < token.end) {
        // Split token at cursor position
        const relativePos = position - token.start;
        const beforeCursor = (token.content || token.value).substring(0, relativePos);
        const atCursor = (token.content || token.value).charAt(relativePos);
        const afterCursor = (token.content || token.value).substring(relativePos + 1);

        const newTokens = [];
        
        if (beforeCursor) {
          newTokens.push(this.createToken(beforeCursor, token.type, token.cssClasses || token.prismClasses, token));
        }
        
        if (atCursor) {
          const cursorToken = this.createToken(atCursor, token.type, token.cssClasses || token.prismClasses, token);
          cursorToken.cursor = cursorClass;
          newTokens.push(cursorToken);
        } else if (cursorClass === 'cursor-insert') {
          // For insert mode, create an empty cursor token at the position
          const insertCursor = this.createToken('', 'cursor', []);
          insertCursor.cursor = cursorClass;
          newTokens.push(insertCursor);
        }
        
        if (afterCursor) {
          newTokens.push(this.createToken(afterCursor, token.type, token.cssClasses || token.prismClasses, token));
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
    const value = token.content || token.value;
    
    // Before selection
    if (token.start < selectionStart) {
      const beforeLength = selectionStart - token.start;
      tokens.push(this.createToken(
        value.substring(0, beforeLength),
        token.type,
        token.cssClasses || token.prismClasses,
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
            beforeLastChar,
            token.type,
            token.cssClasses || token.prismClasses,
            token
          );
          beforeToken.selected = true;
          tokens.push(beforeToken);
        }
        
        // El último carácter con cursor de bloque
        const lastChar = selectionValue.charAt(lastCharRelativePos);
        if (lastChar) {
          const lastCharToken = this.createToken(
            lastChar,
            token.type,
            token.cssClasses || token.prismClasses,
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
            remainingSelection,
            token.type,
            token.cssClasses || token.prismClasses,
            token
          );
          afterToken.selected = true;
          tokens.push(afterToken);
        }
      } else {
        // Este token NO contiene el último carácter, selección normal
        const selectionToken = this.createToken(
          selectionValue,
          token.type,
          token.cssClasses || token.prismClasses,
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
        value.substring(afterStartInToken),
        token.type,
        token.cssClasses || token.prismClasses,
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
    const escapedValue = this.escapeHtml(token.content || token.value);
    
    // Handle newlines specially
    if (token.type === 'newline') {
      if (token.selected) {
        return '<span class="visual-selection">\n</span>';
      }
      return '\n';
    }
    
    // Handle empty cursor tokens for insert mode
    if (token.type === 'cursor' && (token.content || token.value) === '') {
      return '<span class="cursor-insert"></span>';
    }
    
    // NEW APPROACH: Preserve original Prism.js HTML structure and add Vim effects as wrapper layers
    if (token.originalHTML) {
      return this.wrapWithVimEffects(token.originalHTML, token);
    }
    
    // Fallback for tokens without originalHTML (backwards compatibility)
    const classes = this.getTokenClasses(token);
    if (classes.length > 0) {
      return `<span class="${classes.join(' ')}">${escapedValue}</span>`;
    }
    return escapedValue;
  }

  /**
   * Wrap Prism.js original HTML with Vim visual effects without destroying the structure
   */
  wrapWithVimEffects(originalHTML, token) {
    // Get Vim-specific classes that need to be applied
    const vimClasses = [];
    
    // Add cursor class
    if (token.cursor) {
      vimClasses.push(token.cursor);
    }
    
    // Add visual block cursor class for last selected character
    if (token.isLastSelectedChar) {
      vimClasses.push('visual-block-cursor');
    }
    // Add selection class (but not if it's the last selected char, to avoid conflict)
    else if (token.selected) {
      vimClasses.push('visual-selection');
    }
    
    // If no Vim effects need to be applied, return original HTML
    if (vimClasses.length === 0) {
      return originalHTML;
    }
    
    // Wrap the original HTML with Vim effect classes
    return `<span class="${vimClasses.join(' ')}">${originalHTML}</span>`;
  }

  getTokenClasses(token) {
    const classes = [];
    
    // Add syntax highlighting class using the highlighter
    if (token.type && token.type !== 'text') {
      // Check if it's a VimToken with Prism classes
      // Add CSS classes from token (supports both cssClasses and prismClasses for compatibility)
      const tokenClasses = token.cssClasses || token.prismClasses;
      if (tokenClasses && tokenClasses.length > 0) {
        classes.push(...tokenClasses);
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
    
    // Tokenize the source code
    const tokens = highlighter.tokenize(sourceCode);
    
    // Apply visual effects based on mode
    const processedTokens = this.visualEffectsProcessor.process(
      tokens, 
      mode, 
      selectionStart, 
      selectionEnd
    );
    
    // Use the highlighter's own render method for proper Prism token rendering
    const renderedCode = highlighter.render(processedTokens);
    
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

