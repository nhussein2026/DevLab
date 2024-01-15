function initializeRepository(projectName) {
    if (!projectName) {
        alert('Please enter a project name.');
        return;
    }

    const versionControlInfo = document.getElementById('versionControlInfo');
    versionControlInfo.innerHTML = `<p>Initialized repository for "${projectName}".</p>`;
}

function cloneRepository(repositoryURL) {
    if (!repositoryURL) {
        alert('Please enter a repository URL.');
        return;
    }

    const versionControlInfo = document.getElementById('versionControlInfo');
    versionControlInfo.innerHTML = `<p>Cloned repository from "${repositoryURL}".</p>`;
}

document.getElementById('initializeButton').addEventListener('click', function () {
    const projectName = document.getElementById('projectName').value;
    initializeRepository(projectName);
});

document.getElementById('cloneButton').addEventListener('click', function () {
    const repositoryURL = document.getElementById('repositoryURL').value;
    cloneRepository(repositoryURL);
});