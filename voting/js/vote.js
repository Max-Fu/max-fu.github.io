// Voting page logic with drag-and-drop

let sessionId = null;
let voterToken = null;
let authors = [];
let currentOrder = [];

document.addEventListener('DOMContentLoaded', () => {
  sessionId = getUrlParam('session');
  voterToken = getUrlParam('token');

  if (!sessionId || !voterToken) {
    showError('Missing session or token in URL.');
    return;
  }

  loadSession();
});

async function loadSession() {
  try {
    const sessionRef = database.ref(`voting-sessions/${sessionId}`);
    const snapshot = await sessionRef.once('value');
    const session = snapshot.val();

    if (!session) {
      showError('Session not found.');
      return;
    }

    if (session.metadata.status === 'closed') {
      showError('This voting session has been closed.');
      return;
    }

    // Check if token is valid
    if (!session.voterTokens || !session.voterTokens[voterToken]) {
      showError('Invalid voting token.');
      return;
    }

    // Load authors
    authors = Object.values(session.authors);
    currentOrder = authors.map((_, i) => i);

    // Check for existing vote
    if (session.votes && session.votes[voterToken]) {
      const existingVote = session.votes[voterToken];
      currentOrder = existingVote.order;
      document.getElementById('voteStatus').textContent = 'You have already voted. You can update your vote below.';
      document.getElementById('voteStatus').classList.add('has-voted');
    }

    // Set up the UI
    document.getElementById('sessionTitle').textContent = session.metadata.title;
    document.getElementById('resultsLink').href = `index.html?session=${sessionId}`;

    setupAuthorList();
    setupCoFirstSelector();

    // If existing vote, set co-first count
    if (session.votes && session.votes[voterToken]) {
      document.getElementById('coFirstCount').value = session.votes[voterToken].coFirstCount;
      updateCoFirstPreview();
    }

    // Show content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('voteContent').style.display = 'block';

  } catch (error) {
    console.error('Error loading session:', error);
    showError('Error loading session. Please try again.');
  }
}

function setupAuthorList() {
  const list = document.getElementById('authorList');
  list.innerHTML = '';

  currentOrder.forEach((authorIndex, position) => {
    const li = document.createElement('li');
    li.className = 'author-item';
    li.draggable = true;
    li.dataset.authorIndex = authorIndex;
    li.innerHTML = `
      <span class="position-number">${position + 1}</span>
      <span class="author-name">${authors[authorIndex]}</span>
      <span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
    `;
    list.appendChild(li);
  });

  setupDragAndDrop();
}

function setupDragAndDrop() {
  const list = document.getElementById('authorList');
  let draggedItem = null;
  let draggedOverItem = null;

  list.querySelectorAll('.author-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
      list.querySelectorAll('.author-item').forEach(i => i.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (item !== draggedItem) {
        item.classList.add('drag-over');
        draggedOverItem = item;
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');

      if (draggedItem && item !== draggedItem) {
        const allItems = [...list.querySelectorAll('.author-item')];
        const draggedIdx = allItems.indexOf(draggedItem);
        const dropIdx = allItems.indexOf(item);

        if (draggedIdx < dropIdx) {
          item.parentNode.insertBefore(draggedItem, item.nextSibling);
        } else {
          item.parentNode.insertBefore(draggedItem, item);
        }

        updateOrder();
        updateCoFirstPreview();
      }
    });
  });

  // Touch support for mobile
  let touchStartY = 0;
  let touchedItem = null;

  list.querySelectorAll('.author-item').forEach(item => {
    item.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchedItem = item;
      item.classList.add('touching');
    });

    item.addEventListener('touchmove', (e) => {
      if (!touchedItem) return;
      e.preventDefault();

      const touchY = e.touches[0].clientY;
      const items = [...list.querySelectorAll('.author-item')];
      const itemRect = touchedItem.getBoundingClientRect();

      items.forEach(otherItem => {
        if (otherItem === touchedItem) return;
        const otherRect = otherItem.getBoundingClientRect();

        if (touchY > otherRect.top && touchY < otherRect.bottom) {
          if (touchY < otherRect.top + otherRect.height / 2) {
            list.insertBefore(touchedItem, otherItem);
          } else {
            list.insertBefore(touchedItem, otherItem.nextSibling);
          }
        }
      });
    });

    item.addEventListener('touchend', () => {
      if (touchedItem) {
        touchedItem.classList.remove('touching');
        touchedItem = null;
        updateOrder();
        updateCoFirstPreview();
      }
    });
  });
}

function updateOrder() {
  const list = document.getElementById('authorList');
  const items = list.querySelectorAll('.author-item');

  currentOrder = [];
  items.forEach((item, position) => {
    currentOrder.push(parseInt(item.dataset.authorIndex));
    item.querySelector('.position-number').textContent = position + 1;
  });
}

function setupCoFirstSelector() {
  const select = document.getElementById('coFirstCount');
  select.innerHTML = '';

  for (let i = 1; i <= authors.length; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i === 1 ? '1 (single first author)' : `${i} co-first authors`;
    select.appendChild(option);
  }

  select.addEventListener('change', updateCoFirstPreview);
  updateCoFirstPreview();
}

function updateCoFirstPreview() {
  const count = parseInt(document.getElementById('coFirstCount').value);
  const preview = document.getElementById('coFirstPreview');

  const coFirstAuthors = currentOrder.slice(0, count).map(i => authors[i]);

  if (count === 1) {
    preview.innerHTML = `<p>First author: <strong>${coFirstAuthors[0]}</strong></p>`;
  } else {
    preview.innerHTML = `<p>Co-first authors: <strong>${coFirstAuthors.join('*, ')}</strong>*</p>`;
  }
}

document.getElementById('submitVote').addEventListener('click', submitVote);

async function submitVote() {
  const submitBtn = document.getElementById('submitVote');
  const voteStatus = document.getElementById('voteStatus');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const voteData = {
      order: currentOrder,
      coFirstCount: parseInt(document.getElementById('coFirstCount').value),
      submittedAt: firebase.database.ServerValue.TIMESTAMP
    };

    // Save vote
    await database.ref(`voting-sessions/${sessionId}/votes/${voterToken}`).set(voteData);

    // Mark token as used
    await database.ref(`voting-sessions/${sessionId}/voterTokens/${voterToken}/used`).set(true);

    voteStatus.textContent = 'Vote submitted successfully! You can update it anytime.';
    voteStatus.classList.add('success');
    voteStatus.classList.remove('has-voted');

  } catch (error) {
    console.error('Error submitting vote:', error);
    voteStatus.textContent = 'Error submitting vote. Please try again.';
    voteStatus.classList.add('error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Vote';
  }
}

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorState').style.display = 'block';
}
