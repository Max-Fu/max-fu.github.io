// Session creation logic

document.addEventListener('DOMContentLoaded', () => {
  const createForm = document.getElementById('createForm');
  const sessionCreated = document.getElementById('sessionCreated');
  const createSessionBtn = document.getElementById('createSession');
  const createAnotherBtn = document.getElementById('createAnother');
  const sessionTitleInput = document.getElementById('sessionTitle');
  const authorListInput = document.getElementById('authorList');
  const resultsLinkInput = document.getElementById('resultsLink');
  const votingLinksContainer = document.getElementById('votingLinks');

  createSessionBtn.addEventListener('click', createSession);
  createAnotherBtn.addEventListener('click', resetForm);

  // Copy button functionality
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-copy')) {
      const targetId = e.target.getAttribute('data-target');
      const input = document.getElementById(targetId);
      copyToClipboard(input.value, e.target);
    }
  });

  async function createSession() {
    const title = sessionTitleInput.value.trim();
    const authorsText = authorListInput.value.trim();

    if (!title) {
      alert('Please enter a session title.');
      return;
    }

    const authors = authorsText
      .split('\n')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    if (authors.length < 2) {
      alert('Please enter at least 2 authors.');
      return;
    }

    createSessionBtn.disabled = true;
    createSessionBtn.textContent = 'Creating...';

    try {
      const sessionId = generateSessionId();
      const numVoters = authors.length - 1; // n-1 voting links
      const voterTokens = [];

      for (let i = 0; i < numVoters; i++) {
        voterTokens.push(generateToken());
      }

      // Prepare data
      const sessionData = {
        metadata: {
          title: title,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          status: 'active',
          totalVoters: numVoters
        },
        authors: {},
        voterTokens: {}
      };

      // Add authors
      authors.forEach((author, index) => {
        sessionData.authors[index] = author;
      });

      // Add voter tokens
      voterTokens.forEach(token => {
        sessionData.voterTokens[token] = { used: false };
      });

      // Save to Firebase
      await database.ref(`voting-sessions/${sessionId}`).set(sessionData);

      // Generate URLs
      const baseUrl = window.location.origin + window.location.pathname.replace('create.html', '');
      const resultsUrl = `${baseUrl}?session=${sessionId}`;

      resultsLinkInput.value = resultsUrl;

      // Generate voting links
      votingLinksContainer.innerHTML = '';
      voterTokens.forEach((token, index) => {
        const voteUrl = `${baseUrl}vote.html?session=${sessionId}&token=${token}`;
        const linkDiv = document.createElement('div');
        linkDiv.className = 'link-container';
        linkDiv.innerHTML = `
          <span class="link-label">Voter ${index + 1}:</span>
          <input type="text" id="voteLink${index}" value="${voteUrl}" readonly>
          <button class="btn btn-copy" data-target="voteLink${index}">Copy</button>
        `;
        votingLinksContainer.appendChild(linkDiv);
      });

      // Show success
      createForm.style.display = 'none';
      sessionCreated.style.display = 'block';

    } catch (error) {
      console.error('Error creating session:', error);
      alert('Error creating session. Please check your Firebase configuration.');
    } finally {
      createSessionBtn.disabled = false;
      createSessionBtn.textContent = 'Create Session';
    }
  }

  function resetForm() {
    sessionTitleInput.value = '';
    authorListInput.value = '';
    votingLinksContainer.innerHTML = '';
    sessionCreated.style.display = 'none';
    createForm.style.display = 'block';
  }

  function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const input = document.getElementById(button.getAttribute('data-target'));
      input.select();
      document.execCommand('copy');
    });
  }
});
