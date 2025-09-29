/**
 * SIMPLE CURSOR IMPLEMENTATION FOR NORMAL MODE
 * Objetivo: Poner cursor EN el carácter especificado, SIEMPRE funciona
 */

class SimpleCursorProcessor {
  constructor() {
    this.createToken = this.createToken.bind(this);
  }

  /**
   * Aplica cursor en modo Normal de forma simple y robusta
   */
  applyCursor(tokens, position, cursorClass) {
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
   * Crea un nuevo token (compatible con el sistema existente)
   */
  createToken(type, value, start, end, originalToken = null) {
    const newToken = {
      type: type,
      value: value,
      start: start,
      end: end,
      cursor: null,
      selected: false,
      isLastSelectedChar: false
    };

    // Preservar propiedades del token original
    if (originalToken) {
      if (originalToken.prismClasses) {
        newToken.prismClasses = [...originalToken.prismClasses];
      }
      if (originalToken.isComplex) {
        newToken.isComplex = false; // Los splits siempre son simples
      }
    }

    return newToken;
  }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
  window.SimpleCursorProcessor = SimpleCursorProcessor;
}

export { SimpleCursorProcessor };