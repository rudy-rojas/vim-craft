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
   * Load Prism core from local files
   */
  _loadPrismCore() {
    return new Promise((resolve, reject) => {
      if (typeof Prism !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = './vendor/prism/prism-core.js';  // Local file
      script.onload = () => {
        console.log('Prism core loaded from local file');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load local Prism core'));
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
   * Load a single language component from local files
   */
  _loadLanguageComponent(language) {
    return new Promise((resolve) => {
      // Skip if already loaded
      if (typeof Prism !== 'undefined' && Prism.languages[language]) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `./vendor/prism/components/prism-${language}.js`;  // Local file
      console.log(`----SRC: ${script.src}`)
      script.onload = () => {
        console.log(`Prism ${language} component loaded`);
        resolve();
      };
      script.onerror = (error) => {
        console.warn(`Failed to load prism-${language}.js:`, error);
        resolve(); // Don't reject, just warn - always resolve to prevent promise rejection
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load Prism CSS theme from local file
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
      link.href = './vendor/prism/themes/prism-tomorrow.css';  // Tema Tomorrow
      link.onload = () => {
        console.log('Prism CSS theme loaded from local file');
        resolve();
      };
      link.onerror = () => {
        console.warn('Failed to load local Prism CSS theme');
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
    prismLoader.loadPrism().catch(error => {
      console.error('Failed to auto-load Prism:', error);
    });
  });
} else {
  // DOM already loaded
  prismLoader.loadPrism().catch(error => {
    console.error('Failed to auto-load Prism:', error);
  });
}

// Export for ES module usage
export { PrismLoader, prismLoader };
