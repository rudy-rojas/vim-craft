// Prism.js loader and configuration for VimCraft
// This file handles the dynamic loading of Prism.js and its components

// Import Prism integration
import { PrismVimHighlighterFactory } from './prism-vim-integration.js';

class PrismLoader {
  constructor() {
    this.loaded = false;
    this.loading = false;
    this.loadPromise = null;
  }

  /**
   * Load Prism.js with essential language components
   */
  async loadPrism() {
    if (this.loaded) {
      return true;
    }

    if (this.loading) {
      return this.loadPromise;
    }

    this.loading = true;
    this.loadPromise = this._loadPrismCore()
      .then(() => this._loadLanguageComponents())
      .then(() => this._loadPrismCSS())
      .then(() => {
        this.loaded = true;
        this.loading = false;
        console.log('Prism.js loaded successfully');
        return true;
      })
      .catch(error => {
        this.loading = false;
        console.error('Failed to load Prism.js:', error);
        throw error;
      });

    return this.loadPromise;
  }

  /**
   * Load Prism core
   */
  _loadPrismCore() {
    return new Promise((resolve, reject) => {
      if (typeof Prism !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
      script.onload = () => {
        console.log('Prism core loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Prism core'));
      document.head.appendChild(script);
    });
  }

  /**
   * Load essential language components
   */
  async _loadLanguageComponents() {
    const languages = [
      'javascript',
      'typescript', 
      'python',
      'java',
      'swift',
      'css',
      'markup', // HTML/XML
      'jsx',
      'tsx'
    ];

    const promises = languages.map(lang => this._loadLanguageComponent(lang));
    
    try {
      await Promise.all(promises);
      console.log('Language components loaded:', languages);
    } catch (error) {
      console.warn('Some language components failed to load:', error);
      // Continue anyway - core languages should work
    }
  }

  /**
   * Load a single language component
   */
  _loadLanguageComponent(language) {
    return new Promise((resolve, reject) => {
      // Skip if already loaded
      if (typeof Prism !== 'undefined' && Prism.languages[language]) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${language}.min.js`;
      console.log(`----SRC: ${script.src}`)
      script.onload = () => {
        console.log(`Prism ${language} component loaded`);
        resolve();
      };
      script.onerror = () => {
        console.warn(`Failed to load prism-${language}.js`);
        resolve(); // Don't reject, just warn
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load Prism CSS theme
   */
  _loadPrismCSS() {
    return new Promise((resolve) => {
      // Check if Prism CSS is already loaded
      const existingLink = document.querySelector('link[href*="prism"]');
      if (existingLink) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
      link.onload = () => {
        console.log('Prism CSS theme loaded');
        resolve();
      };
      link.onerror = () => {
        console.warn('Failed to load Prism CSS theme');
        resolve(); // Continue without theme
      };
      document.head.appendChild(link);
    });
  }

  /**
   * Check if Prism is available
   */
  isAvailable() {
    return typeof Prism !== 'undefined' && Prism.languages;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    if (!this.isAvailable()) {
      return [];
    }

    return Object.keys(Prism.languages).filter(lang => 
      lang !== 'extend' && 
      lang !== 'insertBefore' && 
      lang !== 'DFS' &&
      typeof Prism.languages[lang] === 'object'
    );
  }

  /**
   * Create a Prism-powered highlighter for the specified language
   */
  async createHighlighter(language) {
    // Ensure Prism is loaded
    await this.loadPrism();
    
    // Create and return the highlighter using the factory
    return PrismVimHighlighterFactory.createHighlighter(language);
  }
}

// Global instance
const prismLoader = new PrismLoader();

// Auto-load Prism when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    prismLoader.loadPrism().catch(console.error);
  });
} else {
  // DOM already loaded
  prismLoader.loadPrism().catch(console.error);
}

// Export for ES module usage
export { PrismLoader, prismLoader };
