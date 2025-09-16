# Neovim "View" Simulator

A web-based tool that simulates Neovim's visual modes and syntax highlighting for code snippets.

## 🚀 Demo

**Try it live:** [https://rudy-rojas.github.io/vim-craft/](https://rudy-rojas.github.io/vim-craft/)

## ✨ Features

- **Multi-language syntax highlighting**: JavaScript, TypeScript, JSX, TSX, Python, CSS, HTML, Java, Swift
- **Neovim mode simulation**: Normal, Insert, and Visual modes
- **Rainbow brackets**: Color-coded matching brackets with hover effects
- **Match-braces functionality**: Hover over brackets to highlight matching pairs
- **Real-time preview**: See how your code would look in Neovim
- **Copy HTML output**: Get the generated HTML for your projects

## 🎯 How to Use

1. **Select Language**: Choose your programming language from the dropdown
2. **Choose Mode**: Select between Normal, Insert, or Visual mode
3. **Enter Code**: Paste or type your code in the text area
4. **Position Cursor/Selection**: 
   - **Normal**: Click to position cursor
   - **Insert**: Click to position cursor (shows vertical line)
   - **Visual**: Select text to highlight
5. **Convert**: Click the Convert button to generate the result

## 📖 Example

**Input (CSS):**
```css
.container {
    display: flex;
    gap: 20px;
}
```

## 🎨 Using VimCraft Output Externally

To use the generated HTML in your own projects, you'll need these CSS files:

### Required Files
<!-- - `css/gruvbox-styles.css` - Base Gruvbox theme and Neovim styling -->
- `path/to/prism-tomorrow.css` - Syntax highlighting theme
- `path/to/prism-match-braces.css` - Bracket matching styles
- `path/to/vim-craft-essential.css` - VimCraft-specific enhancements

### Integration Example
```html
<!DOCTYPE html>
<html>
<head>
    <!-- <link rel="stylesheet" href="css/gruvbox-styles.css"> -->
    <link rel="stylesheet" href="vendor/prism/themes/prism-tomorrow.css">
    <link rel="stylesheet" href="vendor/prism/themes/prism-match-braces.css">
    <link rel="stylesheet" href="vim-craft-essential.css">
</head>
<body>
    <pre>
        <code>
            <!-- Your VimCraft generated HTML here -->
        </code>
    </pre>
</body>
</html>
```
