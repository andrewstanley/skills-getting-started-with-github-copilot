document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper: find activity card element by activity name
  function findActivityCard(activityName) {
    const cards = activitiesList.querySelectorAll('.activity-card');
    for (const card of cards) {
      const h4 = card.querySelector('h4');
      if (h4 && h4.textContent === activityName) return card;
    }
    return null;
  }

  // Helper: create a participant <li> element with delete button wired for optimistic updates
  function createParticipantLI(activityName, participant) {
    const li = document.createElement('li');
    li.className = 'participant-item';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = participant;

    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.title = 'Unregister participant';
    btn.type = 'button';
    btn.innerHTML = '&#128465;'; // trash can emoji

    btn.addEventListener('click', async () => {
      // Optimistically remove from DOM and update counts
      const removed = removeParticipantFromCard(activityName, participant);

      // Call API to unregister
      const success = await unregisterParticipant(activityName, participant);
      if (!success && removed) {
        // Roll back optimistic removal
        addParticipantToCard(activityName, participant);
      }
    });

    li.appendChild(nameSpan);
    li.appendChild(btn);
    return li;
  }

  // Helper: append participant to activity card if not already present
  function addParticipantToCard(activityName, participant) {
    const card = findActivityCard(activityName);
    if (!card) return false;
    const ul = card.querySelector('.participants-list');
    if (!ul) return false;
    // avoid duplicates
    const exists = Array.from(ul.querySelectorAll('span')).some(s => s.textContent === participant);
    if (exists) return false;
    const li = createParticipantLI(activityName, participant);
    // If the 'No participants yet' em exists, remove it
    const first = ul.querySelector('li');
    if (first && first.querySelector && first.querySelector('em')) {
      ul.innerHTML = '';
    }
    ul.appendChild(li);
    // update the participants count header text
    const strong = card.querySelector('.participants-section > strong');
    if (strong) {
      const match = strong.textContent.match(/Participants \((\d+)\):/);
      if (match) {
        const count = parseInt(match[1], 10) + 1;
        strong.textContent = `Participants (${count}):`;
      }
    }
    return true;
  }

  // Helper: remove participant from activity card (non-networking, immediate DOM change)
  function removeParticipantFromCard(activityName, participant) {
    const card = findActivityCard(activityName);
    if (!card) return false;
    const ul = card.querySelector('.participants-list');
    if (!ul) return false;
    const items = Array.from(ul.querySelectorAll('.participant-item'));
    const item = items.find(it => it.querySelector('span') && it.querySelector('span').textContent === participant);
    if (!item) return false;
    item.remove();
    // update count
    const strong = card.querySelector('.participants-section > strong');
    if (strong) {
      const match = strong.textContent.match(/Participants \((\d+)\):/);
      if (match) {
        const count = Math.max(0, parseInt(match[1], 10) - 1);
        strong.textContent = `Participants (${count}):`;
      }
    }
    // if no items left, add the placeholder
    if (ul.children.length === 0) {
      const li = document.createElement('li');
      const em = document.createElement('em');
      em.textContent = 'No participants yet';
      li.appendChild(em);
      ul.appendChild(li);
    }
    return true;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
  // Force a fresh fetch so we don't render a cached response
  const response = await fetch("/activities", { cache: 'no-store' });
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Clear previously added activity options but keep the first placeholder option if present
      while (activitySelect.options && activitySelect.options.length > 1) {
        activitySelect.remove(1);
      }

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

          const spotsLeft = details.max_participants - details.participants.length;

          // Render basic activity card (participants list populated below so we can attach event listeners)
          activityCard.innerHTML = `
            <h4>${name}</h4>
            <p>${details.description}</p>
            <p><strong>Schedule:</strong> ${details.schedule}</p>
            <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
            <div class="participants-section">
              <strong>Participants (${details.participants.length}):</strong>
              <ul class="participants-list">
              </ul>
            </div>
          `;

          // After adding the card to the DOM, populate the participants list with delete buttons
          activitiesList.appendChild(activityCard);
          const participantsUl = activityCard.querySelector('.participants-list');

          if (details.participants.length === 0) {
            const li = document.createElement('li');
            const em = document.createElement('em');
            em.textContent = 'No participants yet';
            li.appendChild(em);
            participantsUl.appendChild(li);
          } else {


              details.participants.forEach(p => {
                participantsUl.appendChild(createParticipantLI(name, p));
              });
            }

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      // Optimistically add participant to the UI
      const added = addParticipantToCard(activity, email);

      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // If we couldn't optimistically update (no card found), refresh as fallback
        if (!added) await fetchActivities();
      } else {
        // Roll back optimistic update on error
        if (added) removeParticipantFromCard(activity, email);
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Function to unregister a participant
  async function unregisterParticipant(activity, participant) {
    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(participant)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        messageDiv.classList.remove("hidden");
        setTimeout(() => {
          messageDiv.classList.add("hidden");
        }, 5000);
        return true;
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
        messageDiv.classList.remove("hidden");
        setTimeout(() => {
          messageDiv.classList.add("hidden");
        }, 5000);
        return false;
      }
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
      return false;
    }
  }

  // Initialize app
  fetchActivities();
});
