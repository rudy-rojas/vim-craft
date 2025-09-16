# VimCraft - Modular Architecture

## Overview

The VimCraft project has been refactored into a modular architecture that separates concerns and makes the codebase more maintainable and extensible.

## Architecture

### 1. Syntax Highlighters Module (`js/syntax-highlighters.js`)

Contains all the syntax highlighting logic:

- **Token**: Base class for representing code tokens
- **BaseHighlighter**: Abstract base class for all language highlighters
- **Language-specific highlighters**:
  - JavaScriptHighlighter
  - TypeScriptHighlighter (with React, NestJS, NextJS support)
  - PythonHighlighter
  - CSSHighlighter
  - HTMLHighlighter
  - JavaHighlighter
  - SwiftHighlighter
- **HighlighterFactory**: Factory pattern for creating highlighters

### 2. Neovim Simulator Module (`js/neovim-simulator.js`)

Contains all the Neovim behavior simulation:

- **VisualEffectsProcessor**: Handles cursor and selection effects for different Vim modes
- **TokenRenderer**: Renders tokens with appropriate CSS classes
- **NeovimModeSimulator**: Main class that orchestrates the Neovim simulation

### 3. Main Application (`js/neovim-handler.js`)

Contains the UI logic and orchestrates the modules:

- **NeovimHandler**: Main application class that handles UI interactions and coordinates between modules

## Benefits of the Modular Structure

### 1. Separation of Concerns
- **Syntax highlighting** is isolated from Neovim simulation
- **UI logic** is separated from business logic
- Each module has a single responsibility

### 2. Extensibility
- Easy to add new syntax highlighters without touching Neovim logic
- New Vim modes can be added by extending the NeovimModeSimulator
- UI can be modified independently

### 3. Maintainability
- Smaller, focused files are easier to understand and modify
- Clear boundaries between different functionalities
- Easier to debug issues in specific areas

### 4. Testability
- Each module can be tested independently
- Mock objects can be easily created for testing
- Unit tests can focus on specific functionality

## How to Add a New Syntax Highlighter

1. **Create a new highlighter class** in `syntax-highlighters.js`:

```javascript
class NewLanguageHighlighter extends BaseHighlighter {
  getPatterns() {
    return [
      {
        type: 'keyword',
        regex: '\\b(your|keywords|here)\\b',
        priority: 9
      },
      // ... more patterns
    ];
  }

  getTokenClassName(type) {
    const classMap = {
      'keyword': 'new-lang-keyword',
      // ... more mappings
    };
    return classMap[type];
  }
}
```

2. **Update the HighlighterFactory**:

```javascript
static create(language) {
  const highlighters = {
    'javascript': JavaScriptHighlighter,
    'typescript': TypeScriptHighlighter,
    // ... existing highlighters
    'newlanguage': NewLanguageHighlighter, // Add your new highlighter
  };
  // ...
}
```

3. **Add CSS styles** for your new token classes in `gruvbox-styles.css`

4. **Update the HTML select** to include the new language option

## How to Add a New Vim Mode

1. **Extend the VisualEffectsProcessor** in `neovim-simulator.js`:

```javascript
constructor() {
  this.modeProcessors = {
    'normal': this.processNormalMode.bind(this),
    'insert': this.processInsertMode.bind(this),
    'visual': this.processVisualMode.bind(this),
    'newmode': this.processNewMode.bind(this), // Add your new mode
  };
}

processNewMode(tokens, selectionStart, selectionEnd) {
  // Implement your new mode logic
  return tokens;
}
```

2. **Update the mode validation** in NeovimModeSimulator if needed

3. **Add the new mode** to the HTML select options

## File Dependencies

```
index.html
├── syntax-highlighters.js (loaded first)
├── neovim-simulator.js (depends on syntax-highlighters.js)
└── neovim-handler.js (depends on both previous modules)
```

## Module Exports

Each module exports its classes for potential use in other contexts or testing:

```javascript
// syntax-highlighters.js exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Token,
    BaseHighlighter,
    // ... all highlighter classes
    HighlighterFactory
  };
}

// neovim-simulator.js exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VisualEffectsProcessor,
    TokenRenderer,
    NeovimModeSimulator
  };
}
```

This modular structure makes VimCraft more professional, maintainable, and ready for future enhancements.
