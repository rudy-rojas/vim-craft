// Import modules (to be loaded via script tags in HTML)
// Syntax highlighters are now in syntax-highlighters.js
// Neovim simulation logic is now in neovim-simulator.js

// Main application class
class NeovimHandler {
  constructor() {
    this.initializeElements();
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

  initializeProcessors() {
    // Initialize Neovim mode simulator
    this.neovimSimulator = new NeovimModeSimulator();
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

    // Validate mode input
    const validation = this.neovimSimulator.validateModeInput(mode, start, end);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    try {
      // Get the appropriate highlighter
      const highlighter = HighlighterFactory.create(language);
      
      // Process the code using the Neovim simulator
      const result = this.neovimSimulator.processCode(sourceCode, highlighter, mode, start, end);
      
      this.displayResults(result);
    } catch (error) {
      console.error('Error processing code:', error);
      alert('Error processing code. Please check your input.');
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
  new NeovimHandler();
});
