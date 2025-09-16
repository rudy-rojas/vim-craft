// Import modules (to be loaded via script tags in HTML)
// Syntax highlighters are now in syntax-highlighters.js
// Neovim simulation logic is now in neovim-simulator.js

// Main application class
class NeovimHandler {
  constructor() {
    console.log('NeovimHandler initializing...');
    this.currentLanguage = null;
    this.neovimSimulator = null;
    this.initializeElements();
    this.initializeProcessors();
    this.initEventListeners();
    this.updateUI();
    console.log('NeovimHandler initialized successfully');
  }

  initializeElements() {
    this.languageSelect = document.getElementById('language-select');
    this.modeSelect = document.getElementById('mode-select');
    this.sourceCodeTextarea = document.getElementById('source-code');
    this.convertBtn = document.getElementById('convert-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.copyBtn = document.getElementById('copy-btn');
    this.copyPreviewBtn = document.getElementById('copy-preview-btn');
    this.previewOutput = document.getElementById('preview-output');
    this.sourceOutput = document.getElementById('source-output');
    this.statusBar = document.getElementById('status-bar');
    this.selectionText = document.getElementById('selection-text');
  }

  initializeProcessors() {
    // Neovim simulator will be initialized in handleConvert based on language
    this.neovimSimulator = null;
  }

  initEventListeners() {
    this.convertBtn.addEventListener('click', () => this.handleConvert());
    this.clearBtn.addEventListener('click', () => this.handleClear());
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

  async handleConvert() {
    console.log('=== handleConvert started ===');
    
    const sourceCode = this.sourceCodeTextarea.value;
    const language = this.languageSelect.value;
    const mode = this.modeSelect.value;

    console.log('Input values:', { sourceCode: sourceCode.length + ' chars', language, mode });

    if (!sourceCode.trim()) {
      alert('Please enter some source code');
      return;
    }

    const start = this.sourceCodeTextarea.selectionStart;
    const end = this.sourceCodeTextarea.selectionEnd;

    console.log('Selection:', { start, end });

    try {
      // Initialize simulator if not already done or if language changed
      if (!this.neovimSimulator || this.currentLanguage !== language) {
        console.log('Need to initialize simulator');
        await this.initializeSimulator(language);
        this.currentLanguage = language;
        console.log('Simulator initialized successfully');
      } else {
        console.log('Using existing simulator');
      }

      // Validate mode input
      console.log('Validating mode input...');
      const validation = this.neovimSimulator.validateModeInput(mode, start, end);
      if (!validation.valid) {
        console.log('Validation failed:', validation.errors);
        alert(validation.errors.join('\n'));
        return;
      }
      console.log('Validation passed');

      // Process the code using the Neovim simulator
      console.log('Processing code...');
      const result = this.neovimSimulator.processCode(sourceCode, mode, start, end);
      console.log('Code processed, result length:', result.length);
      
      this.displayResults(result);
      console.log('=== handleConvert completed successfully ===');
    } catch (error) {
      console.error('=== Error in handleConvert ===');
      console.error('Error processing code:', error);
      console.error('Stack trace:', error.stack);
      alert('Error processing code. Please check your input.');
    }
  }

  handleClear() {
    this.sourceCodeTextarea.value = '';
    this.sourceCodeTextarea.focus();
    this.updateUI(); // Update selection info
    console.log('Source code cleared');
  }

  async initializeSimulator(language) {
    console.log('Initializing simulator for language:', language);
    
    try {
      // Load Prism and create Prism-powered highlighter
      console.log('Loading Prism.js for enhanced highlighting...');
      
      // Import the Prism loader
      const { PrismLoader } = await import('./prism-loader.js');
      console.log('PrismLoader imported successfully');
      
      // Initialize Prism for the selected language
      const prismLoader = new PrismLoader();
      console.log('Creating Prism highlighter for:', language);
      const highlighter = await prismLoader.createHighlighter(language);
      console.log('Prism highlighter created:', highlighter);
      
      // Import NeovimSimulator
      const { NeovimSimulator } = await import('./neovim-simulator.js');
      console.log('NeovimSimulator imported successfully');
      this.neovimSimulator = new NeovimSimulator(highlighter);
      console.log('NeovimSimulator initialized with Prism highlighter');
    } catch (error) {
      console.error('Failed to initialize Prism highlighter:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
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
  console.log('DOM loaded, initializing NeovimHandler...');
  try {
    new NeovimHandler();
  } catch (error) {
    console.error('Failed to initialize NeovimHandler:', error);
  }
});
