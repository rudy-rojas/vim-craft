// Prism.js integration layer for VimCraft
// This file integrates Prism.js as the base highlighting engine
// and adds Vim simulation capabilities on top

/**
 * Enhanced Token class with accurate content preservation
 */
class VimToken {
  constructor(content, type = 'text', cssClasses = [], context = '') {
    this.content = content;         // The actual text content
    this.type = type;               // Token type from Prism
    this.cssClasses = cssClasses;   // Array of CSS classes to apply
    this.context = context;         // Additional context information
    
    // Vim-specific properties
    this.cursor = null;              
    this.selected = false;           
    this.isLastSelectedChar = false; 
    
    // Legacy compatibility
    this.value = content;           // For backward compatibility
    this.prismClasses = cssClasses; // For backward compatibility
  }
  
  /**
   * Create a copy of this VimToken with new properties
   */
  copy(newContent, newType, newCssClasses) {
    const newToken = new VimToken(
      newContent || this.content, 
      newType || this.type, 
      newCssClasses || this.cssClasses, 
      this.context
    );
    
    // Preserve Vim-specific properties (but reset selection/cursor state)
    newToken.cursor = null;
    newToken.selected = false;
    newToken.isLastSelectedChar = false;
    
    return newToken;
  }
}

/**
 * Simple and accurate Prism to Vim token converter
 */
class PrismVimHighlighter {
  constructor(language = 'javascript') {
    this.language = language;
    this.ensurePrismLoaded();
  }
  
  ensurePrismLoaded() {
    if (typeof Prism === 'undefined') {
      console.warn('Prism.js not loaded');
      this.useFallback = true;
      return;
    }
    
    if (!Prism.languages[this.language]) {
      console.warn(`Language ${this.language} not loaded`);
      if (this.language === 'html' && Prism.languages.markup) {
        this.language = 'markup';
      } else {
        this.useFallback = true;
      }
    }
    
    this.useFallback = false;
  }
  
  /**
   * Tokenize code preserving Prism's nested structure
   */
  tokenize(code) {
    if (this.useFallback) {
      return [new VimToken(code, 'text', [])];
    }
    
    try {
      // Get Prism tokens
      const prismTokens = Prism.tokenize(code, Prism.languages[this.language]);
      
      // Convert to VimTokens preserving nested structure
      const vimTokens = [];
      this.convertPrismToVim(prismTokens, vimTokens);
      
      // Verify we preserved all content
      const originalLength = code.length;
      const reconstructedLength = vimTokens.reduce((sum, token) => sum + token.content.length, 0);
      
      if (originalLength !== reconstructedLength) {
        console.warn(`Content length mismatch: original=${originalLength}, reconstructed=${reconstructedLength}`);
        console.warn('Falling back to simple tokenization');
        return [new VimToken(code, 'text', [])];
      }
      
      // Apply rainbow brackets
      this.applyRainbowBrackets(vimTokens);
      
      return vimTokens;
    } catch (error) {
      console.error('Tokenization failed:', error);
      return [new VimToken(code, 'text', [])];
    }
  }
  
  /**
   * Convert Prism tokens to VimTokens while preserving structure
   */
  convertPrismToVim(prismTokens, output) {
    for (const token of prismTokens) {
      if (typeof token === 'string') {
        // Simple string token
        output.push(new VimToken(token, 'text', []));
      } else if (token && typeof token === 'object') {
        // Complex Prism token - render it as HTML and parse back
        const renderedHTML = this.renderPrismTokenAsHTML(token);
        const vimToken = new VimToken(
          this.extractContent(token),
          token.type || 'text',
          [],  // CSS classes will be embedded in the HTML
          token.type || ''
        );
        // Store the original HTML rendering for later use
        vimToken.originalHTML = renderedHTML;
        output.push(vimToken);
      }
    }
  }
  
  /**
   * Render a Prism token exactly as Prism would, preserving all nesting
   */
  renderPrismTokenAsHTML(token) {
    if (typeof token === 'string') {
      return this.escapeHtml(token);
    }
    
    if (!token || typeof token !== 'object') {
      return '';
    }
    
    const classes = ['token'];
    if (token.type) {
      classes.push(token.type);
    }
    
    // Handle aliases
    if (token.alias) {
      if (Array.isArray(token.alias)) {
        classes.push(...token.alias);
      } else {
        classes.push(token.alias);
      }
    }
    
    let content = '';
    if (typeof token.content === 'string') {
      content = this.escapeHtml(token.content);
    } else if (Array.isArray(token.content)) {
      content = token.content.map(item => this.renderPrismTokenAsHTML(item)).join('');
    } else if (token.content && typeof token.content === 'object') {
      content = this.renderPrismTokenAsHTML(token.content);
    }
    
    return `<span class="${classes.join(' ')}">${content}</span>`;
  }
  
  /**
   * Extract content from a Prism token, handling nested structures
   */
  extractContent(token) {
    if (typeof token === 'string') {
      return token;
    }
    
    if (!token || typeof token !== 'object') {
      return '';
    }
    
    const content = token.content;
    
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content.map(item => this.extractContent(item)).join('');
    }
    
    if (content && typeof content === 'object') {
      return this.extractContent(content);
    }
    
    return '';
  }
  
  /**
   * Render tokens to HTML
   */
  render(vimTokens) {
    return vimTokens.map(token => this.renderToken(token)).join('');
  }
  
  /**
   * Render a single token
   */
  renderToken(token) {
    // Handle newlines
    if (token.content === '\n') {
      if (token.selected) {
        return '<span class="visual-selection">\n</span>';
      }
      return '\n';
    }
    
    // Handle empty cursor tokens
    if (token.type === 'cursor' && token.content === '') {
      return '<span class="cursor-insert"></span>';
    }
    
    // Use pre-rendered HTML if available (preserves Prism structure)
    if (token.originalHTML) {
      let html = token.originalHTML;
      
      // Apply Vim-specific classes if needed
      if (token.cursor || token.selected || token.isLastSelectedChar) {
        const vimClasses = [];
        if (token.cursor) vimClasses.push(token.cursor);
        if (token.isLastSelectedChar) vimClasses.push('visual-block-cursor');
        else if (token.selected) vimClasses.push('visual-selection');
        
        if (vimClasses.length > 0) {
          // Wrap the entire token with Vim classes
          html = `<span class="${vimClasses.join(' ')}">${html}</span>`;
        }
      }
      
      return html;
    }
    
    // Fallback to standard rendering
    const escapedContent = this.escapeHtml(token.content);
    
    // Build CSS classes
    const classes = [...token.cssClasses];
    
    // Handle cursor
    if (token.cursor) {
      classes.push(token.cursor);
    }
    
    // Handle selection
    if (token.isLastSelectedChar) {
      classes.push('visual-block-cursor');
    } else if (token.selected) {
      classes.push('visual-selection');
    }
    
    // Render with classes
    if (classes.length > 0) {
      // Remove duplicates
      const uniqueClasses = [...new Set(classes)];
      return `<span class="${uniqueClasses.join(' ')}">${escapedContent}</span>`;
    }
    
    return escapedContent;
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  /**
   * Apply rainbow bracket classes to tokens
   */
  applyRainbowBrackets(vimTokens) {
    const bracketMap = {
      '(': 'brace-round',
      ')': 'brace-round',
      '[': 'brace-square', 
      ']': 'brace-square',
      '{': 'brace-curly',
      '}': 'brace-curly'
    };
    
    const openBrackets = ['(', '[', '{'];
    const closeBrackets = [')', ']', '}'];
    const bracketPairs = {'(': ')', '[': ']', '{': '}'};
    
    const bracketStack = [];
    let level = 0;
    
    for (const token of vimTokens) {
      if (token.originalHTML) {
        // Apply rainbow brackets to pre-rendered HTML
        token.originalHTML = this.applyRainbowBracketsToHTML(token.originalHTML, bracketStack, { level });
      } else {
        // Apply to simple tokens
        if (token.cssClasses && token.cssClasses.includes('punctuation')) {
          const content = token.content.trim();
          
          // Skip JSX/HTML angle brackets
          if (content === '<' || content === '>') {
            continue;
          }
          
          if (bracketMap[content]) {
            // Add base bracket class
            token.cssClasses.push(bracketMap[content]);
            
            if (openBrackets.includes(content)) {
              // Opening bracket
              level++;
              token.cssClasses.push(`brace-level-${((level - 1) % 12) + 1}`);
              bracketStack.push({
                type: content,
                level: level
              });
            } else if (closeBrackets.includes(content)) {
              // Closing bracket
              if (bracketStack.length > 0) {
                const lastOpen = bracketStack[bracketStack.length - 1];
                if (bracketPairs[lastOpen.type] === content) {
                  // Matching pair found
                  token.cssClasses.push(`brace-level-${((lastOpen.level - 1) % 12) + 1}`);
                  bracketStack.pop();
                  level = Math.max(0, level - 1);
                }
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Apply rainbow brackets to HTML string
   */
  applyRainbowBracketsToHTML(html, bracketStack, levelRef) {
    const bracketMap = {
      '(': 'brace-round',
      ')': 'brace-round',
      '[': 'brace-square', 
      ']': 'brace-square',
      '{': 'brace-curly',
      '}': 'brace-curly'
    };
    
    const openBrackets = ['(', '[', '{'];
    const closeBrackets = [')', ']', '}'];
    const bracketPairs = {'(': ')', '[': ']', '{': '}'};
    
    // Use regex to find punctuation spans and add rainbow classes
    return html.replace(/<span class="([^"]*token[^"]*punctuation[^"]*)"([^>]*)>([()[\]{}])<\/span>/g, (match, classes, attrs, bracket) => {
      // Skip angle brackets
      if (bracket === '<' || bracket === '>') {
        return match;
      }
      
      if (bracketMap[bracket]) {
        const newClasses = classes + ' ' + bracketMap[bracket];
        
        if (openBrackets.includes(bracket)) {
          levelRef.level++;
          const levelClass = `brace-level-${((levelRef.level - 1) % 12) + 1}`;
          bracketStack.push({
            type: bracket,
            level: levelRef.level
          });
          return `<span class="${newClasses} ${levelClass}"${attrs}>${bracket}</span>`;
        } else if (closeBrackets.includes(bracket)) {
          if (bracketStack.length > 0) {
            const lastOpen = bracketStack[bracketStack.length - 1];
            if (bracketPairs[lastOpen.type] === bracket) {
              const levelClass = `brace-level-${((lastOpen.level - 1) % 12) + 1}`;
              bracketStack.pop();
              levelRef.level = Math.max(0, levelRef.level - 1);
              return `<span class="${newClasses} ${levelClass}"${attrs}>${bracket}</span>`;
            }
          }
          return `<span class="${newClasses}"${attrs}>${bracket}</span>`;
        }
      }
      
      return match;
    });
  }
}

/**
 * Factory for creating highlighters
 */
class PrismVimHighlighterFactory {
  static createHighlighter(language) {
    return new PrismVimHighlighter(language);
  }
  
  static create(language) {
    return new PrismVimHighlighter(language);
  }
  
  /**
   * Get supported languages from Prism
   */
  static getSupportedLanguages() {
    if (typeof Prism === 'undefined') {
      return ['javascript', 'typescript', 'python', 'css', 'html', 'java', 'swift'];
    }
    
    return Object.keys(Prism.languages).filter(lang => 
      lang !== 'extend' && 
      lang !== 'insertBefore' && 
      lang !== 'DFS' &&
      typeof Prism.languages[lang] === 'object'
    );
  }
  
  static isPrismAvailable() {
    return typeof Prism !== 'undefined' && Prism.languages;
  }
}

// Export for ES modules
export { PrismVimHighlighter, PrismVimHighlighterFactory, VimToken };

// Make available globally for compatibility
if (typeof window !== 'undefined') {
  window.VimToken = VimToken;
  window.PrismVimHighlighter = PrismVimHighlighter;
  window.PrismVimHighlighterFactory = PrismVimHighlighterFactory;
}
