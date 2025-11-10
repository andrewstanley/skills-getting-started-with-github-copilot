document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
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
              const li = document.createElement('li');
              li.className = 'participant-item';
              const nameSpan = document.createElement('span');
              nameSpan.textContent = p;

              const btn = document.createElement('button');
              btn.className = 'delete-btn';
              btn.title = 'Unregister participant';
              btn.type = 'button';
              btn.innerHTML = '&#128465;'; // trash can emoji
              btn.addEventListener('click', async () => {
                // Call API to unregister then refresh activities list
                await unregisterParticipant(name, p);
                // Refresh displayed activities to reflect change
                fetchActivities();
              });

              li.appendChild(nameSpan);
              li.appendChild(btn);
              participantsUl.appendChild(li);
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
        // Refresh activities to show the newly registered participant
        fetchActivities();
      } else {
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
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Initialize app
  fetchActivities();
});
