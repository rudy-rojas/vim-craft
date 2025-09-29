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
    console.log('🎯 [NORMAL MODE] Processing with simple cursor logic');
    return this.applySimpleCursor(tokens, selectionStart, 'cursor');
  }

  processInsertMode(tokens, selectionStart, selectionEnd) {
    console.log('🎯 [INSERT MODE] Processing with INSERT-specific cursor logic');
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
    console.log(`🎯 [SIMPLE CURSOR] Applying cursor at position ${position} with class ${cursorClass}`);

    const result = [...tokens];

    // Estrategia simple: buscar el token que contenga la posición
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // ¿La posición está dentro de este token?
      if (token.start <= position && position < token.end) {
        console.log(`✅ Found token ${i} containing position ${position}: "${token.value}" [${token.start}-${token.end}]`);

        // Caso especial: Token complejo (Prism)
        if (token.isComplex && typeof token.renderWithPartialCursor === 'function') {
          console.log(`🔮 Using complex token cursor rendering`);
          try {
            const renderedHtml = token.renderWithPartialCursor(position, cursorClass);

            // Marcar el token como pre-renderizado
            token.preRenderedHtml = renderedHtml;
            token.hasPartialCursor = true;
            token.partialCursorPosition = position;
            token.partialCursorClass = cursorClass;

            console.log(`✅ Complex token cursor applied successfully`);
            return result;
          } catch (error) {
            console.log(`⚠️ Complex token failed, falling back to simple split:`, error);
            // Continúa con split simple
          }
        }

        // Token simple: dividirlo en el punto del cursor
        const newTokens = this.splitTokenSimple(token, position, cursorClass);
        result.splice(i, 1, ...newTokens);
        console.log(`✅ Token split into ${newTokens.length} parts with cursor`);
        return result;
      }
    }

    // Fallback: posición no encontrada en ningún token
    console.log(`⚠️ Position ${position} not found in any token, creating standalone cursor`);
    return this.createStandaloneCursor(result, position, cursorClass);
  }

  /**
   * Divide un token simple en el punto del cursor
   */
  splitTokenSimple(token, position, cursorClass) {
    const tokens = [];
    const value = token.value || '';
    const relativePos = position - token.start;

    // Validación
    if (relativePos < 0 || relativePos >= value.length) {
      console.log(`⚠️ Invalid cursor position ${position} in token [${token.start}-${token.end}]`);
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
      console.log(`📝 Before cursor: "${beforePart}"`);
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
    console.log(`👆 Cursor on: "${cursorChar}"`);

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
      console.log(`📝 After cursor: "${afterPart}"`);
    }

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

    console.log(`✅ Standalone cursor inserted at index ${insertIndex}`);
    return result;
  }

  /**
   * INSERT MODE CURSOR - Coloca el cursor ENTRE caracteres, no EN un carácter
   * A diferencia del modo Normal, Insert mode muestra el cursor como una línea vertical
   * entre caracteres, indicando dónde se insertará el próximo carácter
   */
  applyInsertCursor(tokens, position, cursorClass) {
    console.log(`📝 [INSERT CURSOR] Applying INSERT cursor at position ${position} with class ${cursorClass}`);

    const result = [...tokens];

    // Buscar el token que contenga o preceda inmediatamente la posición
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // Caso 1: Posición está DENTRO del token (dividir el token)
      if (token.start < position && position < token.end) {
        console.log(`✂️ Position ${position} is INSIDE token ${i}: "${token.value}" [${token.start}-${token.end}]`);

        // Caso especial: Token complejo (Prism) - para INSERT mode
        if (token.isComplex && typeof token.renderWithPartialCursor === 'function') {
          console.log(`🔮 Using complex token INSERT cursor rendering`);
          try {
            // Para INSERT mode, necesitamos renderizar con un cursor especial entre caracteres
            const renderedHtml = token.renderWithPartialCursor(position, cursorClass);

            // Marcar el token como pre-renderizado para INSERT
            token.preRenderedHtml = renderedHtml;
            token.hasPartialCursor = true;
            token.partialCursorPosition = position;
            token.partialCursorClass = cursorClass;

            console.log(`✅ Complex token INSERT cursor applied successfully`);
            return result;
          } catch (error) {
            console.log(`⚠️ Complex INSERT token failed, falling back to simple split:`, error);
            // Continúa con split simple
          }
        }

        const newTokens = this.splitTokenForInsert(token, position, cursorClass);
        result.splice(i, 1, ...newTokens);
        console.log(`✅ Token split for INSERT cursor`);
        return result;
      }

      // Caso 2: Posición está al INICIO del token (insertar cursor antes)
      if (position === token.start) {
        console.log(`⬅️ Position ${position} is at START of token ${i}: "${token.value}" [${token.start}-${token.end}]`);
        const cursorToken = this.createToken('cursor', '', position, position);
        cursorToken.cursor = cursorClass;
        result.splice(i, 0, cursorToken);
        console.log(`✅ INSERT cursor placed before token`);
        return result;
      }

      // Caso 3: Posición está al FINAL del token (insertar cursor después)
      if (position === token.end) {
        console.log(`➡️ Position ${position} is at END of token ${i}: "${token.value}" [${token.start}-${token.end}]`);
        const cursorToken = this.createToken('cursor', '', position, position);
        cursorToken.cursor = cursorClass;
        result.splice(i + 1, 0, cursorToken);
        console.log(`✅ INSERT cursor placed after token`);
        return result;
      }
    }

    // Fallback: Posición no encontrada, crear cursor independiente
    console.log(`🔍 Position ${position} not found relative to any token, creating standalone INSERT cursor`);
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
      console.log(`⚠️ Invalid INSERT cursor position ${position} in token [${token.start}-${token.end}]`);
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
    console.log(`📝 Before INSERT cursor: "${beforePart}"`);

    // Cursor INSERT (línea vertical entre caracteres)
    const cursorToken = this.createToken('cursor', '', position, position);
    cursorToken.cursor = cursorClass;
    tokens.push(cursorToken);
    console.log(`📍 INSERT cursor placed between characters`);

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
    console.log(`📝 After INSERT cursor: "${afterPart}"`);

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

    console.log(`✅ Standalone INSERT cursor inserted at index ${insertIndex}`);
    return result;
  }

  // DESACTIVADO: Método complejo problemático - usar applySimpleCursor en su lugar
  applyCursor_OLD_BROKEN(tokens, position, cursorClass) {
    const result = [...tokens];
    let cursorPlaced = false;

    console.group('🎯 [CURSOR DEBUG] Cursor Application');
    console.log('📍 Target position:', position, '| Cursor class:', cursorClass, '| Total tokens:', tokens.length);

    // Enhanced debugging: show tokens around target position
    console.log('🔍 Tokens around target position:');
    const relevantTokens = tokens.filter(token =>
      Math.abs(token.start - position) <= 5 ||
      Math.abs(token.end - position) <= 5 ||
      (token.start <= position && position <= token.end)
    ).slice(0, 5);
    relevantTokens.forEach(token => {
      const isMatch = token.start <= position && position <= token.end;
      console.log(`  ${isMatch ? '✅' : '❌'} Token [${token.start}-${token.end}]: "${token.value?.substring(0, 15) || ''}" (complex: ${!!token.isComplex})`);
    });

    // First pass: Check if any complex token can handle this position
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      // Handle cursor within a token (primary case)
      if (token.start <= position && position <= token.end) {
        console.log(`✅ Found matching token ${i} for position ${position}: [${token.start}-${token.end}]`);

        // Prioritize complex tokens - they handle nested structures
        if (token.isComplex) {
          console.log(`🔍 Processing ComplexVimToken ${i}`);
          // True ComplexVimToken with nested structure
          let complexTokenHandled = false;

          if (this.shouldSplitComplexTokenForCursor(token, position)) {
            // Apply character-level cursor within the complex token structure
            token.hasPartialCursor = true;
            token.partialCursorPosition = position;
            token.partialCursorClass = cursorClass;

            // Verify the complex token can actually handle this cursor position
            if (typeof token.applyCursorWithPosition === 'function') {
              try {
                const testResult = token.applyCursorWithPosition(position, cursorClass);
                console.log(`🧪 Complex token test result:`, {
                  hasResult: !!testResult,
                  resultLength: testResult?.length || 0,
                  includesCursorClass: testResult?.includes(cursorClass) || false,
                  includesCursor: testResult?.includes('cursor') || false,
                  cursorClass,
                  preview: testResult?.substring(0, 100) || 'empty'
                });

                // More robust validation: check for any cursor-related content
                const hasCursorContent = testResult && (
                  testResult.includes(cursorClass) ||
                  testResult.includes('cursor') ||
                  testResult.includes('class="cursor') ||
                  testResult.includes('class="cursor-')
                );

                if (testResult && hasCursorContent) {
                  console.log(`✅ Complex token successfully handled cursor`);
                  complexTokenHandled = true;
                } else {
                  console.log(`❌ Complex token failed cursor test - no cursor content found`);
                }
              } catch (error) {
                // If there's an error, the complex token couldn't handle it
                console.warn('Complex token cursor application failed:', error);
              }
            }
          } else {
            // Apply cursor effects directly to the complex token
            this.applyCursorToComplexToken(token, position, cursorClass);
            // For direct application, assume it worked (fallback behavior)
            complexTokenHandled = true;
          }

          // Only mark as placed if the complex token actually handled it
          if (complexTokenHandled) {
            cursorPlaced = true;
            break;
          } else {
            console.log(`❌ Complex token ${i} failed to handle cursor - resetting properties`);
            // Reset the token properties since the complex token couldn't handle it
            token.hasPartialCursor = false;
            token.partialCursorPosition = undefined;
            token.partialCursorClass = undefined;
          }
        } else {
          // Simple token found - continue to check if there are ComplexVimTokens that might handle this better
          console.log(`⏭️ Skipping simple token ${i} in first pass - will process in second pass if needed`);
        }
      }
    }

    // Second pass: If no complex token handled it, process simple tokens
    if (!cursorPlaced) {
      console.log('🔄 Second pass: Processing simple tokens');
      for (let i = 0; i < result.length; i++) {
        const token = result[i];

        // Handle cursor within a token (only simple tokens now)
        // Check if cursor position falls within this token
        if (token.start <= position && position < token.end && !token.isComplex) {
          // NORMAL MODE: Cursor ON character (position < token.end ensures we're not at boundary)
          console.log(`🎯 Found candidate token ${i} for position ${position}: [${token.start}-${token.end}]`);
        } else if (token.start <= position && position === token.end && !token.isComplex) {
          // Handle boundary case: cursor exactly at token end
          if (cursorClass === 'cursor-insert') {
            // INSERT MODE: Can place cursor at end of token (cursor BETWEEN characters)
            console.log(`✅ [INSERT] Processing boundary token ${i} for position ${position}: [${token.start}-${token.end}]`);
          } else {
            // NORMAL MODE: Skip tokens that end exactly at cursor position unless it's a single-char token
            if (token.end - token.start === 1) {
              console.log(`🎯 [NORMAL] Processing single-char token ${i} for position ${position}: [${token.start}-${token.end}]`);
            } else {
              console.log(`⏭️ [NORMAL] Skipping boundary token ${i} - cursor at end boundary: [${token.start}-${token.end}]`);
              continue;
            }
          }
        } else {
          continue; // Token doesn't contain cursor position
        }

        console.log(`🎯 Processing simple token ${i} for position ${position}: [${token.start}-${token.end}]`);

        if (typeof token.canBeSplit === 'function' && !token.canBeSplit()) {
          console.log(`⚡ Token ${i} canBeSplit=false, but forcing split for cursor precision`);
          // Simple token that shouldn't be split (like property, selector)
          // BUT for cursor positioning, we ALWAYS want character-level precision
          // so we split despite canBeSplit = false
          const newTokens = this.splitTokenForCursor(token, position, cursorClass);
          result.splice(i, 1, ...newTokens);
          i += newTokens.length - 1; // Adjust index for added tokens
          cursorPlaced = true;
          console.log(`✅ Successfully split token ${i} (canBeSplit=false) into ${newTokens.length} tokens`);
          break;
        } else {
          console.log(`🔄 Splitting normal token ${i}`);
          // Normal token - split as usual
          const newTokens = this.splitTokenForCursor(token, position, cursorClass);
          result.splice(i, 1, ...newTokens);
          i += newTokens.length - 1; // Adjust index for added tokens
          cursorPlaced = true;
          console.log(`✅ Successfully split normal token ${i} into ${newTokens.length} tokens`);
          break;
        }
      }
    }

    // Handle cursor at the exact end of any token (for both insert and normal modes)
    // Only if cursor wasn't already placed within a token
    if (!cursorPlaced && (cursorClass === 'cursor-insert' || cursorClass === 'cursor')) {
      console.log('📍 Trying end-of-token cursor placement...');
      for (let i = 0; i < result.length; i++) {
        const token = result[i];
        if (position === token.end) {
          console.log(`✅ Placing cursor at end of token ${i}: position ${position}`);
          // Insert cursor after this token
          const insertCursor = this.createToken('cursor', '', position, position);
          insertCursor.cursor = cursorClass;
          result.splice(i + 1, 0, insertCursor);
          cursorPlaced = true;
          break;
        }
      }
    }

    // Fallback for both Insert and Normal modes: handle positions not covered by any token
    // This covers gaps in tokenization (like newlines, spaces between tokens, etc.)
    if (!cursorPlaced && (cursorClass === 'cursor-insert' || cursorClass === 'cursor')) {
      console.log('⚠️ Using fallback cursor placement');
      console.log('📄 Available tokens for fallback analysis:');
      result.forEach((token, i) => {
        console.log(`  Token ${i}: [${token.start}-${token.end}] "${token.value?.substring(0, 10) || ''}"`);
      });

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
      console.log(`✅ Fallback cursor placed at position ${insertPosition} for target position ${position}`);
      cursorPlaced = true;
    }

    // AGGRESSIVE FALLBACK: If still no cursor placed, force it
    if (!cursorPlaced) {
      console.log('🚨 AGGRESSIVE FALLBACK: Force placing cursor');

      // Find the best token to split or place cursor in
      let bestToken = null;
      let bestIndex = -1;

      for (let i = 0; i < result.length; i++) {
        const token = result[i];
        // Find token that contains or is closest to the position
        if (token.start <= position && position <= token.end) {
          bestToken = token;
          bestIndex = i;
          break;
        }
      }

      if (bestToken && bestIndex >= 0) {
        console.log(`🎯 Force splitting token ${bestIndex}: [${bestToken.start}-${bestToken.end}]`);
        // Force split this token regardless of canBeSplit
        const newTokens = this.splitTokenForCursor(bestToken, position, cursorClass);
        result.splice(bestIndex, 1, ...newTokens);
      } else {
        console.log('🎯 Force inserting cursor at end');
        // Last resort: insert cursor at the end
        const insertCursor = this.createToken('cursor', '', position, position);
        insertCursor.cursor = cursorClass;
        result.push(insertCursor);
      }
      cursorPlaced = true;
    }

    console.log(`🎯 Cursor placement result: ${cursorPlaced ? 'SUCCESS' : 'FAILED'}`);
    console.groupEnd();

    return result;
  }

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
    console.log(`✂️ [SPLIT DEBUG] Splitting token for cursor:`, {
      tokenStart: token.start,
      tokenEnd: token.end,
      cursorPosition,
      cursorClass,
      tokenValue: token.value?.substring(0, 20) || 'empty',
      valueLength: token.value?.length || 0
    });

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
      console.log(`✂️ Created before-cursor token: [${beforeToken.start}-${beforeToken.end}] "${beforeToken.value}"`);
    }

    // Cursor character
    const cursorCharIndex = cursorPosition - token.start;

    // Validate that cursor position is within token bounds
    if (cursorCharIndex < 0 || cursorCharIndex >= value.length) {
      console.log(`⚠️ Cursor position ${cursorPosition} is outside token bounds [${token.start}-${token.end}], char index: ${cursorCharIndex}`);
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
      console.log(`✂️ Created cursor token: [${cursorToken.start}-${cursorToken.end}] "${cursorToken.value}" with cursor class: ${cursorClass}`);
    } else {
      // This shouldn't happen with the validation above, but as fallback
      console.log(`⚠️ Empty character at position ${cursorPosition}, creating minimal cursor token`);
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
      console.log(`✂️ Created after-cursor token: [${afterToken.start}-${afterToken.end}] "${afterToken.value}"`);
    }

    console.log(`✂️ Split result: ${tokens.length} tokens, cursor applied: ${tokens.some(t => t.cursor)}`);
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
    console.group('🖼️ [DEBUG RENDERIZADO] Token Rendering');
    console.log('🔢 Total tokens to render:', tokens.length);

    // Análisis de tokens a renderizar
    const renderAnalysis = {
      total: tokens.length,
      withEffects: 0,
      types: {},
      renderMethods: {}
    };

    tokens.forEach(token => {
      const type = token.isComplex ? 'ComplexVimToken' : 'VimToken';
      renderAnalysis.types[type] = (renderAnalysis.types[type] || 0) + 1;

      if (token.selected || token.cursor || token.hasPartialCursor || token.hasPartialSelection) {
        renderAnalysis.withEffects++;
      }

      // Determinar método de renderizado
      let renderMethod = 'standard';
      if (token.isComplex) {
        if (token.hasPartialCursor) {
          renderMethod = 'applyCursorWithPosition';
        } else if (token.hasPartialSelection) {
          renderMethod = 'applyVimEffectsWithPartialSelection';
        } else {
          renderMethod = 'applyVimEffects';
        }
      } else if (token.cursor) {
        renderMethod = 'cursor';
      } else if (token.selected) {
        renderMethod = 'selection';
      }

      renderAnalysis.renderMethods[renderMethod] = (renderAnalysis.renderMethods[renderMethod] || 0) + 1;
    });

    console.log('📊 Render analysis:', renderAnalysis);

    const renderedParts = tokens.map((token, index) => {
      const result = this.renderToken(token);

      // Debug para los primeros y últimos tokens
      if (index < 2 || index >= tokens.length - 2) {
        console.log(`🎨 Token ${index} rendered:`, {
          type: token.isComplex ? 'ComplexVimToken' : 'VimToken',
          tokenType: token.type,
          length: result.length,
          preview: result.substring(0, 50)
        });
      }

      return result;
    });

    const finalHtml = renderedParts.join('');

    console.log('✨ Rendering complete:', {
      totalLength: finalHtml.length,
      preview: finalHtml.substring(0, 100)
    });
    console.groupEnd();

    return finalHtml;
  }

  renderToken(token) {
    // PRIORITY 1: Use pre-rendered HTML if available (from Complex tokens)
    if (token.preRenderedHtml) {
      console.log(`🎨 Using pre-rendered HTML for token ${token.type}`);
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
    console.group('🎮 [DEBUG PROCESAMIENTO] Vim Mode Processing');
    console.log('🎯 Processing mode:', mode);
    console.log('📍 Selection range:', { selectionStart, selectionEnd });

    // Use the highlighter passed in constructor or require it as parameter
    const highlighter = this.highlighter;
    if (!highlighter) {
      console.error('❌ No highlighter available');
      console.groupEnd();
      throw new Error('No highlighter available. Please initialize NeovimSimulator with a highlighter.');
    }

    // Create renderer with the specific highlighter
    const renderer = new TokenRenderer(highlighter);

    // Tokenize the source code
    console.log('🔤 Tokenizing source code...');
    const tokens = highlighter.tokenize(sourceCode);

    console.group('📊 [DEBUG TOKENS ENTRADA] Pre-processing Analysis');
    console.log('🔢 Total input tokens:', tokens.length);

    // Análisis de tokens de entrada
    const inputAnalysis = {
      total: tokens.length,
      types: {},
      samples: []
    };

    tokens.forEach((token, index) => {
      const type = token.isComplex ? 'ComplexVimToken' : 'VimToken';
      inputAnalysis.types[type] = (inputAnalysis.types[type] || 0) + 1;

      if (index < 3 || index >= tokens.length - 2) {
        inputAnalysis.samples.push({
          index,
          type,
          tokenType: token.type,
          start: token.start,
          end: token.end,
          preview: JSON.stringify(token.value?.substring(0, 15) || '')
        });
      }
    });

    console.log('📈 Input token analysis:', inputAnalysis);
    console.groupEnd();

    // Apply visual effects based on mode
    console.log('🎨 Applying visual effects for mode:', mode);
    const processedTokens = this.visualEffectsProcessor.process(
      tokens,
      mode,
      selectionStart,
      selectionEnd
    );

    console.group('🎯 [DEBUG TOKENS PROCESADOS] Post-processing Analysis');
    console.log('🔢 Total processed tokens:', processedTokens.length);

    // Análisis de tokens procesados
    const processedAnalysis = {
      total: processedTokens.length,
      types: {},
      withEffects: 0,
      samples: []
    };

    processedTokens.forEach((token, index) => {
      const type = token.isComplex ? 'ComplexVimToken' : 'VimToken';
      processedAnalysis.types[type] = (processedAnalysis.types[type] || 0) + 1;

      if (token.selected || token.cursor || token.hasPartialCursor || token.hasPartialSelection) {
        processedAnalysis.withEffects++;
      }

      if (index < 3 || index >= processedTokens.length - 2) {
        processedAnalysis.samples.push({
          index,
          type,
          tokenType: token.type,
          start: token.start,
          end: token.end,
          effects: {
            selected: !!token.selected,
            cursor: !!token.cursor,
            hasPartialCursor: !!token.hasPartialCursor,
            hasPartialSelection: !!token.hasPartialSelection
          },
          preview: JSON.stringify(token.value?.substring(0, 15) || '')
        });
      }
    });

    console.log('📈 Processed token analysis:', processedAnalysis);
    console.log('🎨 Tokens with vim effects:', processedAnalysis.withEffects, '/', processedAnalysis.total);
    console.groupEnd();

    // Render the tokens
    console.log('🖼️ Rendering final HTML...');
    const renderedCode = renderer.render(processedTokens);

    // Add status bar based on mode
    const statusBar = this.generateStatusBar(mode);

    // Combine code with status bar
    const finalResult = renderedCode + statusBar;

    console.log('✅ Processing completed successfully');
    console.groupEnd(); // Close main processing group

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

