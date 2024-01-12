document.addEventListener('DOMContentLoaded', function () {
    const htmlTextarea = document.getElementById('htmlTextarea');
    const jsxTextarea = document.getElementById('jsxTextarea');
    const livePreview = document.getElementById('livePreview');

    // Function to update the live preview
    function updateLivePreview() {
        const htmlCode = htmlTextarea.value;
        const jsxCode = convertToJSX(htmlCode);
        jsxTextarea.value = jsxCode;

        // Display the JSX code in the iframe for live preview
        livePreview.srcdoc = `<html><body>${jsxCode}</body></html>`;
    }

    // Function to convert HTML to JSX (you can replace this with your conversion logic)
    function convertToJSX(htmlCode) {
        // Conversion conditions for common HTML to JSX
        let jsxCode = htmlCode.replace(/<div /g, '<div ');
        jsxCode = jsxCode.replace(/<span /g, '<span ');
        jsxCode = jsxCode.replace(/<p /g, '<p ');
        jsxCode = jsxCode.replace(/<h1 /g, '<h1 ');
        jsxCode = jsxCode.replace(/<h2 /g, '<h2 ');
        jsxCode = jsxCode.replace(/<h3 /g, '<h3 ');
        jsxCode = jsxCode.replace(/<h4 /g, '<h4 ');
        jsxCode = jsxCode.replace(/<h5 /g, '<h5 ');
        jsxCode = jsxCode.replace(/<h6 /g, '<h6 ');
        jsxCode = jsxCode.replace(/<img /g, '<img ');
    
        // Convert class to className
        jsxCode = jsxCode.replace(/ class=/g, ' className=');
    
        return jsxCode;
    }
    

    // Update live preview on input change
    htmlTextarea.addEventListener('input', updateLivePreview);

    // Initial update
    updateLivePreview();
});
