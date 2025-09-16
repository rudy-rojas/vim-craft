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
   * Create VimToken from Prism token
   */
  static fromPrismToken(prismToken, start, end) {
    const token = new VimToken(
      prismToken.type || 'text',
      prismToken.content || prismToken,
      start,
      end,
      prismToken
    );
    
    // Extract CSS classes from Prism token
    if (prismToken.type) {
      token.prismClasses = ['token', prismToken.type];
      if (prismToken.alias) {
        if (Array.isArray(prismToken.alias)) {
          token.prismClasses.push(...prismToken.alias);
        } else {
          token.prismClasses.push(prismToken.alias);
        }
      }
    }
    
    return token;
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
      // Ensure the language is loaded
      if (!Prism.languages[this.language]) {
        console.warn(`Language ${this.language} not loaded in Prism. Using 'markup' as fallback.`);
        this.language = 'markup';
      }
    }
  }
  
  /**
   * Tokenize code using Prism.js with position tracking
   */
  tokenize(code) {
    if (this.useFallback) {
      return this.fallbackTokenize(code);
    }
    
    try {
      // Use Prism to tokenize
      const prismTokens = Prism.tokenize(code, Prism.languages[this.language]);
      
      // Convert to VimTokens with position tracking
      return this.convertPrismTokensToVim(prismTokens, code);
    } catch (error) {
      console.error('Prism tokenization failed:', error);
      return this.fallbackTokenize(code);
    }
  }
  
  /**
   * Convert Prism tokens to VimTokens with accurate position tracking
   */
  convertPrismTokensToVim(prismTokens, originalCode) {
    const vimTokens = [];
    let position = 0;
    
    const processToken = (token, currentPos) => {
      if (typeof token === 'string') {
        // Simple string token
        const vimToken = new VimToken('text', token, currentPos, currentPos + token.length);
        vimTokens.push(vimToken);
        return currentPos + token.length;
      } else if (token && typeof token === 'object') {
        // Prism Token object
        const content = token.content;
        const startPos = currentPos;
        
        if (typeof content === 'string') {
          // Simple token with string content
          const vimToken = VimToken.fromPrismToken(token, startPos, startPos + content.length);
          vimTokens.push(vimToken);
          return startPos + content.length;
        } else if (Array.isArray(content)) {
          // Nested tokens
          let nestedPos = startPos;
          for (const nestedToken of content) {
            nestedPos = processToken(nestedToken, nestedPos);
          }
          return nestedPos;
        }
      }
      return currentPos;
    };
    
    // Process all tokens
    for (const token of prismTokens) {
      position = processToken(token, position);
    }
    
    // Handle any remaining text (shouldn't happen with proper tokenization)
    if (position < originalCode.length) {
      const remaining = originalCode.substring(position);
      vimTokens.push(new VimToken('text', remaining, position, originalCode.length));
    }
    
    return vimTokens;
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
    PrismVimHighlighterFactory, VimToken
};

// Make VimToken globally available for compatibility
if (typeof window !== 'undefined') {
  window.VimToken = VimToken;
}
