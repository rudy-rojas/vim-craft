// Prism.js integration layer for VimCraft
// This file integrates Prism.js as the base highlighting engine
// and adds Vim simulation capabilities on top

/**
 * Enhanced Token class that extends Prism's capabilities with Vim-specific features
 */
class VimToken {
  constructor(type, value, start, end, prismToken = null) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.end = end;
    
    // Vim-specific properties
    this.cursor = null;              // Para efectos de cursor
    this.selected = false;           // Para selección visual
    this.isLastSelectedChar = false; // Para marcar el último carácter seleccionado
    
    // Prism integration
    this.prismToken = prismToken;    // Reference to original Prism token
    this.prismClasses = [];          // CSS classes from Prism
  }
  
  /**
   * Create a copy of this VimToken with new position and value
   */
  copy(newType, newValue, newStart, newEnd) {
    const newToken = new VimToken(newType, newValue, newStart, newEnd, this.prismToken);
    
    // Preserve Prism classes
    newToken.prismClasses = [...this.prismClasses];
    
    // Preserve Vim-specific properties (but reset selection/cursor state)
    newToken.cursor = null;
    newToken.selected = false;
    newToken.isLastSelectedChar = false;
    
    return newToken;
  }
  
  /**
   * Create VimToken from Prism token
   */
  static fromPrismToken(prismToken, start, end) {
    // Handle edge cases where prismToken might be a string or invalid object
    if (typeof prismToken === 'string') {
      return new VimToken('text', prismToken, start, end);
    }

    if (!prismToken || typeof prismToken !== 'object') {
      console.warn('Invalid prismToken passed to fromPrismToken:', prismToken);
      return new VimToken('text', '', start, end);
    }

    const content = typeof prismToken.content === 'string' ? prismToken.content : '';
    const token = new VimToken(
      prismToken.type || 'text',
      content,
      start,
      end,
      prismToken
    );

    // Extract CSS classes from Prism token with better handling
    if (prismToken.type) {
      // Use a Set to avoid duplicates
      const classesSet = new Set(['token', prismToken.type]);

      // Handle aliases (important for CSS and HTML tokens)
      if (prismToken.alias) {
        if (Array.isArray(prismToken.alias)) {
          prismToken.alias.forEach(alias => classesSet.add(alias));
        } else {
          classesSet.add(prismToken.alias);
        }
      }

      // Convert Set back to array
      token.prismClasses = Array.from(classesSet);
    }

    return token;
  }
}

/**
 * Complex VimToken for handling nested token structures
 * This preserves the original Prism token structure while adding Vim capabilities
 */
class ComplexVimToken extends VimToken {
  constructor(type, value, start, end, prismToken = null, nestedStructure = null) {
    super(type, value, start, end, prismToken);

    // Store the nested structure for accurate rendering
    this.nestedStructure = nestedStructure;
    this.isComplex = true;
  }

  /**
   * Render the complex token with its nested structure
   */
  renderNested() {
    if (!this.nestedStructure) {
      return this.value;
    }

    return this.renderTokenStructure(this.nestedStructure);
  }

  /**
   * Recursively render token structure
   */
  renderTokenStructure(structure) {
    if (typeof structure === 'string') {
      return this.escapeHtml(structure);
    }

    if (structure && typeof structure === 'object') {
      const classes = ['token'];
      if (structure.type) {
        classes.push(structure.type);
      }
      if (structure.alias) {
        if (Array.isArray(structure.alias)) {
          classes.push(...structure.alias);
        } else {
          classes.push(structure.alias);
        }
      }

      let content = '';
      if (typeof structure.content === 'string') {
        content = this.escapeHtml(structure.content);
      } else if (Array.isArray(structure.content)) {
        content = structure.content.map(item => this.renderTokenStructure(item)).join('');
      }

      return `<span class="${classes.join(' ')}">${content}</span>`;
    }

    return '';
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Apply Vim effects (selection, cursor) to the complex token
   * For complex tokens, we need to handle them more carefully
   */
  applyVimEffects() {
    // For complex tokens, we want to preserve the PrismJS structure
    // but still apply Vim effects appropriately
    let result = this.renderNested();

    // Apply Vim-specific styling - but only if this token is affected
    if (this.selected || this.cursor || this.isLastSelectedChar) {
      // For complex tokens with Vim effects, we wrap the entire structure
      const vimClasses = [];

      if (this.isLastSelectedChar) {
        vimClasses.push('visual-block-cursor');
      } else if (this.selected) {
        vimClasses.push('visual-selection');
      }

      if (this.cursor) {
        vimClasses.push(this.cursor);
      }

      if (vimClasses.length > 0) {
        result = `<span class="${vimClasses.join(' ')}">${result}</span>`;
      }
    }

    return result;
  }

  /**
   * Enhanced rendering that can handle partial selection for complex tokens
   */
  applyVimEffectsWithPartialSelection(selectionStart, selectionEnd, lastSelectedPosition) {
    // For complex tokens with partial selection, ALWAYS use character-level precision
    // regardless of whether the selection covers the entire token or not
    const tokenStart = this.start;
    const tokenEnd = this.end;

    // Check if selection is within this token
    if (selectionStart < tokenEnd && selectionEnd > tokenStart) {
      const overlapStart = Math.max(tokenStart, selectionStart);
      const overlapEnd = Math.min(tokenEnd, selectionEnd);

      // ALWAYS use character-level selection for partial selection mode
      // This ensures consistent behavior and prevents whole-token highlighting
      return this.renderWithPartialSelection(overlapStart, overlapEnd, lastSelectedPosition);
    }

    // No selection effects
    return this.renderNested();
  }

  /**
   * Apply cursor effects to complex tokens with character-level precision
   */
  applyCursorWithPosition(cursorPosition, cursorClass) {
    const tokenStart = this.start;
    const tokenEnd = this.end;

    // Check if cursor is within this token
    if (cursorPosition >= tokenStart && cursorPosition <= tokenEnd) {
      // Apply character-level cursor within nested structure
      return this.renderWithPartialCursor(cursorPosition, cursorClass);
    }

    // No cursor effects
    return this.renderNested();
  }

  /**
   * Render with partial cursor applied to specific character within the nested structure
   */
  renderWithPartialCursor(cursorPosition, cursorClass) {
    console.log(`🖺 ComplexVimToken renderWithPartialCursor:`, {
      cursorPosition,
      cursorClass,
      tokenStart: this.start,
      tokenEnd: this.end,
      hasNestedStructure: !!this.nestedStructure,
      tokenValue: this.value?.substring(0, 20) || 'empty'
    });

    if (!this.nestedStructure) {
      console.log('🖺 Using simple partial cursor rendering');
      const result = this.applySimplePartialCursor(cursorPosition, cursorClass);
      console.log('🖺 Simple partial cursor result:', {
        hasResult: !!result,
        length: result?.length || 0,
        includesCursorClass: result?.includes(cursorClass) || false,
        preview: result?.substring(0, 100) || 'empty'
      });
      return result;
    }

    console.log('🖺 Using complex token structure cursor rendering');
    const cursorApplied = {applied: false}; // Track cursor application state
    const result = this.renderTokenStructureWithCursor(this.nestedStructure, cursorPosition, cursorClass, this.start, cursorApplied);
    console.log('🖺 Complex structure cursor result:', {
      hasResult: !!result,
      length: result?.length || 0,
      includesCursorClass: result?.includes(cursorClass) || false,
      preview: result?.substring(0, 100) || 'empty'
    });
    return result;
  }

  /**
   * Render with partial selection applied to specific characters within the nested structure
   */
  renderWithPartialSelection(selectionStart, selectionEnd, lastSelectedPosition) {
    if (!this.nestedStructure) {
      return this.applySimplePartialSelection(selectionStart, selectionEnd, lastSelectedPosition);
    }

    return this.renderTokenStructureWithSelection(this.nestedStructure, selectionStart, selectionEnd, lastSelectedPosition);
  }

  /**
   * Apply simple partial cursor for tokens without nested structure
   */
  applySimplePartialCursor(cursorPosition, cursorClass) {
    const tokenStart = this.start;
    const tokenEnd = this.end;
    const value = this.value;
    let result = '';
    let cursorApplied = false;

    console.log(`🖊 Simple partial cursor processing:`, {
      cursorPosition,
      tokenStart,
      tokenEnd,
      valueLength: value?.length || 0,
      value: value?.substring(0, 20) || 'empty'
    });

    for (let i = 0; i < value.length; i++) {
      const charPos = tokenStart + i;
      const char = value[i];
      const escapedChar = this.escapeHtml(char);

      if (charPos === cursorPosition) {
        console.log(`🎯 Cursor match at position ${charPos}, char: "${char}"`);
        result += `<span class="${cursorClass}">${escapedChar}</span>`;
        cursorApplied = true;
      } else {
        result += escapedChar;
      }
    }

    console.log(`🖊 Simple cursor result:`, {
      cursorApplied,
      resultLength: result.length,
      includesCursorClass: result.includes(cursorClass)
    });

    // Handle cursor at the exact end of the token (Insert mode)
    if (cursorPosition === tokenEnd) {
      result += `<span class="${cursorClass}"></span>`;
    }

    // Wrap in original token classes
    if (this.prismClasses && this.prismClasses.length > 0) {
      result = `<span class="${this.prismClasses.join(' ')}">${result}</span>`;
    }

    return result;
  }

  /**
   * Apply simple partial selection for tokens without nested structure
   */
  applySimplePartialSelection(selectionStart, selectionEnd, lastSelectedPosition) {
    const tokenStart = this.start;
    const value = this.value;
    let result = '';

    for (let i = 0; i < value.length; i++) {
      const charPos = tokenStart + i;
      const char = value[i];
      const escapedChar = this.escapeHtml(char);

      if (charPos >= selectionStart && charPos < selectionEnd) {
        if (charPos === lastSelectedPosition) {
          result += `<span class="visual-block-cursor">${escapedChar}</span>`;
        } else {
          result += `<span class="visual-selection">${escapedChar}</span>`;
        }
      } else {
        result += escapedChar;
      }
    }

    // Wrap in original token classes
    if (this.prismClasses && this.prismClasses.length > 0) {
      result = `<span class="${this.prismClasses.join(' ')}">${result}</span>`;
    }

    return result;
  }

  /**
   * Recursively render token structure with character-level cursor
   */
  renderTokenStructureWithCursor(structure, cursorPosition, cursorClass, currentPos = this.start, cursorApplied) {
    // Ensure cursorApplied has a valid default value
    if (!cursorApplied) {
      cursorApplied = {applied: false};
    }

    if (typeof structure === 'string') {
      let result = '';

      for (let i = 0; i < structure.length; i++) {
        const charPos = currentPos + i;
        const char = structure[i];
        const escapedChar = this.escapeHtml(char);

        if (charPos === cursorPosition && cursorApplied && !cursorApplied.applied) {
          result += `<span class="${cursorClass}">${escapedChar}</span>`;
          cursorApplied.applied = true; // Mark cursor as applied
        } else {
          result += escapedChar;
        }
      }

      // Handle cursor at the exact end of the string (Insert mode ONLY)
      const stringEnd = currentPos + structure.length;
      if (cursorPosition === stringEnd && cursorClass === 'cursor-insert' && cursorApplied && !cursorApplied.applied) {
        result += `<span class="${cursorClass}"></span>`;
        cursorApplied.applied = true; // Mark cursor as applied
      }

      return result;
    }

    if (structure && typeof structure === 'object') {
      const classes = ['token'];
      if (structure.type) {
        classes.push(structure.type);
      }
      if (structure.alias) {
        if (Array.isArray(structure.alias)) {
          classes.push(...structure.alias);
        } else {
          classes.push(structure.alias);
        }
      }

      let content = '';
      let pos = currentPos;

      if (typeof structure.content === 'string') {
        content = this.renderTokenStructureWithCursor(structure.content, cursorPosition, cursorClass, pos, cursorApplied);
      } else if (Array.isArray(structure.content)) {
        for (const item of structure.content) {
          const itemContent = this.renderTokenStructureWithCursor(item, cursorPosition, cursorClass, pos, cursorApplied);
          content += itemContent;

          // Update position based on the actual content length (recursive calculation)
          pos += this.calculateContentLength(item);
        }
      }

      // Handle cursor at the exact end of this token structure (Insert mode ONLY) and ONLY if not already applied
      const tokenLength = this.calculateContentLength(structure);
      const tokenEnd = currentPos + tokenLength;
      if (cursorPosition === tokenEnd && cursorClass === 'cursor-insert' && cursorApplied && !cursorApplied.applied) {
        content += `<span class="${cursorClass}"></span>`;
        cursorApplied.applied = true; // Mark cursor as applied
      }

      return `<span class="${classes.join(' ')}">${content}</span>`;
    }

    return '';
  }

  /**
   * Recursively render token structure with character-level selection
   */
  renderTokenStructureWithSelection(structure, selectionStart, selectionEnd, lastSelectedPosition, currentPos = this.start) {
    if (typeof structure === 'string') {
      let result = '';

      for (let i = 0; i < structure.length; i++) {
        const charPos = currentPos + i;
        const char = structure[i];
        const escapedChar = this.escapeHtml(char);

        if (charPos >= selectionStart && charPos < selectionEnd) {
          if (charPos === lastSelectedPosition) {
            result += `<span class="visual-block-cursor">${escapedChar}</span>`;
          } else {
            result += `<span class="visual-selection">${escapedChar}</span>`;
          }
        } else {
          result += escapedChar;
        }
      }

      return result;
    }

    if (structure && typeof structure === 'object') {
      const classes = ['token'];
      if (structure.type) {
        classes.push(structure.type);
      }
      if (structure.alias) {
        if (Array.isArray(structure.alias)) {
          classes.push(...structure.alias);
        } else {
          classes.push(structure.alias);
        }
      }

      let content = '';
      let pos = currentPos;

      if (typeof structure.content === 'string') {
        content = this.renderTokenStructureWithSelection(structure.content, selectionStart, selectionEnd, lastSelectedPosition, pos);
      } else if (Array.isArray(structure.content)) {
        for (const item of structure.content) {
          const itemContent = this.renderTokenStructureWithSelection(item, selectionStart, selectionEnd, lastSelectedPosition, pos);
          content += itemContent;

          // Update position based on the actual content length (recursive calculation)
          pos += this.calculateContentLength(item);
        }
      }

      return `<span class="${classes.join(' ')}">${content}</span>`;
    }

    return '';
  }

  /**
   * Calculate the total character length of any nested structure
   */
  calculateContentLength(item) {
    if (typeof item === 'string') {
      return item.length;
    }

    if (item && typeof item === 'object') {
      if (typeof item.content === 'string') {
        return item.content.length;
      } else if (Array.isArray(item.content)) {
        let totalLength = 0;
        for (const subItem of item.content) {
          totalLength += this.calculateContentLength(subItem);
        }
        return totalLength;
      }
    }

    return 0;
  }

  /**
   * Check if this token can be split for Vim effects
   * Complex tokens generally should not be split to preserve syntax highlighting
   */
  canBeSplit() {
    return false; // Complex tokens preserve their structure
  }
}

/**
 * Prism-powered highlighter with Vim capabilities
 */
class PrismVimHighlighter {
  constructor(language = 'javascript') {
    this.language = language;
    this.ensurePrismLoaded();
  }
  
  /**
   * Ensure Prism.js is available
   */
  ensurePrismLoaded() {
    if (typeof Prism === 'undefined') {
      console.warn('Prism.js not loaded. Falling back to basic highlighting.');
      this.useFallback = true;
    } else {
      this.useFallback = false;
      console.log('Prism.js is available');
      console.log('Available languages:', Object.keys(Prism.languages));
      
      // Ensure the language is loaded
      if (!Prism.languages[this.language]) {
        console.warn(`Language ${this.language} not loaded in Prism. Available languages:`, Object.keys(Prism.languages));
        
        // Try common fallbacks for HTML
        if (this.language === 'html' && Prism.languages.markup) {
          console.log('Using markup as fallback for HTML');
          this.language = 'markup';
        } else {
          console.warn(`No fallback available for ${this.language}. Using basic highlighting.`);
          this.useFallback = true;
        }
      } else {
        console.log(`Language ${this.language} is available in Prism`);
      }
    }
  }
  
  /**
   * Tokenize code using Prism.js with position tracking
   */
  tokenize(code) {
    console.group('🔤 [DEBUG TOKENIZACIÓN] Prism Processing');
    console.log('🎯 Language:', this.language);
    console.log('🔄 Using fallback:', this.useFallback);

    if (this.useFallback) {
      console.log('⚠️ Using fallback tokenization');
      const result = this.fallbackTokenize(code);
      console.groupEnd();
      return result;
    }

    try {
      console.log('📝 Code to tokenize (first 100 chars):', JSON.stringify(code.substring(0, 100)));
      if (code.length > 100) {
        console.log('📝 Code to tokenize (last 50 chars):', JSON.stringify(code.substring(code.length - 50)));
      }

      // Use Prism to tokenize
      const prismTokens = Prism.tokenize(code, Prism.languages[this.language]);

      // === DEBUG TOKENS PRISM ===
      console.group('🧩 [DEBUG PRISM TOKENS] Raw Prism Output');
      console.log('📊 Total Prism tokens:', prismTokens.length);
      console.log('🔍 Prism tokens structure:', prismTokens);

      // Análisis detallado de tipos de tokens
      const tokenTypes = {};
      const tokenSamples = [];
      prismTokens.forEach((token, index) => {
        if (typeof token === 'string') {
          tokenTypes['string'] = (tokenTypes['string'] || 0) + 1;
          if (tokenSamples.length < 5) {
            tokenSamples.push({ index, type: 'string', preview: JSON.stringify(token.substring(0, 20)) });
          }
        } else if (token && typeof token === 'object') {
          const type = token.type || 'unknown';
          tokenTypes[type] = (tokenTypes[type] || 0) + 1;
          if (tokenSamples.length < 5) {
            const preview = typeof token.content === 'string'
              ? JSON.stringify(token.content.substring(0, 20))
              : Array.isArray(token.content) ? `[Array ${token.content.length}]` : '[Object]';
            tokenSamples.push({ index, type, preview });
          }
        }
      });

      console.log('📈 Token type distribution:', tokenTypes);
      console.log('📋 Token samples:', tokenSamples);
      console.groupEnd();

      // Convert to VimTokens with position tracking
      const vimTokens = this.convertPrismTokensToVim(prismTokens, code);

      // === DEBUG VIM TOKENS ===
      console.group('⚡ [DEBUG VIM TOKENS] Conversion Results');
      console.log('📊 Total VimTokens created:', vimTokens.length);

      // Análisis de VimTokens
      const vimTokenTypes = {};
      const vimTokenSamples = [];
      let totalCoverage = 0;

      vimTokens.forEach((token, index) => {
        const type = token.isComplex ? 'ComplexVimToken' : 'VimToken';
        vimTokenTypes[type] = (vimTokenTypes[type] || 0) + 1;
        totalCoverage += (token.end - token.start);

        if (vimTokenSamples.length < 5) {
          vimTokenSamples.push({
            index,
            type,
            tokenType: token.type,
            start: token.start,
            end: token.end,
            length: token.end - token.start,
            preview: JSON.stringify(token.value?.substring(0, 20) || '')
          });
        }
      });

      console.log('📈 VimToken type distribution:', vimTokenTypes);
      console.log('📋 VimToken samples:', vimTokenSamples);
      console.log('📏 Total character coverage:', totalCoverage, '/', code.length);

      if (totalCoverage !== code.length) {
        console.warn('⚠️ Coverage mismatch! Tokens do not cover entire code length');
      }

      // Verificar continuidad de posiciones
      let prevEnd = 0;
      const gaps = [];
      vimTokens.forEach((token, index) => {
        if (token.start !== prevEnd) {
          gaps.push({ after: index - 1, gap: [prevEnd, token.start] });
        }
        prevEnd = token.end;
      });

      if (gaps.length > 0) {
        console.warn('⚠️ Position gaps detected:', gaps);
      } else {
        console.log('✅ Position continuity verified');
      }

      console.groupEnd();
      console.groupEnd(); // Close main tokenization group

      return vimTokens;
    } catch (error) {
      console.error('Prism tokenization failed:', error);
      return this.fallbackTokenize(code);
    }
  }
  
  /**
   * Convert Prism tokens to VimTokens with accurate position tracking
   * Now preserves nested structure for complex tokens
   */
  convertPrismTokensToVim(prismTokens, originalCode) {
    const vimTokens = [];
    let position = 0;

    const processToken = (token, currentPos) => {
      if (typeof token === 'string') {
        // Simple string token
        if (token.length > 0) {
          // Special handling for newlines
          if (token === '\n') {
            const vimToken = new VimToken('newline', token, currentPos, currentPos + token.length);
            vimTokens.push(vimToken);
          } else {
            const vimToken = new VimToken('text', token, currentPos, currentPos + token.length);
            vimTokens.push(vimToken);
          }
          return currentPos + token.length;
        }
        return currentPos;
      } else if (token && typeof token === 'object') {
        const startPos = currentPos;
        const tokenText = this.extractTokenText(token);

        // Handle undefined or null content
        if (!tokenText) {
          console.warn('Token with no extractable text:', token);
          return currentPos;
        }

        const endPos = startPos + tokenText.length;

        // Check if this is a complex token that should preserve structure
        if (this.shouldPreserveStructure(token)) {
          // For tokens with nested structure, use ComplexVimToken
          if (Array.isArray(token.content)) {
            const complexToken = new ComplexVimToken(
              token.type || 'text',
              tokenText,
              startPos,
              endPos,
              token,
              token // Pass the entire token as nested structure
            );

            // Set basic Prism classes
            if (token.type) {
              complexToken.prismClasses = ['token', token.type];
              if (token.alias) {
                if (Array.isArray(token.alias)) {
                  complexToken.prismClasses.push(...token.alias);
                } else {
                  complexToken.prismClasses.push(token.alias);
                }
              }
            }

            vimTokens.push(complexToken);
            return endPos;
          } else {
            // Simple token that should be preserved but has string content
            // Use VimToken but mark it as non-splittable
            const vimToken = VimToken.fromPrismToken(token, startPos, endPos);
            vimToken.canBeSplit = () => false; // Mark as non-splittable
            vimTokens.push(vimToken);
            return endPos;
          }
        } else {
          // Normal token - use the original logic
          const vimToken = VimToken.fromPrismToken(token, startPos, endPos);
          vimTokens.push(vimToken);
          return endPos;
        }
      }
      return currentPos;
    };

    // Process all tokens
    for (const token of prismTokens) {
      try {
        position = processToken(token, position);
      } catch (error) {
        console.error('Error processing token:', token, error);
        // Try to recover by treating as string if possible
        if (typeof token === 'string' && token.length > 0) {
          const vimToken = new VimToken('text', token, position, position + token.length);
          vimTokens.push(vimToken);
          position += token.length;
        }
      }
    }

    // Handle any remaining text
    if (position < originalCode.length) {
      const remaining = originalCode.substring(position);
      if (remaining.length > 0) {
        vimTokens.push(new VimToken('text', remaining, position, originalCode.length));
      }
    }

    console.log('Final VimTokens:', vimTokens);
    return vimTokens;
  }

  /**
   * Extract the complete text content from a token (including nested content)
   */
  extractTokenText(token) {
    if (typeof token === 'string') {
      return token;
    }

    if (token && typeof token === 'object') {
      const content = token.content;

      if (typeof content === 'string') {
        return content;
      } else if (Array.isArray(content)) {
        return content.map(item => this.extractTokenText(item)).join('');
      }
    }

    return '';
  }

  /**
   * Determine if a token should preserve its nested structure
   */
  shouldPreserveStructure(token) {
    if (!token || typeof token !== 'object' || !token.type) {
      return false;
    }

    // These token types should ALWAYS be preserved to maintain proper syntax highlighting
    // ONLY preserve types that genuinely need complex nested structure
    const alwaysPreserveTypes = [
      'atrule',      // @import, @media, etc. - can have complex nested content
      'url',         // url() functions - can have nested content
      'tag',         // HTML tags - can have nested attributes
      'function',    // CSS functions like rgba(), calc(), etc. - can have nested content
      'selector',    // CSS selectors - can have complex nested structure
      'property',    // CSS properties - needed for CSS-specific behavior
      'important',   // !important - specific CSS construct
      'rule'         // CSS rules like @import, @media, etc. - can have nested content

      // REMOVED SIMPLE TYPES for better cursor placement:
      // 'string',      // String literals - simple tokens
      // 'comment',     // Comments - simple tokens
      // 'number',      // Numbers - simple tokens
      // 'keyword',     // Keywords - simple tokens
      // 'punctuation', // Punctuation - simple tokens
      // 'operator',    // Operators - simple tokens
      // 'variable',    // Variables - simple tokens
      // 'class-name',  // Class names - simple tokens
      // 'boolean',     // Boolean values - simple tokens
    ];

    // Always preserve these types regardless of content structure
    if (alwaysPreserveTypes.includes(token.type)) {
      return true;
    }

    // For other types, only preserve if they have complex nested structure
    return Array.isArray(token.content);
  }
  
  /**
   * Fallback tokenization when Prism is not available
   */
  fallbackTokenize(code) {
    // Simple fallback - treat everything as text
    return [new VimToken('text', code, 0, code.length)];
  }
  
  /**
   * Get CSS classes for a VimToken
   */
  getTokenClasses(vimToken) {
    const classes = [];
    
    // Add Prism classes if available
    if (vimToken.prismClasses.length > 0) {
      classes.push(...vimToken.prismClasses);
    }
    
    // Add Vim-specific classes
    if (vimToken.cursor) {
      classes.push(vimToken.cursor);
    }
    
    if (vimToken.isLastSelectedChar) {
      classes.push('visual-block-cursor');
    } else if (vimToken.selected) {
      classes.push('visual-selection');
    }
    
    return classes;
  }
  
  /**
   * Get token class name (compatibility method for old system)
   */
  getTokenClassName(tokenType) {
    // Map basic token types to Prism classes
    const typeMap = {
      'keyword': 'token keyword',
      'string': 'token string',
      'comment': 'token comment',
      'number': 'token number',
      'operator': 'token operator',
      'punctuation': 'token punctuation',
      'function': 'token function',
      'variable': 'token variable',
      'class': 'token class-name',
      'text': ''
    };
    
    return typeMap[tokenType] || 'token';
  }
  
  /**
   * Render a single token to HTML
   */
  renderToken(vimToken) {
    // Handle ComplexVimToken with nested structure
    if (vimToken.isComplex && vimToken instanceof ComplexVimToken) {
      // Check if this token has partial selection
      if (vimToken.hasPartialSelection && typeof vimToken.applyVimEffectsWithPartialSelection === 'function') {
        return vimToken.applyVimEffectsWithPartialSelection(
          vimToken.partialSelectionStart,
          vimToken.partialSelectionEnd,
          vimToken.partialLastSelectedPosition
        );
      } else {
        return vimToken.applyVimEffects();
      }
    }

    const classes = this.getTokenClasses(vimToken);
    const escapedValue = this.escapeHtml(vimToken.value);

    // Handle newlines specially
    if (vimToken.type === 'newline') {
      if (vimToken.selected) {
        return '<span class="visual-selection">\n</span>';
      }
      return '\n';
    }

    // Handle empty cursor tokens for insert mode
    if (vimToken.type === 'cursor' && vimToken.value === '') {
      return '<span class="cursor-insert"></span>';
    }

    if (classes.length > 0) {
      return `<span class="${classes.join(' ')}">${escapedValue}</span>`;
    }

    return escapedValue;
  }
  
  /**
   * Render all tokens to HTML
   */
  render(vimTokens) {
    return vimTokens.map(token => this.renderToken(token)).join('');
  }
  
  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Factory for creating Prism-powered highlighters
 */
class PrismVimHighlighterFactory {
  /**
   * Create a highlighter for the specified language
   */
  static create(language) {
    return new PrismVimHighlighter(language);
  }
  
  /**
   * Create a highlighter for the specified language (alias for create)
   */
  static createHighlighter(language) {
    return this.create(language);
  }
  
  /**
   * Get supported languages from Prism
   */
  static getSupportedLanguages() {
    if (typeof Prism === 'undefined') {
      return ['javascript', 'typescript', 'python', 'css', 'html', 'java', 'swift'];
    }
    
    // Return languages available in Prism
    return Object.keys(Prism.languages).filter(lang => 
      lang !== 'extend' && 
      lang !== 'insertBefore' && 
      lang !== 'DFS' &&
      typeof Prism.languages[lang] === 'object'
    );
  }
  
  /**
   * Check if Prism.js is loaded and ready
   */
  static isPrismAvailable() {
    return typeof Prism !== 'undefined' && Prism.languages;
  }
  
  /**
   * Load Prism.js dynamically if not available
   */
  static async loadPrism(components = []) {
    if (this.isPrismAvailable()) {
      return true;
    }
    
    return new Promise((resolve, reject) => {
      // Load core Prism from local file
      const coreScript = document.createElement('script');
      coreScript.src = './vendor/prism/prism-core.js';  // Local file
      coreScript.onload = () => {
        // Load additional components if specified
        if (components.length > 0) {
          this.loadPrismComponents(components).then(resolve).catch(reject);
        } else {
          resolve(true);
        }
      };
      coreScript.onerror = () => reject(new Error('Failed to load local Prism.js'));
      document.head.appendChild(coreScript);
    });
  }
  
  /**
   * Load specific Prism components from local files
   */
  static async loadPrismComponents(components) {
    const promises = components.map(component => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `./vendor/prism/components/prism-${component}.js`;  // Local file
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load local prism-${component}.js`));
        document.head.appendChild(script);
      });
    });
    
    return Promise.all(promises);
  }
}

// Export for ES module usage
export {
    PrismVimHighlighter,
    PrismVimHighlighterFactory,
    VimToken,
    ComplexVimToken
};

// Make VimToken and ComplexVimToken globally available for compatibility
if (typeof window !== 'undefined') {
  window.VimToken = VimToken;
  window.ComplexVimToken = ComplexVimToken;
}
