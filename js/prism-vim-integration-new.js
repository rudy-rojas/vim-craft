// New Prism.js integration layer for VimCraft
// Simplified approach that respects Prism's token structure

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
   * Tokenize code with simple, accurate conversion
   */
  tokenize(code) {
    if (this.useFallback) {
      return [new VimToken(code, 'text', [])];
    }
    
    try {
      // Get Prism tokens
      const prismTokens = Prism.tokenize(code, Prism.languages[this.language]);
      
      // Convert to flat VimToken array
      const vimTokens = [];
      this.flattenPrismTokens(prismTokens, vimTokens);
      
      // Verify we preserved all content
      const originalLength = code.length;
      const reconstructedLength = vimTokens.reduce((sum, token) => sum + token.content.length, 0);
      
      if (originalLength !== reconstructedLength) {
        console.warn(`Content length mismatch: original=${originalLength}, reconstructed=${reconstructedLength}`);
        console.warn('Falling back to simple tokenization');
        return [new VimToken(code, 'text', [])];
      }
      
      return vimTokens;
    } catch (error) {
      console.error('Tokenization failed:', error);
      return [new VimToken(code, 'text', [])];
    }
  }
  
  /**
   * Flatten Prism tokens into a simple array while preserving all text
   */
  flattenPrismTokens(tokens, output) {
    for (const token of tokens) {
      if (typeof token === 'string') {
        // Simple string - add as text token
        output.push(new VimToken(token, 'text', []));
      } else if (token && typeof token === 'object') {
        // Prism token object
        this.processPrismToken(token, output);
      }
    }
  }
  
  /**
   * Process a single Prism token and add it to output
   */
  processPrismToken(token, output) {
    const content = this.extractContent(token);
    
    if (!content) return;
    
    // Build CSS classes
    const cssClasses = ['token'];
    if (token.type) {
      cssClasses.push(token.type);
    }
    
    // Handle aliases
    if (token.alias) {
      if (Array.isArray(token.alias)) {
        cssClasses.push(...token.alias);
      } else {
        cssClasses.push(token.alias);
      }
    }
    
    // Create VimToken
    const vimToken = new VimToken(
      content,
      token.type || 'text',
      cssClasses,
      token.type || ''
    );
    
    output.push(vimToken);
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
    const escapedContent = this.escapeHtml(token.content);
    
    // Handle newlines
    if (token.content === '\n') {
      if (token.selected) {
        return '<span class="visual-selection">\n</span>';
      }
      return '\n';
    }
    
    // Handle cursor
    if (token.cursor) {
      token.cssClasses.push(token.cursor);
    }
    
    // Handle selection
    if (token.isLastSelectedChar) {
      token.cssClasses.push('visual-block-cursor');
    } else if (token.selected) {
      token.cssClasses.push('visual-selection');
    }
    
    // Render with classes
    if (token.cssClasses.length > 0) {
      // Remove duplicates
      const uniqueClasses = [...new Set(token.cssClasses)];
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
}

// Export for ES modules
export { PrismVimHighlighter, PrismVimHighlighterFactory, VimToken };

// Make available globally
if (typeof window !== 'undefined') {
  window.PrismVimHighlighterNew = PrismVimHighlighter;
  window.PrismVimHighlighterFactoryNew = PrismVimHighlighterFactory;
  window.VimTokenNew = VimToken;
}
