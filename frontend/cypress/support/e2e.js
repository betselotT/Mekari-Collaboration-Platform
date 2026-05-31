import "./commands";

beforeEach(() => {
  cy.intercept("GET", "/api/firebase-config", {
    body: { config: null },
  }).as("firebaseConfig");
  cy.intercept("GET", "/api/notifications", {
    body: { notifications: [] },
  }).as("notifications");
});
