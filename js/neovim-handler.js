// Token-based syntax highlighting system
class Token {
  constructor(type, value, start, end) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.end = end;
    this.cursor = null;      // Para efectos de cursor
    this.selected = false;   // Para selección visual
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
      {
        type: 'keyword',
        regex: '\\b(function|return|const|let|var|if|else|for|while|class|import|export|async|await|try|catch|finally)\\b',
        priority: 10
      },
      {
        type: 'string',
        regex: '"([^"\\\\]|\\\\.)*"|\'([^\'\\\\]|\\\\.)*\'|`([^`\\\\]|\\\\.)*`',
        priority: 9
      },
      {
        type: 'number',
        regex: '\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b',
        priority: 8
      },
      {
        type: 'boolean',
        regex: '\\b(true|false)\\b',
        priority: 8
      },
      {
        type: 'comment',
        regex: '//.*$|/\\*[\\s\\S]*?\\*/',
        priority: 7
      },
      {
        type: 'method',
        regex: '\\.([a-zA-Z_$][a-zA-Z0-9_$]*)',
        priority: 6
      },
      {
        type: 'operator',
        regex: '[+\\-*/%=<>!&|(){}\\[\\];,.]',
        priority: 5
      }
    ];
  }

  getTokenClassName(type) {
    const classMap = {
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
    
    for (let i = 0; i < result.length; i++) {
      const token = result[i];
      
      // Check if token overlaps with selection
      if (token.start < selectionEnd && token.end > selectionStart) {
        const overlapStart = Math.max(token.start, selectionStart);
        const overlapEnd = Math.min(token.end, selectionEnd);
        
        if (overlapStart < overlapEnd) {
          const newTokens = this.splitTokenForSelection(token, overlapStart, overlapEnd);
          result.splice(i, 1, ...newTokens);
          i += newTokens.length - 1; // Adjust index for added tokens
        }
      }
    }

    return result;
  }

  splitTokenForSelection(token, selectionStart, selectionEnd) {
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
    
    // Selection part
    const selectionStartInToken = Math.max(0, selectionStart - token.start);
    const selectionEndInToken = Math.min(value.length, selectionEnd - token.start);
    const selectionValue = value.substring(selectionStartInToken, selectionEndInToken);
    
    if (selectionValue) {
      const selectionToken = new Token(
        token.type,
        selectionValue,
        Math.max(token.start, selectionStart),
        Math.min(token.end, selectionEnd)
      );
      selectionToken.selected = true;
      tokens.push(selectionToken);
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
    
    // Add selection class
    if (token.selected) {
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
    this.previewOutput = document.getElementById('preview-output');
    this.sourceOutput = document.getElementById('source-output');
    this.statusBar = document.getElementById('status-bar');
    this.selectionText = document.getElementById('selection-text');
  }

  initializeHighlighters() {
    this.highlighters = {
      'javascript': new JavaScriptHighlighter(),
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
    // Display in preview (with styling) - preserve all whitespace and line breaks
    this.previewOutput.style.whiteSpace = 'pre';
    this.previewOutput.style.fontFamily = 'inherit';
    this.previewOutput.style.margin = '0';
    this.previewOutput.style.padding = '0';
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new NeovimHandler();
});