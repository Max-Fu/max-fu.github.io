// Real-time results display logic

let sessionId = null;
let authors = [];
let totalVoters = 0;
let sessionRef = null;

document.addEventListener('DOMContentLoaded', () => {
  sessionId = getUrlParam('session');

  if (!sessionId) {
    showLandingPage();
    return;
  }

  loadResults();
});

// Landing page functionality
function showLandingPage() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('landingPage').style.display = 'block';

  document.getElementById('viewResultsBtn').addEventListener('click', () => {
    const inputId = document.getElementById('sessionIdInput').value.trim();
    if (inputId) {
      window.location.href = `?session=${inputId}`;
    }
  });

  document.getElementById('sessionIdInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('viewResultsBtn').click();
    }
  });
}

async function loadResults() {
  try {
    sessionRef = database.ref(`voting-sessions/${sessionId}`);
    const snapshot = await sessionRef.once('value');
    const session = snapshot.val();

    if (!session) {
      showError('Session not found.');
      return;
    }

    authors = Object.values(session.authors);
    totalVoters = session.metadata.totalVoters;

    document.getElementById('sessionTitle').textContent = session.metadata.title;

    // Show results content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('resultsContent').style.display = 'block';

    // Initial render
    renderResults(session);

    // Set up real-time listener
    sessionRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        renderResults(data);
      }
    });

  } catch (error) {
    console.error('Error loading results:', error);
    showError('Error loading session. Please try again.');
  }
}

function renderResults(session) {
  const votes = session.votes || {};
  const voteCount = Object.keys(votes).length;

  // Update progress
  document.getElementById('voteCount').textContent = `${voteCount} of ${totalVoters} votes`;
  document.getElementById('progressFill').style.width = `${(voteCount / totalVoters) * 100}%`;

  if (voteCount === 0) {
    document.getElementById('rankingResults').innerHTML = '<p class="no-votes">No votes yet. Results will appear as votes come in.</p>';
    document.getElementById('coFirstResults').innerHTML = '';
    document.getElementById('suggestedOrder').innerHTML = '';
    return;
  }

  // Calculate Borda count scores
  const scores = calculateBordaScores(votes);
  renderRankingResults(scores);

  // Calculate co-first author distribution
  const coFirstDistribution = calculateCoFirstDistribution(votes);
  renderCoFirstResults(coFirstDistribution);

  // Render suggested order
  renderSuggestedOrder(scores, coFirstDistribution);
}

function calculateBordaScores(votes) {
  const n = authors.length;
  const scores = authors.map(() => 0);

  Object.values(votes).forEach(vote => {
    vote.order.forEach((authorIndex, position) => {
      // Borda count: position 1 gets n-1 points, position 2 gets n-2 points, etc.
      scores[authorIndex] += (n - 1 - position);
    });
  });

  return scores;
}

function calculateCoFirstDistribution(votes) {
  const distribution = {};

  Object.values(votes).forEach(vote => {
    const count = vote.coFirstCount;
    distribution[count] = (distribution[count] || 0) + 1;
  });

  return distribution;
}

function renderRankingResults(scores) {
  const container = document.getElementById('rankingResults');
  const maxScore = Math.max(...scores);
  const voteCount = Object.keys(scores).length > 0 ? 1 : 0;

  // Create sorted array of [authorIndex, score]
  const sorted = scores
    .map((score, index) => ({ index, score, name: authors[index] }))
    .sort((a, b) => b.score - a.score);

  container.innerHTML = sorted.map((item, rank) => {
    const percentage = maxScore > 0 ? (item.score / maxScore) * 100 : 0;
    return `
      <div class="ranking-item">
        <div class="ranking-position">${rank + 1}</div>
        <div class="ranking-details">
          <div class="ranking-name">${item.name}</div>
          <div class="ranking-bar-container">
            <div class="ranking-bar" style="width: ${percentage}%"></div>
          </div>
        </div>
        <div class="ranking-score">${item.score} pts</div>
      </div>
    `;
  }).join('');
}

function renderCoFirstResults(distribution) {
  const container = document.getElementById('coFirstResults');
  const totalVotes = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (totalVotes === 0) {
    container.innerHTML = '';
    return;
  }

  // Sort by count (most votes first)
  const sorted = Object.entries(distribution)
    .map(([count, votes]) => ({ count: parseInt(count), votes }))
    .sort((a, b) => b.votes - a.votes);

  container.innerHTML = sorted.map(item => {
    const percentage = (item.votes / totalVotes) * 100;
    const label = item.count === 1 ? '1 first author' : `${item.count} co-first authors`;
    return `
      <div class="co-first-item">
        <div class="co-first-label">${label}</div>
        <div class="co-first-bar-container">
          <div class="co-first-bar" style="width: ${percentage}%"></div>
          <span class="co-first-votes">${item.votes} vote${item.votes !== 1 ? 's' : ''} (${percentage.toFixed(0)}%)</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderSuggestedOrder(scores, coFirstDistribution) {
  const container = document.getElementById('suggestedOrder');

  // Get sorted authors by score
  const sorted = scores
    .map((score, index) => ({ index, score, name: authors[index] }))
    .sort((a, b) => b.score - a.score);

  // Get most common co-first count
  let mostCommonCoFirst = 1;
  let maxVotes = 0;
  Object.entries(coFirstDistribution).forEach(([count, votes]) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      mostCommonCoFirst = parseInt(count);
    }
  });

  // Build suggested order string
  const coFirstAuthors = sorted.slice(0, mostCommonCoFirst).map(a => a.name);
  const otherAuthors = sorted.slice(mostCommonCoFirst).map(a => a.name);

  let orderHtml = '<div class="suggested-authors">';

  if (mostCommonCoFirst > 1) {
    orderHtml += `<span class="co-first-group">${coFirstAuthors.join('*, ')}*</span>`;
  } else {
    orderHtml += `<span class="first-author">${coFirstAuthors[0]}</span>`;
  }

  if (otherAuthors.length > 0) {
    orderHtml += `, ${otherAuthors.join(', ')}`;
  }

  orderHtml += '</div>';

  if (mostCommonCoFirst > 1) {
    orderHtml += `<p class="co-first-note">* denotes co-first authorship (${mostCommonCoFirst} authors, based on ${maxVotes} vote${maxVotes !== 1 ? 's' : ''})</p>`;
  }

  container.innerHTML = orderHtml;
}

document.getElementById('refreshBtn')?.addEventListener('click', () => {
  if (sessionRef) {
    sessionRef.once('value').then(snapshot => {
      const data = snapshot.val();
      if (data) {
        renderResults(data);
      }
    });
  }
});

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorState').style.display = 'block';
}
