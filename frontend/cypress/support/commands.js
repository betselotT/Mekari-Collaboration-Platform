Cypress.Commands.add("mockCurrentUser", (fixture = "currentUser") => {
  cy.fixture(fixture).then((body) => {
    cy.intercept("GET", "/api/users/me", { statusCode: 200, body }).as("getCurrentUser");
  });
});

Cypress.Commands.add("loginByToken", (token = "cypress-user-token") => {
  cy.window().then((win) => {
    win.localStorage.setItem("mekari_token", token);
  });
});

Cypress.Commands.add("visitAsUser", (path, options = {}) => {
  cy.mockCurrentUser(options.fixture || "currentUser");
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem("mekari_token", options.token || "cypress-user-token");
    },
  });
});
