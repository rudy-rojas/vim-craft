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
    console.log('🎯 [CURSOR DEBUG] Normal mode processing started', {
      totalTokens: tokens.length,
      cursorPosition: selectionStart,
      mode: 'normal'
    });
    return this.applySimpleCursor(tokens, selectionStart, 'cursor');
  }

  processInsertMode(tokens, selectionStart, selectionEnd) {
    return this.applyInsertCursor(tokens, selectionStart, 'cursor-insert');
  }

  processVisualMode(tokens, selectionStart, selectionEnd) {
    return this.applySelection(tokens, selectionStart, selectionEnd);
  }

  /**
   * SIMPLE CURSOR APPLICATION - NEVER FAILS
   * Objetivo: Poner cursor EN el carácter especificado
   */
  applySimpleCursor(tokens, position, cursorClass) {
    console.log('🎯 [CURSOR DEBUG] Applying simple cursor', {
      position,
      cursorClass,
      totalTokens: tokens.length
    });

    const result = [...tokens];

    // Estrategia simple: buscar el token que contenga la posición
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // ¿La posición está dentro de este token?
      if (token.start <= position && position < token.end) {
        console.log('🎯 [CURSOR DEBUG] Found token containing cursor position', {
          tokenIndex: i,
          tokenType: token.type,
          tokenValue: token.value,
          tokenStart: token.start,
          tokenEnd: token.end,
          position,
          isComplex: token.isComplex,
          prismClasses: token.prismClasses || []
        });

        // Caso especial: Token complejo (Prism)
        if (token.isComplex && typeof token.renderWithPartialCursor === 'function') {
          console.log('🎯 [CURSOR DEBUG] Using complex token rendering for enhanced cursor compatibility');
          try {
            const renderedHtml = token.renderWithPartialCursor(position, cursorClass);

            // Marcar el token como pre-renderizado
            token.preRenderedHtml = renderedHtml;
            token.hasPartialCursor = true;
            token.partialCursorPosition = position;
            token.partialCursorClass = cursorClass;

            console.log('🎯 [CURSOR DEBUG] Complex token cursor applied successfully', {
              renderedLength: renderedHtml.length,
              includesCursor: renderedHtml.includes('cursor'),
              previewHtml: renderedHtml.substring(0, 100)
            });

            return result;
          } catch (error) {
            console.log('🎯 [CURSOR DEBUG] Complex token failed, falling back to simple split:', error);
            // Continúa con split simple
          }
        }

        // Token simple: dividirlo en el punto del cursor
        const newTokens = this.splitTokenSimple(token, position, cursorClass);
        result.splice(i, 1, ...newTokens);
        return result;
      }
    }

    // Fallback: posición no encontrada en ningún token
    console.log('⚠️ [CURSOR DEBUG] Position not found in any token, creating standalone cursor', {
      position,
      cursorClass
    });
    return this.createStandaloneCursor(result, position, cursorClass);
  }

  /**
   * Divide un token simple en el punto del cursor
   */
  splitTokenSimple(token, position, cursorClass) {
    const tokens = [];
    const value = token.value || '';
    const relativePos = position - token.start;

    console.log('✂️ [CURSOR DEBUG] Splitting token for cursor', {
      originalToken: {
        type: token.type,
        value: token.value,
        start: token.start,
        end: token.end,
        isComplex: token.isComplex,
        prismClasses: token.prismClasses || []
      },
      position,
      relativePos,
      cursorClass,
      willForceSimpleForComplexToken: token.isComplex
    });

    // Para ComplexVimToken que lleguen aquí (fallback), extraer clases correctamente
    if (token.isComplex) {
      console.log('✂️ [CURSOR DEBUG] Processing ComplexVimToken as fallback (complex rendering failed)', {
        tokenType: token.type,
        hasNestedStructure: token.hasNestedStructure,
        flattenedClasses: token.prismClasses || []
      });
    }

    // Validación
    if (relativePos < 0 || relativePos >= value.length) {
      console.log('⚠️ [CURSOR DEBUG] Invalid cursor position, returning original token');
      return [token]; // Devolver token original si la posición es inválida
    }

    // Parte ANTES del cursor
    if (relativePos > 0) {
      const beforePart = value.substring(0, relativePos);
      const beforeToken = this.createToken(
        token.type,
        beforePart,
        token.start,
        token.start + relativePos,
        token
      );
      tokens.push(beforeToken);
      console.log('✂️ [CURSOR DEBUG] Created before-cursor token', {
        value: beforePart,
        prismClasses: beforeToken.prismClasses || []
      });
    }

    // Carácter CON cursor
    const cursorChar = value.charAt(relativePos);
    const cursorToken = this.createToken(
      token.type,
      cursorChar,
      position,
      position + 1,
      token
    );
    cursorToken.cursor = cursorClass; // Marcar con cursor
    tokens.push(cursorToken);

    console.log('✂️ [CURSOR DEBUG] Created cursor token', {
      character: cursorChar,
      cursorClass,
      tokenType: cursorToken.type,
      prismClasses: cursorToken.prismClasses || [],
      position: position,
      cursorProperty: cursorToken.cursor
    });

    // Parte DESPUÉS del cursor
    if (relativePos < value.length - 1) {
      const afterPart = value.substring(relativePos + 1);
      const afterToken = this.createToken(
        token.type,
        afterPart,
        position + 1,
        token.end,
        token
      );
      tokens.push(afterToken);
      console.log('✂️ [CURSOR DEBUG] Created after-cursor token', {
        value: afterPart,
        prismClasses: afterToken.prismClasses || []
      });
    }

    console.log('✂️ [CURSOR DEBUG] Split complete', {
      originalTokens: 1,
      newTokens: tokens.length,
      cursorTokenIndex: tokens.findIndex(t => t.cursor)
    });

    return tokens;
  }

  /**
   * Crea un cursor independiente cuando no se encuentra en ningún token
   */
  createStandaloneCursor(result, position, cursorClass) {
    // Encontrar dónde insertar el cursor
    let insertIndex = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i].start > position) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    // Crear token de cursor vacío
    const cursorToken = this.createToken('cursor', '', position, position);
    cursorToken.cursor = cursorClass;
    result.splice(insertIndex, 0, cursorToken);

    return result;
  }

  /**
   * INSERT MODE CURSOR - Coloca el cursor ENTRE caracteres, no EN un carácter
   * A diferencia del modo Normal, Insert mode muestra el cursor como una línea vertical
   * entre caracteres, indicando dónde se insertará el próximo carácter
   */
  applyInsertCursor(tokens, position, cursorClass) {
    const result = [...tokens];

    // Buscar el token que contenga o preceda inmediatamente la posición
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // Caso 1: Posición está DENTRO del token (dividir el token)
      if (token.start < position && position < token.end) {
        // Caso especial: Token complejo (Prism) - para INSERT mode
        if (token.isComplex && typeof token.renderWithPartialCursor === 'function') {
          try {
            // Para INSERT mode, necesitamos renderizar con un cursor especial entre caracteres
            const renderedHtml = token.renderWithPartialCursor(position, cursorClass);

            // Marcar el token como pre-renderizado para INSERT
            token.preRenderedHtml = renderedHtml;
            token.hasPartialCursor = true;
            token.partialCursorPosition = position;
            token.partialCursorClass = cursorClass;

            return result;
          } catch (error) {
            // Continúa con split simple
          }
        }

        const newTokens = this.splitTokenForInsert(token, position, cursorClass);
        result.splice(i, 1, ...newTokens);
        return result;
      }

      // Caso 2: Posición está al INICIO del token (insertar cursor antes)
      if (position === token.start) {
        const cursorToken = this.createToken('cursor', '', position, position);
        cursorToken.cursor = cursorClass;
        result.splice(i, 0, cursorToken);
        return result;
      }

      // Caso 3: Posición está al FINAL del token (insertar cursor después)
      if (position === token.end) {
        const cursorToken = this.createToken('cursor', '', position, position);
        cursorToken.cursor = cursorClass;
        result.splice(i + 1, 0, cursorToken);
        return result;
      }
    }

    // Fallback: Posición no encontrada, crear cursor independiente
    return this.createStandaloneInsertCursor(result, position, cursorClass);
  }

  /**
   * Divide un token para insertar cursor INSERT entre caracteres
   */
  splitTokenForInsert(token, position, cursorClass) {
    const tokens = [];
    const value = token.value || '';
    const relativePos = position - token.start;

    // Validación
    if (relativePos <= 0 || relativePos >= value.length) {
      return [token]; // Devolver token original si la posición es inválida
    }

    // Parte ANTES del cursor (desde inicio hasta posición)
    const beforePart = value.substring(0, relativePos);
    const beforeToken = this.createToken(
      token.type,
      beforePart,
      token.start,
      token.start + relativePos,
      token
    );
    tokens.push(beforeToken);

    // Cursor INSERT (línea vertical entre caracteres)
    const cursorToken = this.createToken('cursor', '', position, position);
    cursorToken.cursor = cursorClass;
    tokens.push(cursorToken);

    // Parte DESPUÉS del cursor (desde posición hasta final)
    const afterPart = value.substring(relativePos);
    const afterToken = this.createToken(
      token.type,
      afterPart,
      position,
      token.end,
      token
    );
    tokens.push(afterToken);

    return tokens;
  }

  /**
   * Crea un cursor INSERT independiente cuando no se encuentra en ningún token
   */
  createStandaloneInsertCursor(result, position, cursorClass) {
    // Encontrar dónde insertar el cursor
    let insertIndex = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i].start > position) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    // Crear token de cursor INSERT vacío
    const cursorToken = this.createToken('cursor', '', position, position);
    cursorToken.cursor = cursorClass;
    result.splice(insertIndex, 0, cursorToken);

    return result;
  }

  // DESACTIVADO: Método complejo problemático - usar applySimpleCursor en su lugar
  // (método eliminado para limpiar el código)

  applySelection(tokens, selectionStart, selectionEnd) {
    const result = [...tokens];

    // Safety check for empty or invalid selection
    if (selectionStart >= selectionEnd) {
      return result; // Return unchanged tokens for invalid selection
    }

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
  shouldSplitComplexToken(_token, _selectionStart, _selectionEnd) {
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
  applySelectionToComplexToken(token, _selectionStart, _selectionEnd, lastSelectedPosition) {
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
  shouldSplitComplexTokenForCursor(_token, _cursorPosition) {
    // For cursor positioning, we ALWAYS want character-level precision
    // regardless of cursor position within the token
    // This ensures that even the first character gets individual cursor treatment
    return true;
  }

  /**
   * Apply cursor effects to ComplexVimToken without splitting
   */
  applyCursorToComplexToken(token, _cursorPosition, cursorClass) {
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
      const beforeToken = this.createToken(
        token.type,
        value.substring(0, beforeLength),
        token.start,
        cursorPosition,
        token
      );
      tokens.push(beforeToken);
    }

    // Cursor character
    const cursorCharIndex = cursorPosition - token.start;

    // Validate that cursor position is within token bounds
    if (cursorCharIndex < 0 || cursorCharIndex >= value.length) {
      return [token]; // Return original token if position is invalid
    }

    const cursorChar = value.charAt(cursorCharIndex);

    if (cursorChar) {
      // Normal case: cursor is on an actual character
      const cursorToken = this.createToken(
        token.type,
        cursorChar,
        cursorPosition,
        cursorPosition + 1,
        token
      );
      cursorToken.cursor = cursorClass;
      tokens.push(cursorToken);
    } else {
      // This shouldn't happen with the validation above, but as fallback
      const fallbackCursor = this.createToken(token.type, '?', cursorPosition, cursorPosition + 1, token);
      fallbackCursor.cursor = cursorClass;
      tokens.push(fallbackCursor);
    }

    // After cursor
    if (token.end > cursorPosition + 1) {
      const afterStartInToken = cursorPosition + 1 - token.start;
      const afterToken = this.createToken(
        token.type,
        value.substring(afterStartInToken),
        cursorPosition + 1,
        token.end,
        token
      );
      tokens.push(afterToken);
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
    const renderedParts = tokens.map((token, index) => {
      return this.renderToken(token);
    });

    return renderedParts.join('');
  }

  renderToken(token) {
    // PRIORITY 1: Use pre-rendered HTML if available (from Complex tokens)
    if (token.preRenderedHtml) {
      return token.preRenderedHtml;
    }

    // PRIORITY 2: Handle ComplexVimToken with nested structure
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

    console.log('🎨 [RENDER DEBUG] Rendering token', {
      value: token.value,
      type: token.type,
      cursor: token.cursor,
      classes: classes,
      isEnhancedCursorCandidate: token.cursor === 'cursor' && token.value && token.value.length === 1
    });

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

    // ENHANCED CURSOR: Handle normal mode cursor with overlay effect
    if (token.cursor === 'cursor' && token.value && token.value.length === 1) {
      console.log('🎨 [RENDER DEBUG] Applying enhanced cursor rendering');
      return this.renderEnhancedCursor(token, escapedValue, classes);
    }

    // Standard token rendering
    if (token.cursor) {
      console.log('🎨 [RENDER DEBUG] Token has cursor but using fallback rendering', {
        cursor: token.cursor,
        valueLength: token.value?.length,
        reason: token.cursor !== 'cursor' ? 'wrong cursor type' :
                !token.value ? 'no value' :
                token.value.length !== 1 ? 'not single character' : 'unknown'
      });
    }

    if (classes.length > 0) {
      return `<span class="${classes.join(' ')}">${escapedValue}</span>`;
    }
    return escapedValue;
  }

  /**
   * Render enhanced cursor with character overlay for normal mode
   */
  renderEnhancedCursor(token, escapedValue, classes) {
    console.log('🎨 [ENHANCED CURSOR DEBUG] Starting enhanced cursor rendering', {
      token: {
        value: token.value,
        type: token.type,
        cursor: token.cursor
      },
      escapedValue,
      allClasses: classes
    });

    // Filter out the basic cursor class since we're handling it specially
    const syntaxClasses = classes.filter(cls => cls !== 'cursor');

    console.log('🎨 [ENHANCED CURSOR DEBUG] Filtered syntax classes', {
      originalClasses: classes,
      syntaxClasses,
      filteredOut: classes.filter(cls => cls === 'cursor')
    });

    // Determine if we need to adjust overlay color for better contrast
    const needsDarkOverlay = this.shouldUseDarkOverlay(syntaxClasses);
    const overlayClass = needsDarkOverlay ? 'cursor-char-overlay-dark' : 'cursor-char-overlay';

    console.log('🎨 [ENHANCED CURSOR DEBUG] Overlay class selection', {
      syntaxClasses,
      needsDarkOverlay,
      selectedOverlayClass: overlayClass,
      reasoning: needsDarkOverlay ? 'light token colors detected' : 'dark/normal token colors'
    });

    // Combine classes properly - original character keeps all syntax classes
    const originalClasses = ['cursor-char-original', ...syntaxClasses];
    const overlayClasses = [overlayClass, ...syntaxClasses];

    console.log('🎨 [ENHANCED CURSOR DEBUG] Final class combinations', {
      originalClasses,
      overlayClasses
    });

    // Create the enhanced cursor structure with overlay
    const result = `<span class="cursor-overlay">` +
           `<span class="${originalClasses.join(' ')}">${escapedValue}</span>` +
           `<span class="${overlayClasses.join(' ')}">${escapedValue}</span>` +
           `</span>`;

    console.log('🎨 [ENHANCED CURSOR DEBUG] Generated HTML', {
      result,
      length: result.length
    });

    return result;
  }

  /**
   * Determine if the overlay should use dark text for better contrast
   * Based on the token's syntax highlighting class
   */
  shouldUseDarkOverlay(syntaxClasses) {
    console.log('🎨 [COLOR DEBUG] Analyzing classes for dark overlay need', {
      inputClasses: syntaxClasses
    });

    // Light-colored syntax classes that would need dark text overlay
    const lightColorClasses = [
      'string',      // Usually green/light
      'property',    // Usually blue/light
      'class-name',  // Usually yellow/light
      'function-name', // Usually blue/light
      'function',    // Usually blue/light
      'url',         // Usually cyan/light
      'entity',      // Usually cyan/light
      'value'        // Usually green/light
    ];

    // Check if any of the token's classes match light-colored classes
    const matchResults = syntaxClasses.map(cls => {
      // Remove 'token' prefix if present and check
      const cleanClass = cls.replace(/^token\.?/, '');
      const isLight = lightColorClasses.includes(cleanClass);
      return {
        originalClass: cls,
        cleanClass,
        isLight,
        matched: isLight ? cleanClass : null
      };
    });

    const hasLightClass = matchResults.some(result => result.isLight);

    console.log('🎨 [COLOR DEBUG] Dark overlay analysis complete', {
      lightColorClasses,
      matchResults,
      hasLightClass,
      decision: hasLightClass ? 'USE DARK OVERLAY' : 'USE NORMAL OVERLAY'
    });

    return hasLightClass;
  }

  getTokenClasses(token) {
    console.log('🎨 [CLASS DEBUG] Getting token classes', {
      tokenValue: token.value,
      tokenType: token.type,
      hasPrismClasses: !!(token.prismClasses && token.prismClasses.length > 0),
      prismClasses: token.prismClasses || [],
      cursor: token.cursor,
      selected: token.selected,
      isLastSelectedChar: token.isLastSelectedChar
    });

    const classes = [];

    // Add syntax highlighting class using the highlighter
    if (token.type && token.type !== 'text') {
      // Check if it's a VimToken with Prism classes
      if (token.prismClasses && token.prismClasses.length > 0) {
        classes.push(...token.prismClasses);
        console.log('🎨 [CLASS DEBUG] Added Prism classes', {
          prismClasses: token.prismClasses
        });
      } else if (this.highlighter && this.highlighter.getTokenClassName) {
        // Fallback to original highlighter
        const className = this.highlighter.getTokenClassName(token.type);
        if (className) {
          classes.push(className);
          console.log('🎨 [CLASS DEBUG] Added fallback highlighter class', {
            tokenType: token.type,
            className
          });
        }
      }
    }

    // Add cursor class
    if (token.cursor) {
      classes.push(token.cursor);
      console.log('🎨 [CLASS DEBUG] Added cursor class', {
        cursorClass: token.cursor
      });
    }

    // Add visual block cursor class for last selected character
    if (token.isLastSelectedChar) {
      classes.push('visual-block-cursor');
      console.log('🎨 [CLASS DEBUG] Added visual-block-cursor class');
    }
    // Add selection class (but not if it's the last selected char, to avoid conflict)
    else if (token.selected) {
      classes.push('visual-selection');
      console.log('🎨 [CLASS DEBUG] Added visual-selection class');
    }

    console.log('🎨 [CLASS DEBUG] Final classes for token', {
      tokenValue: token.value,
      finalClasses: classes
    });

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
    console.log('🎮 [MAIN DEBUG] Processing code started', {
      mode,
      selectionStart,
      selectionEnd,
      sourceCodeLength: sourceCode.length,
      sourceCodePreview: sourceCode.substring(0, 50) + (sourceCode.length > 50 ? '...' : '')
    });

    // Use the highlighter passed in constructor or require it as parameter
    const highlighter = this.highlighter;
    if (!highlighter) {
      throw new Error('No highlighter available. Please initialize NeovimSimulator with a highlighter.');
    }

    // Create renderer with the specific highlighter
    const renderer = new TokenRenderer(highlighter);

    // Tokenize the source code
    const tokens = highlighter.tokenize(sourceCode);
    console.log('🎮 [MAIN DEBUG] Tokenization complete', {
      totalTokens: tokens.length,
      tokenSample: tokens.slice(0, 3).map(token => ({
        type: token.type,
        value: token.value,
        start: token.start,
        end: token.end,
        prismClasses: token.prismClasses || []
      }))
    });

    // Apply visual effects based on mode
    const processedTokens = this.visualEffectsProcessor.process(
      tokens,
      mode,
      selectionStart,
      selectionEnd
    );

    console.log('🎮 [MAIN DEBUG] Visual effects applied', {
      originalTokens: tokens.length,
      processedTokens: processedTokens.length,
      tokensWithCursor: processedTokens.filter(t => t.cursor).length,
      tokensWithSelection: processedTokens.filter(t => t.selected).length,
      cursorTokenDetails: processedTokens.filter(t => t.cursor).map(t => ({
        value: t.value,
        type: t.type,
        cursor: t.cursor,
        prismClasses: t.prismClasses || [],
        isComplex: t.isComplex,
        qualifiesForEnhanced: t.cursor === 'cursor' && t.value && t.value.length === 1
      }))
    });

    // Render the tokens
    const renderedCode = renderer.render(processedTokens);

    console.log('🎮 [MAIN DEBUG] Rendering complete', {
      renderedLength: renderedCode.length,
      hasEnhancedCursor: renderedCode.includes('cursor-overlay'),
      hasFallbackCursor: renderedCode.includes('class="cursor"') && !renderedCode.includes('cursor-overlay'),
      enhancedCursorCount: (renderedCode.match(/cursor-overlay/g) || []).length,
      fallbackCursorCount: (renderedCode.match(/class="[^"]*cursor[^"]*"/g) || []).filter(match => !match.includes('cursor-overlay')).length
    });

    // Add status bar based on mode
    const statusBar = this.generateStatusBar(mode);

    // Combine code with status bar
    const finalResult = renderedCode + statusBar;

    return finalResult;
  }

  generateStatusBar(mode) {
    const modeText = mode.toUpperCase();
    return `\n<div class="status-bar-ide">-- ${modeText} --</div>`;
  }

  validateModeInput(mode, selectionStart, selectionEnd) {
    const errors = [];

    // Special handling for cursor-based modes (Insert and Normal) with no selection
    if ((mode === 'insert' || mode === 'normal') && selectionStart === selectionEnd) {
      return { valid: true, errors: [] };
    }

    // For visual mode, require selection
    if (mode === 'visual' && selectionStart === selectionEnd) {
      errors.push('Please select some text in the source code for Visual mode');
    }

    // For other modes, require selection
    if (mode !== 'visual' && mode !== 'insert' && mode !== 'normal' && selectionStart === selectionEnd) {
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
    NeovimModeSimulator as NeovimSimulator, // Export with alias for convenience
    TokenRenderer,
    VisualEffectsProcessor
};

