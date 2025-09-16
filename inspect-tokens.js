// Test script to check token classes in browser console
// Run this in the browser console after converting the code

function inspectTokens() {
  const output = document.querySelector('#vim-output code');
  if (!output) {
    console.log('No output found');
    return;
  }
  
  const tokens = output.querySelectorAll('span');
  console.log('Token inspection:');
  
  tokens.forEach((token, index) => {
    const text = token.textContent.trim();
    const classes = Array.from(token.classList);
    
    // Focus on angle brackets and punctuation
    if (text === '<' || text === '>' || text === '{' || text === '}' || text === '(' || text === ')' || text === '[' || text === ']') {
      console.log(`Token ${index}: "${text}" - Classes: ${classes.join(', ')}`);
    }
  });
}

// Also check for JSX tags specifically
function inspectJSXTags() {
  const output = document.querySelector('#vim-output code');
  if (!output) return;
  
  const tagTokens = output.querySelectorAll('.token.tag, .token.tag .token.punctuation, .token.punctuation.tag');
  console.log('JSX/HTML tag tokens:');
  
  tagTokens.forEach((token, index) => {
    console.log(`Tag token ${index}: "${token.textContent}" - Classes: ${Array.from(token.classList).join(', ')}`);
  });
}

// Run both
inspectTokens();
inspectJSXTags();
