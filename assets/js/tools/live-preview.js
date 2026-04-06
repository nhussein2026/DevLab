document.addEventListener("DOMContentLoaded", function () {
  const htmlTextarea = document.getElementById("htmlTextarea");
  const jsxTextarea = document.getElementById("jsxTextarea");
  const livePreview = document.getElementById("livePreview");

  // Function to update the live preview
  function updateLivePreview() {
    const htmlCode = htmlTextarea.value;
    const jsxCode = convertToJSX(htmlCode);
    jsxTextarea.value = jsxCode;

    // Display the HTML code in the iframe for live preview
    livePreview.srcdoc = `<html><head><style>body { font-family: Arial, sans-serif; }</style></head><body>${htmlCode}</body></html>`;
  }

  // Function to convert HTML to JSX (basic conversion)
  function convertToJSX(htmlCode) {
    let jsxCode = htmlCode;

    // Convert class to className
    jsxCode = jsxCode.replace(/class=/g, "className=");

    // Convert for to htmlFor
    jsxCode = jsxCode.replace(/for=/g, "htmlFor=");

    // Basic self-closing tags (img, input, br, hr)
    jsxCode = jsxCode.replace(/<img([^>]*)>/g, "<img$1 />");
    jsxCode = jsxCode.replace(/<input([^>]*)>/g, "<input$1 />");
    jsxCode = jsxCode.replace(/<br([^>]*)>/g, "<br$1 />");
    jsxCode = jsxCode.replace(/<hr([^>]*)>/g, "<hr$1 />");

    return jsxCode;
  }

  // Update live preview on input change
  htmlTextarea.addEventListener("input", updateLivePreview);

  // Initial update
  updateLivePreview();
});
