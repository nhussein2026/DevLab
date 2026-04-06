function convertToJSX() {
  const htmlTextarea = document.querySelector(".htmlTextarea");
  const jsxTextarea = document.querySelector(".jsxTextarea");
  const stylingSelect = document.getElementById("styling-select")
    ? document.getElementById("styling-select").value
    : "standard";

  if (!htmlTextarea || !jsxTextarea) return;

  const htmlCode = htmlTextarea.value;
  let jsxCode = htmlCode;

  // Basic HTML to JSX conversion
  if (stylingSelect === "css-modules") {
    // Convert class="class-name" to className={styles.className}
    jsxCode = jsxCode.replace(/class="([^"]*)"/g, (match, classNames) => {
      const classes = classNames.split(" ").map((cls) => {
        // Convert kebab-case to camelCase
        return cls.replace(/-([a-z])/g, (m, letter) => letter.toUpperCase());
      });
      return `className={styles.${classes.join(" ")}}`;
    });
  } else {
    // Standard conversion: class to className
    jsxCode = jsxCode.replace(/class=/g, "className=");
  }

  // Convert for to htmlFor
  jsxCode = jsxCode.replace(/for=/g, "htmlFor=");

  // Convert HTML comments to JSX comments
  jsxCode = jsxCode.replace(/<!--([\s\S]*?)-->/g, "{/*$1*/}");

  // Add closing slash to self-closing tags
  jsxCode = jsxCode.replace(
    /<(input|img|br|hr|meta|link)([^>]*)>/g,
    "<$1$2 />",
  );

  // Set the converted JSX code to the second textarea
  jsxTextarea.value = jsxCode;
}
