// Token-based syntax highlighting system
class Token {
  constructor(type, value, start, end) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.end = end;
    this.cursor = null;      // Para efectos de cursor
    this.selected = false;   // Para selección visual
    this.isLastSelectedChar = false; // NEW: Para marcar el último carácter seleccionado
  }
}

// Base highlighter class
class BaseHighlighter {
  constructor() {
    this.patterns = this.getPatterns();
  }

  getPatterns() {
    // Override in subclasses
    return [];
  }

  tokenize(code) {
    const tokens = [];
    let position = 0;
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      const lineStart = position;
      const lineTokens = this.tokenizeLine(line, lineStart);
      tokens.push(...lineTokens);
      
      // Add newline token except for the last line
      if (lineIndex < lines.length - 1) {
        tokens.push(new Token('newline', '\n', position + line.length, position + line.length + 1));
        position += line.length + 1; // +1 for newline
      } else {
        position += line.length;
      }
    });

    return tokens;
  }

  tokenizeLine(line, lineStart) {
    const tokens = [];
    const matches = [];

    // Collect all pattern matches
    this.patterns.forEach(pattern => {
      const regex = new RegExp(pattern.regex, 'g');
      let match;
      while ((match = regex.exec(line)) !== null) {
        matches.push({
          type: pattern.type,
          value: match[0],
          start: lineStart + match.index,
          end: lineStart + match.index + match[0].length,
          priority: pattern.priority || 0
        });
      }
    });

    // Sort by position and priority
    matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.priority - a.priority;
    });

    // Resolve overlapping matches
    const resolvedMatches = this.resolveOverlaps(matches);
    
    // Fill gaps with default tokens
    return this.fillGaps(resolvedMatches, line, lineStart);
  }

  resolveOverlaps(matches) {
    const resolved = [];
    let lastEnd = -1;

    for (const match of matches) {
      if (match.start >= lastEnd) {
        resolved.push(match);
        lastEnd = match.end;
      }
    }

    return resolved;
  }

  fillGaps(matches, line, lineStart) {
    const tokens = [];
    let position = lineStart;

    for (const match of matches) {
      // Add gap before match
      if (position < match.start) {
        const gapValue = line.substring(position - lineStart, match.start - lineStart);
        // Include whitespace and empty content
        if (gapValue.length > 0) {
          tokens.push(new Token('text', gapValue, position, match.start));
        }
      }

      // Add the match token
      tokens.push(new Token(match.type, match.value, match.start, match.end));
      position = match.end;
    }

    // Add remaining text
    if (position < lineStart + line.length) {
      const remainingValue = line.substring(position - lineStart);
      if (remainingValue.length > 0) {
        tokens.push(new Token('text', remainingValue, position, lineStart + line.length));
      }
    }

    return tokens;
  }

  render(tokens) {
    return tokens.map(token => this.renderToken(token)).join('');
  }

  renderToken(token) {
    const escapedValue = this.escapeHtml(token.value);
    const className = this.getTokenClassName(token.type);
    
    if (className) {
      return `<span class="${className}">${escapedValue}</span>`;
    }
    return escapedValue;
  }

  getTokenClassName(type) {
    // Override in subclasses
    return null;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// JavaScript highlighter
class JavaScriptHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      // JavaScript decorators (proposals) - Split into @ symbol and name
      {
        type: 'decorator-at',
        regex: '@(?=[a-zA-Z_$])',
        priority: 12
      },
      {
        type: 'decorator-name', 
        regex: '(?<=@)[a-zA-Z_$][a-zA-Z0-9_$]*',
        priority: 11
      },
      {
        type: 'decorator-params',
        regex: '(?<=@[a-zA-Z_$][a-zA-Z0-9_$]*)\\([^)]*\\)',
        priority: 10
      },
      {
        type: 'keyword',
        regex: '\\b(function|return|const|let|var|if|else|for|while|class|import|export|async|await|try|catch|finally)\\b',
        priority: 9
      },
      {
        type: 'string',
        regex: '"([^"\\\\]|\\\\.)*"|\'([^\'\\\\]|\\\\.)*\'|`([^`\\\\]|\\\\.)*`',
        priority: 8
      },
      {
        type: 'number',
        regex: '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b',
        priority: 7
      },
      {
        type: 'boolean',
        regex: '\\b(true|false)\\b',
        priority: 7
      },
      {
        type: 'comment',
        regex: '//.*$|/\\*[\\s\\S]*?\\*/',
        priority: 6
      },
      {
        type: 'method',
        regex: '\\.([a-zA-Z_$][a-zA-Z0-9_$]*)',
        priority: 5
      },
      {
        type: 'operator',
        regex: '[+\\-*/%=<>!&|(){}\\[\\];,.]',
        priority: 4
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      // Decorators
      'decorator-at': 'ts-decorator-at',
      'decorator-name': 'ts-decorator-name',
      'decorator-params': 'ts-decorator-params',
      
      'keyword': 'js-keyword',
      'string': 'js-string',
      'number': 'js-number',
      'boolean': 'js-boolean',
      'comment': 'js-comment',
      'operator': 'js-operator',
      'method': 'js-method'
    };
    return classMap[type];
  }
}

// TypeScript highlighter with NestJS, NextJS, and React support
class TypeScriptHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      // TypeScript/JavaScript decorators - Split into @ symbol and name
      {
        type: 'decorator-at',
        regex: '@(?=[a-zA-Z_$])',
        priority: 16
      },
      {
        type: 'decorator-name',
        regex: '(?<=@)[a-zA-Z_$][a-zA-Z0-9_$]*',
        priority: 15
      },
      {
        type: 'decorator-params',
        regex: '(?<=@[a-zA-Z_$][a-zA-Z0-9_$]*)\\([^)]*\\)',
        priority: 14
      },
      // JSX/TSX tags and components
      {
        type: 'jsx-tag',
        regex: '</?[A-Z][a-zA-Z0-9]*(?:\\.[a-zA-Z0-9]+)*|</?[a-z][a-zA-Z0-9-]*',
        priority: 13
      },
      // JSX attributes
      {
        type: 'jsx-attribute',
        regex: '\\b[a-zA-Z-]+(?==)|\\{[^}]*\\}',
        priority: 12
      },
      // TypeScript keywords
      {
        type: 'ts-keyword',
        regex: '\\b(interface|type|enum|namespace|declare|abstract|readonly|keyof|typeof|extends|implements|public|private|protected|static|async|await)\\b',
        priority: 11
      },
      // React specific keywords and hooks
      {
        type: 'react-keyword',
        regex: '\\b(useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue|Component|PureComponent|createContext|Fragment|StrictMode|Suspense|lazy|memo|forwardRef|createRef)\\b',
        priority: 10
      },
      // NestJS specific keywords
      {
        type: 'nestjs-keyword',
        regex: '\\b(Controller|Injectable|Module|Service|Guard|Interceptor|Filter|Pipe|Middleware|CanActivate|NestInterceptor|ExceptionFilter|PipeTransform|NestMiddleware)\\b',
        priority: 10
      },
      // NextJS specific keywords
      {
        type: 'nextjs-keyword',
        regex: '\\b(getServerSideProps|getStaticProps|getStaticPaths|getInitialProps|NextPage|NextApiRequest|NextApiResponse|NextRouter|useRouter|Head|Image|Link|Script)\\b',
        priority: 10
      },
      // Regular JavaScript keywords (lower priority than TS)
      {
        type: 'js-keyword',
        regex: '\\b(function|return|const|let|var|if|else|for|while|class|import|export|try|catch|finally|switch|case|default|break|continue|do|throw|new|this|super|in|of|with|debugger|delete|instanceof|void)\\b',
        priority: 9
      },
      // TypeScript types
      {
        type: 'ts-type',
        regex: '\\b(string|number|boolean|object|undefined|null|any|unknown|never|void|Array|Promise|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|Parameters|ReturnType|InstanceType|ThisType)\\b',
        priority: 8
      },
      // Generic type parameters
      {
        type: 'generic',
        regex: '<[A-Z][a-zA-Z0-9,\\s]*>',
        priority: 8
      },
      // Template literals
      {
        type: 'template-literal',
        regex: '`([^`\\\\]|\\\\.)*`',
        priority: 7
      },
      // Regular strings
      {
        type: 'string',
        regex: '"([^"\\\\]|\\\\.)*"|\'([^\'\\\\]|\\\\.)*\'',
        priority: 7
      },
      // Numbers
      {
        type: 'number',
        regex: '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?[nN]?\\b',
        priority: 6
      },
      // Booleans and special values
      {
        type: 'boolean',
        regex: '\\b(true|false|null|undefined)\\b',
        priority: 6
      },
      // Comments
      {
        type: 'comment',
        regex: '//.*$|/\\*[\\s\\S]*?\\*/|<!--[\\s\\S]*?-->',
        priority: 5
      },
      // Methods and function calls
      {
        type: 'method',
        regex: '\\.([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\\s*\\()',
        priority: 4
      },
      // Properties
      {
        type: 'property',
        regex: '\\.([a-zA-Z_$][a-zA-Z0-9_$]*)(?!\\s*\\()',
        priority: 4
      },
      // Arrow functions
      {
        type: 'arrow',
        regex: '=>',
        priority: 3
      },
      // Type annotations
      {
        type: 'type-annotation',
        regex: ':\\s*[a-zA-Z_$][a-zA-Z0-9_$<>\\[\\]|&,\\s]*',
        priority: 3
      },
      // Operators
      {
        type: 'operator',
        regex: '[+\\-*/%=<>!&|^~?:(){}\\[\\];,.]|\\?\\?|\\|\\||&&|\\+\\+|--|\\*\\*|===|!==|==|!=|<=|>=|<<|>>|>>>|\\+=|-=|\\*=|/=|%=|&=|\\|=|\\^=|<<=|>>=|>>>=',
        priority: 2
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      // Decorators (separados)
      'decorator-at': 'ts-decorator-at',
      'decorator-name': 'ts-decorator-name', 
      'decorator-params': 'ts-decorator-params',
      
      // JSX/TSX
      'jsx-tag': 'jsx-tag',
      'jsx-attribute': 'jsx-attribute',
      
      // TypeScript specific
      'ts-keyword': 'ts-keyword',
      'ts-type': 'ts-type',
      'generic': 'ts-generic',
      'type-annotation': 'ts-type-annotation',
      
      // Framework specific
      'react-keyword': 'react-keyword',
      'nestjs-keyword': 'nestjs-keyword',
      'nextjs-keyword': 'nextjs-keyword',
      
      // Regular JavaScript
      'js-keyword': 'js-keyword',
      'template-literal': 'ts-template-literal',
      'string': 'js-string',
      'number': 'js-number',
      'boolean': 'js-boolean',
      'comment': 'js-comment',
      'method': 'js-method',
      'property': 'js-property',
      'arrow': 'ts-arrow',
      'operator': 'js-operator'
    };
    return classMap[type];
  }
}

// Python highlighter
class PythonHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      {
        type: 'decorator',
        regex: '@[a-zA-Z_][a-zA-Z0-9_]*',
        priority: 10
      },
      {
        type: 'keyword',
        regex: '\\b(def|class|return|if|else|elif|for|while|import|from|as|try|except|finally|with|yield|lambda|pass|break|continue|and|or|not|in|is)\\b',
        priority: 9
      },
      {
        type: 'builtin',
        regex: '\\b(str|int|float|bool|list|dict|tuple|set|len|range|enumerate|zip|map|filter|print)\\b',
        priority: 8
      },
      {
        type: 'string',
        regex: '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"([^"\\\\]|\\\\.)*"|\'([^\'\\\\]|\\\\.)*\'',
        priority: 7
      },
      {
        type: 'number',
        regex: '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b',
        priority: 6
      },
      {
        type: 'comment',
        regex: '#.*$',
        priority: 5
      },
      {
        type: 'operator',
        regex: '[+\\-*/%=<>!&|(){}\\[\\];,.:=]',
        priority: 4
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      'decorator': 'py-decorator',
      'keyword': 'py-keyword',
      'builtin': 'py-builtin',
      'string': 'js-string',
      'number': 'js-number',
      'comment': 'py-comment',
      'operator': 'js-operator'
    };
    return classMap[type];
  }
}

// Java highlighter
class JavaHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      {
        type: 'annotation',
        regex: '@[a-zA-Z_][a-zA-Z0-9_]*',
        priority: 10
      },
      {
        type: 'modifier',
        regex: '\\b(public|private|protected|static|final|abstract|synchronized|volatile|transient)\\b',
        priority: 9
      },
      {
        type: 'keyword',
        regex: '\\b(class|interface|extends|implements|return|if|else|for|while|new|this|super|try|catch|finally|throw|throws|import|package)\\b',
        priority: 8
      },
      {
        type: 'type',
        regex: '\\b(String|int|Integer|boolean|Boolean|double|Double|float|Float|char|Character|long|Long|short|Short|byte|Byte|void)\\b',
        priority: 7
      },
      {
        type: 'string',
        regex: '"([^"\\\\]|\\\\.)*"',
        priority: 6
      },
      {
        type: 'number',
        regex: '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?[lLfFdD]?\\b',
        priority: 5
      },
      {
        type: 'comment',
        regex: '//.*$|/\\*[\\s\\S]*?\\*/',
        priority: 4
      },
      {
        type: 'operator',
        regex: '[+\\-*/%=<>!&|(){}\\[\\];,.]',
        priority: 3
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      'annotation': 'java-annotation',
      'modifier': 'java-modifier',
      'keyword': 'java-keyword',
      'type': 'java-type',
      'string': 'java-string',
      'number': 'js-number',
      'comment': 'js-comment',
      'operator': 'js-operator'
    };
    return classMap[type];
  }
}

// Swift highlighter
class SwiftHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      {
        type: 'attribute',
        regex: '@[a-zA-Z_][a-zA-Z0-9_]*',
        priority: 10
      },
      {
        type: 'keyword',
        regex: '\\b(struct|class|enum|protocol|func|var|let|return|if|else|guard|for|while|switch|case|default|import|extension|init|deinit|override|final|static|private|public|internal|fileprivate|open)\\b',
        priority: 9
      },
      {
        type: 'type',
        regex: '\\b(String|Int|Double|Float|Bool|Array|Dictionary|Set|Optional|Any|AnyObject)\\b',
        priority: 8
      },
      {
        type: 'string',
        regex: '"([^"\\\\]|\\\\.)*"|\'([^\'\\\\]|\\\\.)*\'',
        priority: 7
      },
      {
        type: 'number',
        regex: '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b',
        priority: 6
      },
      {
        type: 'comment',
        regex: '//.*$|/\\*[\\s\\S]*?\\*/',
        priority: 5
      },
      {
        type: 'operator',
        regex: '[+\\-*/%=<>!&|(){}\\[\\];,.:?]',
        priority: 4
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      'attribute': 'swift-attribute',
      'keyword': 'swift-keyword',
      'type': 'swift-type',
      'string': 'swift-string',
      'number': 'swift-number',
      'comment': 'js-comment',
      'operator': 'js-operator'
    };
    return classMap[type];
  }
}

// CSS highlighter
class CSSHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      {
        type: 'comment',
        regex: '/\\*[\\s\\S]*?\\*/',
        priority: 10
      },
      {
        type: 'selector',
        regex: '^\\s*[.#]?[a-zA-Z][a-zA-Z0-9-_]*(?=\\s*\\{)',
        priority: 9
      },
      {
        type: 'property',
        regex: '(?<=^\\s*|;\\s*)[a-zA-Z-]+(?=\\s*:)',
        priority: 8
      },
      {
        type: 'number-unit',
        regex: '\\b\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|vmin|vmax|fr)\\b',
        priority: 7
      },
      {
        type: 'number',
        regex: '\\b\\d+(?:\\.\\d+)?\\b',
        priority: 6
      },
      {
        type: 'color',
        regex: '#[0-9a-fA-F]{3,6}\\b|rgb\\([^)]*\\)|rgba\\([^)]*\\)|hsl\\([^)]*\\)|hsla\\([^)]*\\)',
        priority: 6
      },
      {
        type: 'string',
        regex: '"([^"\\\\]|\\\\.)*"|\'([^\'\\\\]|\\\\.)*\'',
        priority: 5
      },
      {
        type: 'value',
        regex: '(?<=:\\s*)[^;!]+(?=\\s*(?:!important)?\\s*;?)',
        priority: 5
      },
      {
        type: 'important',
        regex: '!important\\b',
        priority: 6
      },
      {
        type: 'pseudo',
        regex: ':[a-zA-Z-]+(?:\\([^)]*\\))?',
        priority: 4
      },
      {
        type: 'operator',
        regex: '[{}:;,.]',
        priority: 3
      }
    ];
  }

  // Override tokenizeLine for better CSS parsing
  tokenizeLine(line, lineStart) {
    const trimmed = line.trim();
    
    // Handle empty lines - still create a token to preserve the line
    if (!trimmed) {
      return [new Token('text', line, lineStart, lineStart + line.length)];
    }

    // Use parent method for complex parsing
    return super.tokenizeLine(line, lineStart);
  }

  getTokenClassName(type) {
    const classMap = {
      'comment': 'js-comment',
      'selector': 'css-selector',
      'property': 'css-property',
      'number-unit': 'css-unit',
      'number': 'js-number',
      'color': 'css-value',
      'string': 'js-string',
      'value': 'css-value',
      'important': 'css-value',
      'pseudo': 'css-pseudo',
      'operator': 'js-operator'
    };
    return classMap[type];
  }
}

// HTML highlighter
class HTMLHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      {
        type: 'tag',
        regex: '</?[a-zA-Z][a-zA-Z0-9]*',
        priority: 10
      },
      {
        type: 'attribute',
        regex: '\\b[a-zA-Z-]+(?==)',
        priority: 9
      },
      {
        type: 'attribute-value',
        regex: '"[^"]*"|\'[^\']*\'',
        priority: 8
      },
      {
        type: 'bracket',
        regex: '[<>]',
        priority: 7
      },
      {
        type: 'operator',
        regex: '=',
        priority: 6
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      'tag': 'tag-name',
      'attribute': 'attribute-name',
      'attribute-value': 'attribute-value',
      'bracket': 'tag-bracket',
      'operator': 'equals'
    };
    return classMap[type];
  }
}

// Visual effects processor
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
    
    // NEW: Calculamos la posición del último carácter seleccionado
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
    
    // Selection part - NEW: Detectamos si contiene el último carácter seleccionado
    const selectionStartInToken = Math.max(0, selectionStart - token.start);
    const selectionEndInToken = Math.min(value.length, selectionEnd - token.start);
    const selectionValue = value.substring(selectionStartInToken, selectionEndInToken);
    
    if (selectionValue) {
      const actualSelectionStart = Math.max(token.start, selectionStart);
      const actualSelectionEnd = Math.min(token.end, selectionEnd);
      
      // NEW: Verificamos si este token contiene el último carácter seleccionado
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
          lastCharToken.isLastSelectedChar = true; // NEW: Marcamos como último carácter
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
    
    // NEW: Add visual block cursor class for last selected character
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

// Main application class
class NeovimHandler {
  constructor() {
    this.initializeElements();
    this.initializeHighlighters();
    this.initializeProcessors();
    this.initEventListeners();
    this.updateUI();
  }

  initializeElements() {
    this.languageSelect = document.getElementById('language-select');
    this.modeSelect = document.getElementById('mode-select');
    this.sourceCodeTextarea = document.getElementById('source-code');
    this.convertBtn = document.getElementById('convert-btn');
    this.copyBtn = document.getElementById('copy-btn');
    this.copyPreviewBtn = document.getElementById('copy-preview-btn');
    this.previewOutput = document.getElementById('preview-output');
    this.sourceOutput = document.getElementById('source-output');
    this.statusBar = document.getElementById('status-bar');
    this.selectionText = document.getElementById('selection-text');
  }

  initializeHighlighters() {
    this.highlighters = {
      'javascript': new JavaScriptHighlighter(),
      'typescript': new TypeScriptHighlighter(),
      'python': new PythonHighlighter(),
      'css': new CSSHighlighter(),
      'html': new HTMLHighlighter(),
      'java': new JavaHighlighter(),
      'swift': new SwiftHighlighter()
    };
  }

  initializeProcessors() {
    this.visualEffectsProcessor = new VisualEffectsProcessor();
    // Initialize renderer without highlighter (will be set in processCode)
    this.renderer = null;
  }

  initEventListeners() {
    this.convertBtn.addEventListener('click', () => this.handleConvert());
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());
    this.copyPreviewBtn.addEventListener('click', () => this.copyPreviewToClipboard());
    
    this.sourceCodeTextarea.addEventListener('select', () => this.updateUI());
    this.sourceCodeTextarea.addEventListener('mouseup', () => this.updateUI());
    this.sourceCodeTextarea.addEventListener('keyup', () => this.updateUI());
    this.modeSelect.addEventListener('change', () => this.updateUI());
  }

  updateUI() {
    this.updateSelectionInfo();
    this.updateStatusBar();
  }

  updateSelectionInfo() {
    const textarea = this.sourceCodeTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const mode = this.modeSelect.value;

    if (selectedText.length > 0) {
      this.selectionText.textContent = `Selected: "${selectedText}" (${selectedText.length} chars)`;
    } else {
      // Show cursor position for insert mode
      if (mode === 'insert') {
        this.selectionText.textContent = `Cursor position: ${start}`;
      } else {
        this.selectionText.textContent = 'No text selected';
      }
    }
  }

  updateStatusBar() {
    const mode = this.modeSelect.value.toUpperCase();
    this.statusBar.textContent = `-- ${mode} --`;
  }

  handleConvert() {
    const sourceCode = this.sourceCodeTextarea.value;
    const language = this.languageSelect.value;
    const mode = this.modeSelect.value;

    if (!sourceCode.trim()) {
      alert('Please enter some source code');
      return;
    }

    const start = this.sourceCodeTextarea.selectionStart;
    const end = this.sourceCodeTextarea.selectionEnd;

    // Special handling for Insert mode with no selection
    if (mode === 'insert' && start === end) {
      // Use cursor position for insert mode
      try {
        const result = this.processCode(sourceCode, language, mode, start, start);
        this.displayResults(result);
      } catch (error) {
        console.error('Error processing code:', error);
        alert('Error processing code. Please check your input.');
      }
      return;
    }

    // For visual mode, require selection
    if (mode === 'visual' && start === end) {
      alert('Please select some text in the source code for Visual mode');
      return;
    }

    // For other modes, require selection
    if (mode !== 'visual' && start === end) {
      alert('Please select some text in the source code');
      return;
    }

    try {
      const result = this.processCode(sourceCode, language, mode, start, end);
      this.displayResults(result);
    } catch (error) {
      console.error('Error processing code:', error);
      alert('Error processing code. Please check your input.');
    }
  }

  processCode(sourceCode, language, mode, selectionStart, selectionEnd) {
    // Get the appropriate highlighter
    const highlighter = this.highlighters[language] || this.highlighters['javascript'];
    
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

  displayResults(processedCode) {
    // Clear any placeholder content first
    this.previewOutput.innerHTML = '';
    
    // Display in preview (with styling) - preserve all whitespace and line breaks
    this.previewOutput.style.whiteSpace = 'pre-wrap';
    this.previewOutput.style.fontFamily = 'inherit';
    this.previewOutput.style.margin = '0';
    this.previewOutput.style.padding = '16px';
    this.previewOutput.style.lineHeight = '1.5';
    this.previewOutput.style.color = '#ebdbb2';
    this.previewOutput.innerHTML = processedCode;

    // Display in source (raw HTML)
    this.sourceOutput.querySelector('code').textContent = processedCode;
  }

  copyToClipboard() {
    const sourceCode = this.sourceOutput.querySelector('code').textContent;

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(sourceCode)
        .then(() => {
          this.showCopyFeedback();
        })
        .catch((err) => {
          console.error('Failed to copy: ', err);
          this.fallbackCopy(sourceCode);
        });
    } else {
      this.fallbackCopy(sourceCode);
    }
  }

  copyPreviewToClipboard() {
    const previewContent = this.previewOutput.innerHTML;

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(previewContent)
        .then(() => {
          this.showCopyPreviewFeedback();
        })
        .catch((err) => {
          console.error('Failed to copy: ', err);
          this.fallbackCopy(previewContent);
        });
    } else {
      this.fallbackCopy(previewContent);
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      this.showCopyFeedback();
    } catch (err) {
      console.error('Fallback copy failed: ', err);
      alert('Copy failed. Please select and copy manually.');
    }

    document.body.removeChild(textArea);
  }

  showCopyFeedback() {
    const originalText = this.copyBtn.textContent;
    this.copyBtn.textContent = 'Copied!';
    this.copyBtn.style.background = 'var(--green)';

    setTimeout(() => {
      this.copyBtn.textContent = originalText;
      this.copyBtn.style.background = '';
    }, 2000);
  }

  showCopyPreviewFeedback() {
    const originalText = this.copyPreviewBtn.textContent;
    this.copyPreviewBtn.textContent = 'Copied!';
    this.copyPreviewBtn.style.background = 'var(--green)';

    setTimeout(() => {
      this.copyPreviewBtn.textContent = originalText;
      this.copyPreviewBtn.style.background = '';
    }, 2000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new NeovimHandler();
});
