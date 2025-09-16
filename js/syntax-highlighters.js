// Token-based syntax highlighting system
class Token {
  constructor(type, value, start, end) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.end = end;
    this.cursor = null;      // Para efectos de cursor
    this.selected = false;   // Para selección visual
    this.isLastSelectedChar = false; // Para marcar el último carácter seleccionado
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

// Highlighter factory
class HighlighterFactory {
  static create(language) {
    const highlighters = {
      'javascript': JavaScriptHighlighter,
      'typescript': TypeScriptHighlighter,
      'python': PythonHighlighter,
      'css': CSSHighlighter,
      'html': HTMLHighlighter,
      'java': JavaHighlighter,
      'swift': SwiftHighlighter
    };

    const HighlighterClass = highlighters[language] || JavaScriptHighlighter;
    return new HighlighterClass();
  }

  static getSupportedLanguages() {
    return ['javascript', 'typescript', 'python', 'css', 'html', 'java', 'swift'];
  }
}

// Export for ES module usage
export {
    BaseHighlighter, CSSHighlighter, HighlighterFactory, HTMLHighlighter,
    JavaHighlighter, JavaScriptHighlighter, PythonHighlighter, SwiftHighlighter, Token, TypeScriptHighlighter
};

