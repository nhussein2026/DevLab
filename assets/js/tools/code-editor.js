var editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
    lineNumbers: true,
    mode: 'xml', // Initial mode
    theme: 'cobalt', // Optional theme
    autofocus: true,
    autoCloseTags: true,
    extraKeys: {
        "Ctrl-Space": "autocomplete" // Enable autocomplete
    }
});

editor.setSize("750", "325");

// choosing programming language code
// Note: Ensure an element with ID 'language-switch' exists in the HTML
const languageSwitch = document.getElementById('language-switch');
if (languageSwitch) {
    languageSwitch.addEventListener('click', function () {
        var newMode = (editor.getMode().name === 'javascript') ? 'htmlmixed' : 'javascript';
        editor.setOption('mode', newMode);
    });
}
