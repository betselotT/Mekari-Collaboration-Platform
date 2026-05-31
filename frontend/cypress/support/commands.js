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

Cypress.Commands.add("visitVerified", (path, options = {}) => {
  const userOnBeforeLoad = options.onBeforeLoad;
  cy.visit(path, {
    ...options,
    onBeforeLoad(win) {
      win.sessionStorage.setItem("mekari_security_verified", "true");
      userOnBeforeLoad?.(win);
    },
  });
});

Cypress.Commands.add("visitAsUser", (path, options = {}) => {
  cy.mockCurrentUser(options.fixture || "currentUser");
  cy.visitVerified(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem("mekari_token", options.token || "cypress-user-token");
    },
  });
});

Cypress.Commands.add("browserApi", (path, init = {}) => {
  cy.window().then(async (win) => {
    const response = await win.fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => null);
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  });
});
