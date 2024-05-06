function convertToJSX() {
    const htmlTextarea = document.querySelector('.htmlTextarea');
    const jsxTextarea = document.querySelector('.jsxTextarea');
    const stylingSelect = document.getElementById('styling-select').value; //btn for chosing styling type
    // Your conversion logic goes here
    // This is a simple example, you may use a library or implement your own conversion logic

    const htmlCode = htmlTextarea.value;
    let jsxCode = htmlCode;

    
 
    // Conversion logic
    // Handle CSS Modules
    if (stylingSelect === 'css-modules') {
        jsxCode = jsxCode.replace(/class="/g, 'className={styles.');
        jsxCode = jsxCode.replace(/"[^"]*"/g, match => {
            const classNames = match.substring(1, match.length - 1).split(' ');
            const camelCaseClassNames = classNames.map(className => {
                // Convert non-camel case to camel case
                return className.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
            });
            return `"${camelCaseClassNames.join(' ')}"}`;
        });
    } 
    // Handle Inline Styles
    else if (stylingSelect === 'inline-styles') {
        // Placeholder, you need to implement this part
        // Here you would replace HTML element's classes with inline styles
        // For example:
        // jsxCode = jsxCode.replace(/class="/g, 'style="');
    }
    // Conversion conditions for common HTML to JSX
    jsxCode = jsxCode.replace(/<div /g, '<div ');
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
    jsxCode = jsxCode.replace(/(<img[^>]+)>/g, '$1 />'); // Closing tag for <img>
    jsxCode = jsxCode.replace(/ class=/g, ' className='); // Convert class to className
    // Handle HTML comments
     jsxCode = jsxCode.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

    // Set the converted JSX code to the second textarea
    jsxTextarea.value = jsxCode;
}