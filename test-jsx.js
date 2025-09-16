// Test JSX/HTML tag coloring with rainbow brackets

function TestComponent(props) {
  const [state, setState] = useState(0);
  
  return (
    <div className="container">
      <h1>Title</h1>
      <p>Text with {variable} and (parentheses) and [arrays] and {objects}</p>
      <button onClick={() => handleClick(state, [1, 2, 3])}>
        Click me
      </button>
    </div>
  );
}

// More bracket testing
const data = {
  items: [1, 2, 3],
  config: { theme: "dark", options: [true, false] }
};

function processData(input) {
  return input.map((item) => ({
    ...item,
    processed: true
  }));
}
