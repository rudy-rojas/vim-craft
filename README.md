# Neovim "View" Simulator

A web-based tool that simulates Neovim's visual modes and syntax highlighting for code snippets.

## 🚀 Demo

**Try it live:** [https://rudy-rojas.github.io/nvim-view-simulator/](https://rudy-rojas.github.io/nvim-view-simulator/)

## ✨ Features

- **Multi-language syntax highlighting**: JavaScript, Python, CSS, HTML, Java, Swift
- **Neovim mode simulation**: Normal, Insert, and Visual modes
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

**Output (Visual Mode with "display: flex;" selected):**
```html
.container {
    <span class="visual-selection"><span class="css-property">display</span><span class="js-operator">:</span> <span class="css-value">flex</span><span class="js-operator">;</span></span>
    gap: 20px;
}
<div class="status-bar-ide">-- VISUAL --</div>
```
